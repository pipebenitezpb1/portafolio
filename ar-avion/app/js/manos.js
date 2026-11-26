/*
 * Interacción con las manos en 3D usando MediaPipe Hand Landmarker + la pose del marcador.
 * Usa el mismo video de la cámara que MindAR (no abre otra cámara).
 *
 * PROFUNDIDAD CON UNA SOLA WEBCAM
 *   La palma de la mano es casi rígida: su tamaño real no cambia. Si sabemos cuánto mide
 *   (en "anchos de marcador"), su tamaño en pantalla dice a qué distancia está:
 *        distancia = focal * tamañoReal / tamañoEnPantalla
 *   El tamaño real se aprende con la CALIBRACIÓN: mano plana sobre el marcador 1,5 s
 *   (en ese momento la mano está a la misma distancia que el marcador, que MindAR conoce).
 *   Luego MediaPipe da la profundidad relativa de cada dedo respecto a la muñeca,
 *   y con eso se reconstruyen los 21 puntos de la mano en el mismo espacio 3D del avión.
 *
 * Interacción:
 *   ☝️ TOCAR    La punta del índice llega al avión (en pantalla Y en profundidad) -> tonel
 *   🤏 AGARRAR  Pellizca el avión a su profundidad y muévelo en 3D -> al soltar vuelve
 *   ✋ LLAMAR   Palma abierta un momento -> el avión vuela frente a tu palma y la sigue
 *   🤏🤏 ESCALAR Pinza con las dos manos y separa/junta
 *   Oclusión: la mano tapa el avión cuando está delante de él.
 */
import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const AR = window.AR = window.AR || {};

const TIEMPO_LLAMAR = 0.7;      // s con la palma abierta para llamar al avión
const TIEMPO_CALIBRAR = 1.5;    // s con la mano sobre el marcador para calibrar
const PALMA_DEFECTO = 0.55;     // tamaño de palma en anchos de marcador (palma ~8 cm / marcador ~15 cm)
const TOL_PROF = 0.35;          // tolerancia en profundidad para tocar/agarrar (anchos de marcador)
const CLAVE_GUARDADO = 'ar-avion-palma';

const canvas = document.getElementById('manos-canvas');
const g = canvas.getContext('2d');

let landmarker = null, cargando = null, activo = false, video = null, ultimoTiempo = -1;
let ultimoFrame = performance.now();
let dosManos = null;     // escala con dos manos
let agarre = null;       // clave de la mano que agarra el avión
let llamado = null;      // clave de la mano a la que sigue el avión
let calibrando = null;   // { t } mientras se calibra
const estados = {};
const enfriamientos = {};

/* Tamaño de palma calibrado (anchos de marcador) */
const prof = { palma: PALMA_DEFECTO, calibrado: false };
try {
  const v = parseFloat(localStorage.getItem(CLAVE_GUARDADO));
  if (v > 0.05 && v < 5) { prof.palma = v; prof.calibrado = true; }
} catch (e) { /* sin almacenamiento: se usa el valor por defecto */ }

const v3 = new THREE.Vector3(), v3b = new THREE.Vector3(), adelante = new THREE.Vector3();
const rayo = new THREE.Raycaster(), plano = new THREE.Plane();
const normal = new THREE.Vector3(), puntoPlano = new THREE.Vector3(), ndc = new THREE.Vector2();
const objetivo = new THREE.Vector3();

/* ---------------- utilidades ---------------- */
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const espejo = () => document.body.classList.contains('espejo');
const escena = () => document.querySelector('a-scene');
const marcadorVisible = () => AR.seguimiento && AR.seguimiento.estado !== 'buscando';
const anchoMarcador = () => AR.seguimiento.el.object3D.scale.x;     // unidades de mundo por ancho de marcador

function enfriar(nombre, ms) {
  const ahora = performance.now();
  if ((enfriamientos[nombre] || 0) > ahora) return false;
  enfriamientos[nombre] = ahora + ms;
  return true;
}

function obtenerVideo() {
  return escena()?.systems['mindar-image-system']?.video || document.querySelector('video');
}

/** Landmarks normalizados -> píxeles de pantalla (sin espejo). z en las mismas unidades que x */
function aPantalla(lms) {
  const r = video.getBoundingClientRect();
  return lms.map(l => ({ x: r.left + l.x * r.width, y: r.top + l.y * r.height, z: l.z * r.width }));
}

/** Distancia focal de la cámara 3D en píxeles de pantalla */
function focalPx() {
  const s = escena();
  return s.camera.projectionMatrix.elements[5] * s.canvas.getBoundingClientRect().height / 2;
}

/** Profundidad (distancia a lo largo del eje de la cámara) de un punto de mundo */
function profundidad(p) {
  const cam = escena().camera;
  cam.getWorldDirection(adelante);
  cam.getWorldPosition(v3b);
  return v3.copy(p).sub(v3b).dot(adelante);
}

/** Punto de pantalla + profundidad -> punto de mundo */
function desproyectar(p, Z, salida) {
  const s = escena();
  const r = s.canvas.getBoundingClientRect();
  ndc.set((p.x - r.left) / r.width * 2 - 1, -((p.y - r.top) / r.height) * 2 + 1);
  rayo.setFromCamera(ndc, s.camera);
  s.camera.getWorldDirection(adelante);
  const t = Z / rayo.ray.direction.dot(adelante);
  return salida.copy(rayo.ray.origin).addScaledVector(rayo.ray.direction, t);
}

/** Punto de pantalla -> intersección con el plano del marcador (a `altura` anchos de marcador) */
function pantallaAMarcador(p, altura, salida) {
  const s = escena();
  const r = s.canvas.getBoundingClientRect();
  ndc.set((p.x - r.left) / r.width * 2 - 1, -((p.y - r.top) / r.height) * 2 + 1);
  rayo.setFromCamera(ndc, s.camera);
  const ancla = AR.seguimiento.el.object3D;
  normal.set(0, 0, 1).applyQuaternion(ancla.quaternion);
  puntoPlano.copy(ancla.position).addScaledVector(normal, altura * ancla.scale.x);
  plano.setFromNormalAndCoplanarPoint(normal, puntoPlano);
  return rayo.ray.intersectPlane(plano, salida);
}

/** Mundo -> pantalla */
function aPantallaDesdeMundo(p) {
  const s = escena();
  const r = s.canvas.getBoundingClientRect();
  v3.copy(p).project(s.camera);
  return { x: r.left + (v3.x + 1) / 2 * r.width, y: r.top + (1 - v3.y) / 2 * r.height, detras: v3.z > 1 };
}

/** Datos del avión: posición en mundo y pantalla, radio en pantalla, profundidad */
function datosAvion() {
  if (!AR.piloto || !marcadorVisible()) return null;
  const mundo = AR.piloto.posicionMundo(new THREE.Vector3());
  const escala = anchoMarcador() * (AR.manipulador?.obj.escala || 1);
  const p = aPantallaDesdeMundo(mundo);
  if (p.detras) return null;
  const q = aPantallaDesdeMundo(v3b.copy(mundo).setX(mundo.x + 0.35 * escala));
  return { mundo, x: p.x, y: p.y, radio: Math.max(55, d2(p, q)), Z: profundidad(mundo) };
}

/* ---------------- mano en 3D ---------------- */
const PALMA = [0, 5, 9, 13, 17];

/** Tamaño de la palma en píxeles (segmentos rígidos, con profundidad relativa para compensar inclinación) */
function palmaPx(P) {
  return (d3(P[0], P[5]) + d3(P[0], P[17]) + d3(P[5], P[17]) + d3(P[0], P[9])) / 4;
}

/** Reconstruye los 21 puntos en el mundo 3D */
function reconstruir(m) {
  const f = focalPx();
  const palmaMundo = prof.palma * anchoMarcador();
  const Z = f * palmaMundo / Math.max(palmaPx(m.P), 1);
  const st = m.st;
  st.Z = st.Z ? st.Z + (Z - st.Z) * 0.35 : Z;                 // suavizado de la profundidad
  const zRef = PALMA.reduce((a, k) => a + m.P[k].z, 0) / PALMA.length;
  st.pts ||= m.P.map(() => new THREE.Vector3());
  m.P.forEach((p, i) => desproyectar(p, st.Z + (p.z - zRef) * st.Z / f, st.pts[i]));
  m.pts = st.pts;
  m.Z = st.Z;
  m.palmaMundo = palmaMundo;
}

/* ---------------- oclusión: mano invisible que escribe profundidad ---------------- */
const HUESOS = HandLandmarker.HAND_CONNECTIONS.map(c => [c.start, c.end]);
const matOclusor = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
const matVisible = new THREE.MeshBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
const geoEsfera = new THREE.SphereGeometry(1, 12, 8);
const geoCilindro = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
const ARRIBA = new THREE.Vector3(0, 1, 0);
const oclusores = {};
let verMano3D = false;
let oclusionActiva = true;

function crearOclusor() {
  const grupo = new THREE.Group();
  const esferas = Array.from({ length: 21 }, () => new THREE.Mesh(geoEsfera, matOclusor));
  const cilindros = HUESOS.map(() => new THREE.Mesh(geoCilindro, matOclusor));
  const geoPalma = new THREE.BufferGeometry();
  geoPalma.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
  geoPalma.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
  const palma = new THREE.Mesh(geoPalma, matOclusor);
  [...esferas, ...cilindros, palma].forEach(o => { o.renderOrder = -1; o.frustumCulled = false; grupo.add(o); });
  escena().object3D.add(grupo);
  return { grupo, esferas, cilindros, palma };
}

function actualizarOclusor(clave, m) {
  const o = oclusores[clave] ||= crearOclusor();
  o.grupo.visible = oclusionActiva;
  if (!oclusionActiva) return;
  const mat = verMano3D ? matVisible : matOclusor;
  const r = m.palmaMundo * 0.11;                 // radio de un dedo
  m.pts.forEach((p, i) => { const e = o.esferas[i]; e.position.copy(p); e.scale.setScalar(r); e.material = mat; });
  HUESOS.forEach(([a, b], i) => {
    const c = o.cilindros[i], pa = m.pts[a], pb = m.pts[b];
    c.position.copy(pa).add(pb).multiplyScalar(0.5);
    v3.copy(pb).sub(pa);
    const largo = v3.length();
    c.quaternion.setFromUnitVectors(ARRIBA, v3.normalize());
    c.scale.set(r, largo, r);
    c.material = mat;
  });
  const pos = o.palma.geometry.attributes.position;
  [0, 1, 5, 9, 13, 17].forEach((k, i) => pos.setXYZ(i, m.pts[k].x, m.pts[k].y, m.pts[k].z));
  pos.needsUpdate = true;
  o.palma.material = mat;
}

function limpiarOclusores(presentes) {
  for (const k of Object.keys(oclusores)) {
    if (!presentes.has(k)) { oclusores[k].grupo.visible = false; }
  }
}

/* ---------------- clasificación ---------------- */
function clasificar(P, anterior) {
  const tam = d3(P[0], P[9]);
  const ext = (tip, pip) => d3(P[0], P[tip]) > d3(P[0], P[pip]) * 1.15;
  const indice = ext(8, 6), medio = ext(12, 10), anular = ext(16, 14), menique = ext(20, 18);

  // Pinza con histéresis: cuesta más soltarla que activarla (no parpadea)
  const pinza = d3(P[4], P[8]) / tam;
  const umbral = anterior === 'pinza' ? 0.45 : 0.3;
  const indiceAbierto = d3(P[0], P[8]) > d3(P[0], P[5]) * 1.1;
  if (pinza < umbral && indiceAbierto) return 'pinza';

  const n = indice + medio + anular + menique;
  if (n === 4) return 'palma';
  if (indice && n === 1) return 'apuntar';
  if (n === 0) return 'puno';
  return 'otro';
}

/** Solo cambia de gesto si se repite varios cuadros seguidos (evita falsos positivos) */
function estabilizar(st, nuevo) {
  if (nuevo === st.gesto) { st.candidato = null; return false; }
  if (nuevo === st.candidato) st.cuenta++;
  else { st.candidato = nuevo; st.cuenta = 1; }
  const necesario = nuevo === 'pinza' || st.gesto === 'pinza' ? 2 : 3;
  if (st.cuenta >= necesario) {
    st.gesto = nuevo; st.candidato = null;
    return true;
  }
  return false;
}

/* ---------------- acciones ---------------- */
function tocarAvion() {
  if (!AR.piloto.tonel()) return;
  AR.piloto.posicionMundo(v3);
  AR.particulas?.explosion(v3, 60);
  AR.sonido?.boop();
  AR.ui?.toast('☝️ ¡Tonel!', 900);
}

function soltar() {
  if (agarre || llamado) AR.piloto?.controlar(null);
  agarre = null;
  llamado = null;
}

/* ---------------- dibujo ---------------- */
function texto(t, x, y, color, tam = 15) {
  g.save();
  g.translate(x, y);
  if (espejo()) g.scale(-1, 1);          // el canvas está volteado por CSS: des-voltear el texto
  g.font = `600 ${tam}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.65)';
  g.strokeText(t, 0, 0);
  g.fillStyle = color; g.fillText(t, 0, 0);
  g.restore();
}

function anillo(x, y, r, progreso, color) {
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 4; g.stroke();
  g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progreso));
  g.strokeStyle = color; g.lineWidth = 5; g.lineCap = 'round'; g.stroke();
}

function dibujarMano(m, destacado, colorPunta) {
  const { P } = m;
  g.lineCap = 'round';
  g.strokeStyle = destacado ? 'rgba(255,214,90,.9)' : 'rgba(255,255,255,.4)';
  g.lineWidth = destacado ? 3.5 : 2;
  for (const [a, b] of HUESOS) {
    g.beginPath(); g.moveTo(P[a].x, P[a].y); g.lineTo(P[b].x, P[b].y); g.stroke();
  }
  // Punta del índice: su color indica la profundidad respecto al avión
  g.beginPath(); g.arc(P[8].x, P[8].y, 8, 0, Math.PI * 2);
  g.fillStyle = colorPunta || 'rgba(255,255,255,.85)'; g.fill();
}

/* ---------------- procesamiento por cuadro ---------------- */
function procesar(res, dt) {
  g.clearRect(0, 0, canvas.width, canvas.height);
  const presentes = new Set();
  const manos = [];
  const hayMarcador = marcadorVisible();

  (res.landmarks || []).forEach((lms, i) => {
    let clave = res.handednesses?.[i]?.[0]?.categoryName || 'Mano';
    if (presentes.has(clave)) clave += i;
    presentes.add(clave);
    const st = estados[clave] ||= { gesto: 'otro', cuenta: 0, palmaT: 0, dentro: false };
    const P = aPantalla(lms);
    const cambio = estabilizar(st, clasificar(P, st.gesto));
    const centro = PALMA.reduce((a, k) => ({ x: a.x + P[k].x / 5, y: a.y + P[k].y / 5 }), { x: 0, y: 0 });
    const m = {
      clave, st, P, centro, cambio, tam: d2(P[0], P[9]),
      pinzaPt: { x: (P[4].x + P[8].x) / 2, y: (P[4].y + P[8].y) / 2 },
      indiceExtendido: d3(P[0], P[8]) > d3(P[0], P[6]) * 1.15
    };
    if (hayMarcador) { reconstruir(m); actualizarOclusor(clave, m); }
    manos.push(m);
  });
  for (const k of Object.keys(estados)) if (!presentes.has(k)) delete estados[k];
  limpiarOclusores(hayMarcador ? presentes : new Set());

  // Si la mano que controlaba el avión desapareció, el avión vuelve
  if ((agarre && !presentes.has(agarre)) || (llamado && !presentes.has(llamado)) || (!hayMarcador && (agarre || llamado))) {
    soltar();
    AR.sonido?.whoosh();
  }

  /* 📏 Calibración: mano plana (palma) sobre el marcador */
  if (calibrando) {
    const centroMarcador = hayMarcador ? aPantallaDesdeMundo(AR.seguimiento.el.object3D.position) : null;
    const m = manos.find(m => m.st.gesto === 'palma');
    if (m && centroMarcador && d2(m.centro, centroMarcador) < m.tam * 1.5) {
      calibrando.t += dt;
      anillo(m.centro.x, m.centro.y, 40, calibrando.t / TIEMPO_CALIBRAR, '#ffcc33');
      texto('Calibrando…', m.centro.x, m.centro.y + 64, '#ffcc33');
      if (calibrando.t >= TIEMPO_CALIBRAR && pantallaAMarcador(m.centro, 0, objetivo)) {
        const Z = profundidad(objetivo);
        prof.palma = palmaPx(m.P) * Z / focalPx() / anchoMarcador();
        prof.calibrado = true;
        try { localStorage.setItem(CLAVE_GUARDADO, String(prof.palma)); } catch (e) { /* sin almacenamiento */ }
        calibrando = null;
        AR.sonido?.campana();
        AR.ui?.calibracion(false);
        AR.ui?.toast('📏 ¡Profundidad calibrada!');
      }
    } else {
      calibrando.t = Math.max(0, calibrando.t - dt);
    }
    for (const m of manos) dibujarMano(m, false);
    AR.ui?.manos(['📏 Pon la mano plana sobre el marcador']);
    return;
  }

  const avion = datosAvion();
  const manip = AR.manipulador;
  const enPinza = manos.filter(m => m.st.gesto === 'pinza');
  const tolZ = TOL_PROF * (hayMarcador ? anchoMarcador() : 1);

  /* 🤏🤏 Escalar con dos manos */
  if (enPinza.length === 2 && manip && !agarre) {
    const dist = d2(enPinza[0].pinzaPt, enPinza[1].pinzaPt);
    if (!dosManos) { dosManos = { d0: dist, e0: manip.obj.escala }; AR.ui?.toast('🤏🤏 Cambiar tamaño', 900); }
    manip.escalar(dosManos.e0 * dist / Math.max(dosManos.d0, 1));
    const [a, b] = enPinza.map(m => m.pinzaPt);
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
    g.setLineDash([8, 8]); g.strokeStyle = '#ffcc33'; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
    texto('×' + manip.obj.escala.toFixed(1), (a.x + b.x) / 2, (a.y + b.y) / 2 - 14, '#ffcc33', 18);
  } else {
    dosManos = null;
  }

  let guia = null;   // ayuda de profundidad para la mano más cercana al avión

  for (const m of manos) {
    const st = m.st;
    const en3D = !!m.pts;

    // Diferencia de profundidad entre la mano y el avión (positivo = el dedo está detrás del avión)
    const dzIndice = en3D && avion ? profundidad(m.pts[8]) - avion.Z : 0;
    const pinza3D = en3D ? v3b.copy(m.pts[4]).add(m.pts[8]).multiplyScalar(0.5).clone() : null;
    const dzPinza = pinza3D && avion ? profundidad(pinza3D) - avion.Z : 0;

    /* 🤏 Agarrar: pinza sobre el avión y a su profundidad */
    if (!agarre && !dosManos && avion && st.gesto === 'pinza' && m.cambio &&
        d2(m.pinzaPt, avion) < avion.radio * 1.5 && Math.abs(dzPinza) < tolZ * 1.3) {
      if (llamado) soltar();
      agarre = m.clave;
      AR.sonido?.click();
      AR.ui?.toast('🤏 ¡Lo tienes!', 900);
    }
    if (agarre === m.clave) {
      if (st.gesto === 'pinza' && pinza3D) {
        AR.piloto.controlar(pinza3D);        // el avión sigue la pinza en 3D (también hacia adelante/atrás)
      } else {
        soltar();
        AR.sonido?.whoosh();
      }
    }

    /* ✋ Llamar: palma abierta un momento */
    st.palmaT = st.gesto === 'palma' ? st.palmaT + dt : 0;
    if (!agarre && !llamado && st.palmaT >= TIEMPO_LLAMAR && en3D) {
      llamado = m.clave;
      AR.sonido?.campana();
      AR.ui?.toast('✋ ¡Ven aquí!', 900);
    }
    if (llamado === m.clave) {
      if (st.gesto === 'palma' && en3D) {
        // Frente a la palma: un poco hacia los dedos y hacia la cámara
        const centro3D = PALMA.reduce((a, k) => a.add(m.pts[k]), new THREE.Vector3()).multiplyScalar(1 / 5);
        const haciaDedos = v3.copy(m.pts[9]).sub(m.pts[0]).normalize();
        escena().camera.getWorldDirection(adelante);
        objetivo.copy(centro3D)
          .addScaledVector(haciaDedos, m.palmaMundo * 0.5)
          .addScaledVector(adelante, -m.palmaMundo * 0.6);
        AR.piloto.controlar(objetivo);
      } else {
        soltar();
        AR.sonido?.whoosh();
        AR.ui?.toast('👋 De vuelta al marcador', 900);
      }
    }

    /* ☝️ Tocar: la punta del índice entra en el avión, en pantalla y en profundidad */
    const puedeTocar = avion && m.indiceExtendido && st.gesto !== 'pinza' &&
                       agarre !== m.clave && llamado !== m.clave;
    const enPantalla = puedeTocar && d2(m.P[8], avion) < avion.radio;
    const aProfundidad = !en3D || Math.abs(dzIndice) < tolZ;
    const dentro = !!(enPantalla && aProfundidad);
    if (dentro && !st.dentro && enfriar('tocar', 900)) tocarAvion();
    st.dentro = dentro;

    // Color de la punta del dedo según la profundidad
    let colorPunta;
    if (avion && en3D && puedeTocar && d2(m.P[8], avion) < avion.radio * 2.5) {
      colorPunta = Math.abs(dzIndice) < tolZ ? '#7cff8a' : dzIndice > 0 ? '#4fa3ff' : '#ff9f43';
      const cercania = d2(m.P[8], avion) / avion.radio;
      if (!guia || cercania < guia.cercania) guia = { cercania, dz: dzIndice };
    }

    dibujarMano(m, agarre === m.clave || llamado === m.clave, colorPunta);

    if (st.gesto === 'palma' && !llamado && !agarre && st.palmaT > 0.1) {
      anillo(m.centro.x, m.centro.y, 30, st.palmaT / TIEMPO_LLAMAR, '#4fd1ff');
      texto('Llamando…', m.centro.x, m.centro.y + 52, '#4fd1ff');
    }
    if (agarre === m.clave) {
      g.beginPath(); g.arc(m.pinzaPt.x, m.pinzaPt.y, 12, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,204,51,.7)'; g.fill();
    }
  }

  /* Guía de profundidad junto al avión: anillo que se cierra al llegar a su profundidad */
  if (avion && guia && !agarre && !llamado && !dosManos) {
    const tol = tolZ;
    const enRango = Math.abs(guia.dz) < tol;
    const color = enRango ? '#7cff8a' : guia.dz > 0 ? '#4fa3ff' : '#ff9f43';
    const extra = Math.min(Math.abs(guia.dz) / tol, 3) * 18;
    g.beginPath(); g.arc(avion.x, avion.y, avion.radio + (enRango ? 0 : extra), 0, Math.PI * 2);
    g.setLineDash(enRango ? [] : [6, 8]); g.strokeStyle = color; g.lineWidth = 3; g.stroke(); g.setLineDash([]);
    const msg = enRango ? '☝️ tócalo · 🤏 agárralo'
              : guia.dz > 0 ? '⬅ trae el dedo hacia ti'
              : '➡ lleva el dedo hacia la cámara';
    texto(msg, avion.x, avion.y - avion.radio - 14, color);
  }

  // Resumen en la barra superior
  let resumen;
  if (agarre) resumen = '🤏 Agarrando el avión';
  else if (llamado) resumen = '✋ El avión te sigue';
  else if (dosManos) resumen = '🤏🤏 Cambiando tamaño';
  else if (manos.length) resumen = (manos.length === 1 ? '🖐 1 mano' : '🖐 2 manos') +
                                   (prof.calibrado ? ' · 3D ✓' : ' · 📏 calibra la profundidad');
  AR.ui?.manos(resumen ? [resumen] : []);
}

/* ---------------- ciclo ---------------- */
function ajustarCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function ciclo() {
  requestAnimationFrame(ciclo);
  if (!activo || !landmarker) return;
  video = video || obtenerVideo();
  if (!video || video.readyState < 2 || !video.videoWidth) return;
  if (video.currentTime === ultimoTiempo) return;
  ultimoTiempo = video.currentTime;
  const ahora = performance.now();
  const dt = Math.min((ahora - ultimoFrame) / 1000, 0.1);
  ultimoFrame = ahora;
  ajustarCanvas();
  try {
    procesar(landmarker.detectForVideo(video, ahora), dt);
  } catch (e) {
    console.warn('MediaPipe:', e);
  }
}

async function cargar() {
  if (landmarker) return landmarker;
  cargando ||= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    const opciones = delegate => ({
      baseOptions: { modelAssetPath: MODELO, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    try {
      return await HandLandmarker.createFromOptions(fileset, opciones('GPU'));
    } catch (e) {
      console.warn('GPU no disponible para MediaPipe, usando CPU', e);
      return await HandLandmarker.createFromOptions(fileset, opciones('CPU'));
    }
  })();
  landmarker = await cargando;
  return landmarker;
}

AR.manos = {
  get activo() { return activo; },
  get listo() { return !!landmarker; },
  get calibrado() { return prof.calibrado; },
  async activar() {
    activo = true;
    AR.ui?.manos(null, 'Cargando manos…');
    try {
      await cargar();
      AR.ui?.manos([]);
    } catch (e) {
      console.error(e);
      activo = false;
      AR.ui?.manos(null, 'Manos no disponibles');
    }
  },
  desactivar() {
    activo = false;
    soltar();
    calibrando = null;
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (const k of Object.keys(estados)) delete estados[k];
    limpiarOclusores(new Set());
    AR.ui?.manos(null, 'Manos apagadas');
  },
  /** Empieza (o cancela) la calibración de profundidad */
  calibrar() {
    if (calibrando) { calibrando = null; AR.ui?.calibracion(false); return false; }
    soltar();
    calibrando = { t: 0 };
    AR.ui?.calibracion(true);
    return true;
  },
  /** Muestra la mano 3D reconstruida (para comprobar la profundidad) */
  toggleMano3D() { verMano3D = !verMano3D; return verMano3D; },
  toggleOclusion() { oclusionActiva = !oclusionActiva; return oclusionActiva; },
  // Expuesto para pruebas
  _clasificar: clasificar,
  _procesar: procesar,
  _prof: prof
};

requestAnimationFrame(ciclo);
if (AR.arListo && AR.quiereManos !== false) AR.manos.activar();
