// Lógica principal: avance del relato, descenso, luz y color según la profundidad,
// modo VR (Meta Quest, con controles o con las manos) y modo en pantalla.

import { FASES, HITOS, PROFUNDIDAD_FINAL, VISTAS } from './narrativa.js?v=6';
import { crearSonido } from './sonido.js?v=6';

const { THREE, U, estado, ALTURA_FONDO, limitar, suave } = window.FOSA_BASE;
const $ = (id) => document.getElementById(id);
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const aRadianes = (g) => (g * Math.PI) / 180;
const formatear = (n) => Math.round(n).toLocaleString('es-CL');
const parametros = new URLSearchParams(location.search);

const escena = $('escena');
const rig = $('rig');
const camara = $('camara');
const hud = $('hud');
const relato = $('relato');
const panelVR = $('panelVR');
const consola = $('consola');
const palanca = $('palanca');
const botonAccion = $('botonAccion');

const sinSonido = { iniciar() {}, actualizar() {}, sonar() {}, clic() {}, chapuzon() {}, golpe() {}, encenderFocos() {}, soltarCarnada() {}, hito() {}, muestra() {} };
const sonido = parametros.has('silencio') ? sinSonido : crearSonido();
const modoDemo = parametros.has('demo');

let indiceFase = 0;
let tiempoFase = 0;
let tiempoAccion = null; // segundos desde que se accionó la palanca de la etapa
let pidioContinuar = false;
let cambiandoFase = false;
let enVR = false;
let vistaActual = VISTAS.barco;
let telonObjetivo = 0;
let proximoSonar = 0;
let toco = false;
let reloj = 0;
let indiceHito = -1;
let lugarActual = '';
let textoActual = '';
const DURACION_DESCENSO = HITOS[HITOS.length - 1].t;
const hitoCon = (evento) => HITOS.find((h) => h.evento === evento);

// Durante el descenso se pueden tomar tres muestras de agua, cada una en su tramo (en segundos).
const TRAMOS_MUESTRA = [[22.5, 33], [34.5, 45.5], [76, 89]];
let muestras = [false, false, false];
let muestraVigente = -1;
let avisoMuestra = { hasta: 0, texto: '' };
function muestraActiva() {
  if (FASES[indiceFase].id !== 'descenso' || cambiandoFase) return -1;
  return TRAMOS_MUESTRA.findIndex(([desde, hasta], i) => !muestras[i] && tiempoFase > desde && tiempoFase < hasta);
}

const colorAgua = new THREE.Color();
const COLORES_AGUA = [
  [0, new THREE.Color('#0d5273')],
  [200, new THREE.Color('#062a40')],
  [900, new THREE.Color('#010a12')],
  [2500, new THREE.Color('#000000')],
];
const COLOR_BRUMA = new THREE.Color('#8e9cb4');
const COLOR_SOL = new THREE.Color('#ffc38a');
const COLOR_SOL_AGUA = new THREE.Color('#8fd0e6');

// =====================================================================
// Relato
// =====================================================================

function actualizarRelato(s) {
  const fase = FASES[indiceFase];
  tiempoFase += s;
  if (tiempoAccion !== null) tiempoAccion += s;
  const despuesDe = (id) => FASES.findIndex((f) => f.id === id) < indiceFase;
  const enProfundidad = vistaActual.lugar === 'profundidad';
  estado.enSuperficie = !enProfundidad;

  // --- Superficie: el lander cae al agua ---
  if (fase.id === 'superficie') {
    estado.profundidad = 0;
    estado.caida = tiempoAccion === null ? 0 : limitar(tiempoAccion / 1.3);
    estado.chapuzon = tiempoAccion !== null && tiempoAccion > 0.95 ? tiempoAccion - 0.95 : 0;
  }

  // --- Descenso, hito por hito ---
  if (fase.id === 'descenso') {
    const t = tiempoFase;
    let i = 0;
    while (i < HITOS.length - 2 && t >= HITOS[i + 1].t) i++;
    const desde = HITOS[i];
    const hasta = HITOS[i + 1];
    let k = limitar((t - desde.t) / (hasta.t - desde.t));
    if (hasta.fin) k = 1 - (1 - k) * (1 - k); // el último tramo frena antes de tocar fondo
    estado.profundidad = desde.profundidad + (hasta.profundidad - desde.profundidad) * k;
    estado.velocidad = t < DURACION_DESCENSO ? 0.06 + 0.84 * suave(0, 3, t) * (1 - suave(DURACION_DESCENSO - 7, DURACION_DESCENSO, t)) : 0;
    if (i !== indiceHito && !cambiandoFase) {
      indiceHito = i;
      mostrarHito(desde);
    }

    // Encuentros del descenso.
    const sub = hitoCon('sumergible');
    const desdeSub = t - sub.t - 1.2;
    estado.sumergible = desdeSub > 0 && desdeSub < 17 ? desdeSub : 0;
    const observatorio = hitoCon('idoos');
    estado.idoos = suave(observatorio.t, observatorio.t + 2.5, t) * (1 - suave(observatorio.t + 11, observatorio.t + 14, t));
    estado.pared = suave(34, 40, t) * (1 - suave(DURACION_DESCENSO - 8, DURACION_DESCENSO - 3, t));
    estado.foto += ((desde.foto ? 1 : 0) - estado.foto) * Math.min(1, s * 2.5);
    const ventana = (inicio, duracion) => (t > inicio && t < inicio + duracion ? t - inicio : 0);
    estado.jibias = ventana(13.5, 17);

    // Cuando se abre un tramo de muestreo, la palanca vuelve a quedar lista.
    const activa = muestraActiva();
    if (activa >= 0 && activa !== muestraVigente) {
      palanca.setAttribute('palanca', 'etiqueta', 'TOMAR MUESTRA DE AGUA');
      palanca.components.palanca.reiniciar();
    }
    muestraVigente = activa;
    if (modoDemo && activa >= 0 && t > TRAMOS_MUESTRA[activa][0] + 3) accionar();

    if (t >= DURACION_DESCENSO && !cambiandoFase) avanzarFase();
  } else {
    if (fase.id !== 'ascenso') estado.velocidad = 0;
    estado.sumergible = 0;
    estado.jibias = 0;
    muestraVigente = -1;
    estado.idoos = 0;
    estado.pared = 0;
    estado.foto += (0 - estado.foto) * Math.min(1, s * 2.5);
    if (despuesDe('descenso') && fase.id !== 'ascenso' && fase.id !== 'final') estado.profundidad = PROFUNDIDAD_FINAL;
  }

  // --- Ascenso: sin el lastre, el lander sube solo hasta la superficie ---
  if (fase.id === 'ascenso') {
    const subida = tiempoAccion === null ? 0 : suave(1.5, 26, tiempoAccion);
    estado.profundidad = PROFUNDIDAD_FINAL * (1 - subida);
    estado.velocidad = tiempoAccion === null ? 0 : -0.95 * suave(0.5, 3, tiempoAccion) * (1 - suave(24, 26.5, tiempoAccion));
  }
  if (fase.id === 'final') {
    estado.profundidad = 0;
    estado.caida = 0; // el Audacia ya está de vuelta, colgado de la grúa
    estado.chapuzon = 0;
  }

  const p = estado.profundidad;
  estado.alturaSuelo = enProfundidad && p > 7700 ? -(PROFUNDIDAD_FINAL - p) * 0.12 + ALTURA_FONDO : -60;
  if (fase.id === 'ascenso' && tiempoAccion !== null) estado.desdeFondo = Math.max(estado.desdeFondo, 80); // la nube de sedimento ya se disipó
  estado.luzSol = enProfundidad ? Math.pow(limitar(1 - p / 240), 1.5) : 1;
  estado.bio = enProfundidad ? limitar((p - 260) / 400) * limitar((5800 - p) / 1500) : 0;
  estado.linterna = enProfundidad ? limitar((p - 60) / 200) : 0;

  // Contacto con el fondo.
  if (fase.id === 'descenso' && p > PROFUNDIDAD_FINAL - 4 && !toco) {
    toco = true;
    sonido.golpe();
    vibrar(1, 350);
  }
  estado.desdeFondo = toco ? estado.desdeFondo + s : 0;

  // Sonar y vibración que crecen con la presión.
  if (enProfundidad && reloj > proximoSonar) {
    proximoSonar = reloj + 4.5;
    sonido.sonar();
    if (fase.id === 'descenso') vibrar(0.08 + (p / PROFUNDIDAD_FINAL) * 0.5, 70);
  }

  // --- Focos y carnada ---
  if (fase.id === 'fondo' && tiempoAccion !== null) {
    // Los focos parpadean un instante al encender.
    const k = limitar(tiempoAccion / 0.9);
    estado.focos = k < 1 ? k * (Math.random() > 0.3 ? 1 : 0.15) : 1;
  } else {
    estado.focos = despuesDe('fondo') ? 1 : 0;
  }
  const subiendo = (fase.id === 'ascenso' && tiempoAccion !== null) || fase.id === 'final';
  if (fase.id === 'carnada' && tiempoAccion !== null) estado.carnada = tiempoAccion + 0.001;
  else if (despuesDe('carnada') && !subiendo) estado.carnada += s;
  else estado.carnada = 0; // al subir, el brazo se recoge y la fauna queda atrás

  // --- Avance ---
  if (!cambiandoFase) {
    if (fase.requiere === 'palanca' && tiempoAccion !== null && tiempoAccion >= fase.segundosDespues && tiempoFase >= fase.duracionMinima) {
      avanzarFase();
    } else if (fase.requiere === 'continuar' && pidioContinuar && tiempoFase >= fase.duracionMinima) {
      if (fase.reinicia) reiniciar();
      else avanzarFase();
    }
  }
  pidioContinuar = false;

  // --- Modo demo, para grabar en pantalla ---
  if (modoDemo && !cambiandoFase) {
    if (fase.requiere === 'palanca' && tiempoAccion === null && tiempoFase > Math.min(4, fase.duracionMinima)) accionar();
    if (fase.requiere === 'continuar' && tiempoFase > fase.duracionMinima + 2 && !fase.reinicia) pidioContinuar = true;
  }

  sonido.actualizar(estado, vistaActual.lugar);
}

// Acciona la palanca de la etapa (desde el visor, el botón en pantalla o el teclado).
function accionar() {
  const fase = FASES[indiceFase];
  if (fase.id === 'descenso') {
    // Cierra una botella y guarda agua de esta profundidad.
    const i = muestraActiva();
    if (i < 0) return false;
    muestras[i] = true;
    palanca.components.palanca.activar();
    sonido.muestra();
    vibrar(0.8, 160);
    avisoMuestra = { hasta: reloj + 4.5, texto: `Muestra de agua tomada a ${formatear(estado.profundidad)} m` };
    return true;
  }
  if (cambiandoFase || fase.requiere !== 'palanca' || tiempoAccion !== null || tiempoFase < 1) return false;
  tiempoAccion = 0;
  palanca.components.palanca.activar();
  sonido.clic();
  if (fase.accion === 'soltar') setTimeout(() => sonido.chapuzon(), 950);
  if (fase.accion === 'focos') sonido.encenderFocos();
  if (fase.accion === 'carnada') sonido.soltarCarnada();
  if (fase.accion === 'lastre') sonido.golpe();
  return true;
}

function continuar() {
  pidioContinuar = true;
}

async function avanzarFase() {
  if (cambiandoFase || indiceFase >= FASES.length - 1) return;
  cambiandoFase = true;
  await mostrarFase(indiceFase + 1);
  cambiandoFase = false;
}

async function mostrarFase(indice) {
  const fase = FASES[indice];
  const vista = VISTAS[fase.vista];
  const cambiaLugar = vista.lugar !== vistaActual.lugar || indiceFase === 0;

  relato.classList.add('saliendo');
  if (cambiaLugar && indiceFase !== 0) await fundido(1);
  else await esperar(600);

  indiceFase = indice;
  tiempoFase = 0;
  tiempoAccion = null;
  pidioContinuar = false;

  if (cambiaLugar) {
    vistaActual = vista;
    colocarCamara(vista);
    mostrarLugar();
    await esperar(250);
    fundido(0);
  }

  if (fase.requiere === 'palanca') {
    palanca.setAttribute('palanca', 'etiqueta', fase.etiqueta);
    palanca.components.palanca.reiniciar();
  }
  indiceHito = -1;
  lugarActual = fase.lugar;
  textoActual = fase.texto;
  if (fase.reinicia) {
    // Ficha del descenso: lo que la persona hizo, al lado del hito real.
    const tomadas = muestras.filter(Boolean).length;
    lugarActual = 'De vuelta en la superficie';
    textoActual = `Bajaste a 8.000 metros, tomaste ${tomadas} de 3 muestras de agua y viste peces caracol, anfípodos gigantes e isópodos. ` + fase.texto;
  }
  $('relatoLugar').textContent = lugarActual;
  $('relatoTexto').textContent = textoActual;
  if (fase.id !== 'descenso') relato.classList.remove('saliendo');
  pintarPuntosFase();
  actualizarModo();
}

// Cambia el texto del relato durante el descenso.
async function mostrarHito(hito) {
  relato.classList.add('saliendo');
  lugarActual = '';
  textoActual = '';
  await esperar(650);
  if (FASES[indiceFase].id !== 'descenso' || HITOS[indiceHito] !== hito) return;
  lugarActual = hito.lugar;
  textoActual = hito.texto;
  $('relatoLugar').textContent = lugarActual;
  $('relatoTexto').textContent = textoActual;
  relato.classList.remove('saliendo');
  sonido.hito();
}

function reiniciar() {
  cambiandoFase = true;
  toco = false;
  muestras = [false, false, false];
  Object.assign(estado, { carnada: 0, caida: 0, chapuzon: 0, desdeFondo: 0, focos: 0, profundidad: 0, sumergible: 0, idoos: 0, pared: 0, foto: 0 });
  mostrarFase(1).then(() => (cambiandoFase = false));
}

// =====================================================================
// Cámara, fundidos y ambiente
// =====================================================================

// En pantalla la inclinación se aplica a la mirada (look-controls), no al rig:
// así la cámara gira sobre sí misma. En VR la mirada la controla el visor.
function reiniciarMirada(pitch = 0) {
  const mirada = camara.components['look-controls'];
  if (mirada && mirada.pitchObject && mirada.yawObject) {
    mirada.pitchObject.rotation.x = enVR ? 0 : aRadianes(pitch);
    mirada.yawObject.rotation.y = 0;
  }
}

function colocarCamara(vista) {
  rig.object3D.position.set(vista.pos[0], vista.pos[1] - 1.6, vista.pos[2]);
  rig.object3D.rotation.set(0, aRadianes(vista.yaw), 0);
  reiniciarMirada(vista.pitch);
}

function mostrarLugar() {
  const enSuperficie = vistaActual.lugar === 'superficie';
  $('superficie').object3D.visible = enSuperficie;
  $('profundidad').object3D.visible = !enSuperficie;
  estado.enSuperficie = enSuperficie;
}

async function fundido(objetivo) {
  telonObjetivo = objetivo;
  $('telon').classList.toggle('activo', objetivo > 0.5);
  await esperar(850);
}

function actualizarAmbiente(s) {
  estado.telon += (telonObjetivo - estado.telon) * Math.min(1, s * 4);
  U.uTiempo.value = reloj;
  U.uDesplazamiento.value += (estado.velocidad * 7 - 0.035) * s;
  U.uProfundidad.value = estado.profundidad;
  U.uLuzSol.value = estado.enSuperficie ? 1 : estado.luzSol;
  U.uFocos.value = estado.focos;
  const renderer = escena.renderer;
  if (renderer) U.uEscalaPuntos.value = enVR ? 1050 : renderer.domElement.clientHeight / (2 * Math.tan(aRadianes(36)));

  const niebla = escena.object3D.fog;
  const ambiente = $('luzAmbiente').getObject3D('light');
  const sol = $('luzSol').getObject3D('light');
  if (!niebla || !ambiente || !sol) return;

  if (estado.enSuperficie) {
    niebla.color.copy(COLOR_BRUMA);
    niebla.density = 0.0012;
    ambiente.intensity = 0.45;
    sol.intensity = 0.9;
    sol.color.copy(COLOR_SOL);
    escena.object3D.environmentIntensity = 0.8;
  } else {
    const p = estado.profundidad;
    let i = 0;
    while (i < COLORES_AGUA.length - 2 && p > COLORES_AGUA[i + 1][0]) i++;
    const [p0, c0] = COLORES_AGUA[i];
    const [p1, c1] = COLORES_AGUA[i + 1];
    colorAgua.copy(c0).lerp(c1, limitar((p - p0) / (p1 - p0)));
    niebla.color.copy(colorAgua);
    niebla.density = 0.05 + limitar(p / 2500) * 0.045;
    ambiente.intensity = 0.5 * estado.luzSol + 0.006;
    sol.intensity = 0.6 * estado.luzSol;
    sol.color.copy(COLOR_SOL_AGUA);
    escena.object3D.environmentIntensity = 0.02 + 0.25 * estado.luzSol;
  }
  U.uColorAgua.value.copy(niebla.color);
  U.uDensidad.value = niebla.density;
}

function vibrar(fuerza, ms) {
  const operador = escena.components['operador-vr'];
  if (enVR && operador) operador.vibrarTodas(fuerza, ms);
}

// =====================================================================
// Interfaz: VR y pantalla
// =====================================================================

function textoIndicacion() {
  const fase = FASES[indiceFase];
  if (cambiandoFase) return '';
  if (fase.id === 'descenso') {
    if (reloj < avisoMuestra.hasta) return avisoMuestra.texto;
    if (muestraActiva() >= 0) return enVR ? 'Empuja la palanca hacia ti para tomar una muestra de agua' : 'Puedes tomar una muestra de agua';
    if (estado.sumergible > 0) return 'Mira a tu derecha: el sumergible Limiting Factor';
    if (estado.idoos > 0.5) return 'A tu izquierda, una línea de sensores';
    if (estado.jibias > 1 && estado.jibias < 13) return 'Jibias: alúmbralas con la linterna';
    if (estado.profundidad > 280 && estado.profundidad < 1000) return 'Arriba, un banco de peces linterna';
    if (estado.profundidad > 1100 && estado.profundidad < 3800 && estado.bio > 0.3) return 'Alumbra una medusa y mira cómo responde';
    if (estado.profundidad > 4100 && estado.profundidad < 5300) return 'A tu derecha, en la ladera: peces granadero';
    if (estado.profundidad > 6000 && estado.profundidad < 6600) return 'Congrios de profundidad entre las rocas';
    return '';
  }
  if (fase.requiere === 'palanca') return tiempoAccion === null && enVR ? fase.indicacion : '';
  if (fase.requiere === 'continuar' && tiempoFase >= fase.duracionMinima) {
    const accion = fase.reinicia ? 'volver a empezar' : 'continuar';
    return enVR ? `Aprieta el gatillo o junta los dedos para ${accion}` : '';
  }
  return '';
}

function pintarInterfaz() {
  const fase = FASES[indiceFase];
  const p = estado.profundidad;
  const presion = 1 + p / 10;
  const indicacion = textoIndicacion();

  $('cifraProfundidad').textContent = formatear(p);
  $('cifraPresion').textContent = formatear(presion);
  $('tuboRelleno').style.height = `${(p / PROFUNDIDAD_FINAL) * 100}%`;
  if ($('indicacion').textContent !== indicacion) $('indicacion').textContent = indicacion;

  let etiqueta = '';
  if (!cambiandoFase) {
    if (fase.requiere === 'palanca' && tiempoAccion === null && tiempoFase >= 1) etiqueta = fase.botonPantalla;
    if (fase.requiere === 'continuar' && tiempoFase >= fase.duracionMinima) etiqueta = fase.reinicia ? 'Volver a empezar' : 'Continuar';
    if (muestraActiva() >= 0) etiqueta = 'Tomar muestra de agua';
  }
  const tomadas = muestras.filter(Boolean).length;
  $('cifraMuestras').textContent = tomadas;
  consola.object3D.visible = enVR && (fase.requiere === 'palanca' || muestraActiva() >= 0 || (fase.id === 'descenso' && reloj < avisoMuestra.hasta));
  $('aroPies').object3D.visible = enVR && !estado.enSuperficie;
  if (botonAccion.textContent !== etiqueta) botonAccion.textContent = etiqueta;
  botonAccion.classList.toggle('oculto', !etiqueta);
  $('ficha').style.opacity = estado.foto;

  const panel = panelVR.components['panel-relato'];
  if (panel && enVR) {
    panel.actualizar({
      lugar: cambiandoFase ? '' : lugarActual,
      texto: cambiandoFase ? '' : textoActual,
      indicacion,
      medidor: vistaActual.lugar === 'profundidad' ? `${formatear(p)} m  ·  ${formatear(presion)} atm  ·  muestras ${tomadas}/3` : '',
    });
  }
}

function pintarPuntosFase() {
  const lista = $('puntosFase');
  if (!lista.children.length) for (let i = 1; i < FASES.length; i++) lista.appendChild(document.createElement('li'));
  [...lista.children].forEach((punto, i) => {
    punto.classList.toggle('hecho', i + 1 < indiceFase);
    punto.classList.toggle('actual', i + 1 === indiceFase);
  });
}

function actualizarModo() {
  const fase = FASES[indiceFase];
  consola.object3D.visible = enVR && fase.requiere === 'palanca';
  panelVR.object3D.visible = enVR && indiceFase > 0;
  $('fichaVR').object3D.visible = enVR;
  actualizarLinterna();
}

// Con un control en la mano izquierda, la linterna va en esa mano; si no, va en la cabeza.
function actualizarLinterna() {
  const operador = escena.components['operador-vr'];
  const enMano = enVR && operador && operador.hayControl('left');
  $('linternaMano').object3D.visible = Boolean(enMano);
  $('linternaCabeza').object3D.visible = !enMano;
}

async function comenzar() {
  sonido.iniciar();
  $('portada').classList.add('oculto');
  hud.classList.remove('oculto');
  const faseInicial = limitar(parseInt(parametros.get('fase'), 10) || 1, 1, FASES.length - 1);
  if (faseInicial > 2) toco = true;
  cambiandoFase = true;
  await mostrarFase(faseInicial);
  tiempoFase = parseFloat(parametros.get('seg')) || 0; // para ensayar: empieza la etapa más adelante
  cambiandoFase = false;
}

async function prepararPortada() {
  const botonVR = $('botonVR');
  const aviso = $('avisoPortada');
  let compatible = false;
  try {
    compatible = Boolean(navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr')));
  } catch (error) {
    compatible = false;
  }
  botonVR.disabled = !compatible;
  aviso.textContent = compatible
    ? 'Ponte el visor. Puedes usar los controles o solo tus manos: empuja la palanca hacia ti.'
    : 'Para vivirla en realidad virtual, abre esta página en el navegador del Meta Quest.';

  botonVR.addEventListener('click', () => {
    sonido.iniciar();
    escena.enterVR();
    comenzar();
  });
  $('botonPantalla').addEventListener('click', comenzar);
  botonAccion.addEventListener('click', accionPantalla);
}

function accionPantalla() {
  const fase = FASES[indiceFase];
  if (fase.requiere === 'palanca' || fase.id === 'descenso') accionar();
  else continuar();
}

function prepararEventos() {
  const alCambiarModo = () => {
    enVR = escena.is('vr-mode');
    colocarCamara(vistaActual);
    actualizarModo();
  };
  escena.addEventListener('enter-vr', alCambiarModo);
  escena.addEventListener('exit-vr', alCambiarModo);
  // La palanca avisa cuando la persona la acciona con la mano.
  escena.addEventListener('palanca-activada', () => {
    if (FASES[indiceFase].id === 'descenso') {
      if (!accionar() && muestraActiva() >= 0) palanca.components.palanca.reiniciar();
    } else if (tiempoAccion === null && !accionar()) palanca.components.palanca.reiniciar();
  });
  escena.addEventListener('continuar', continuar);

  window.addEventListener('keydown', (evento) => {
    if (evento.repeat) return;
    if (evento.key === 'Enter' || evento.code === 'Space') {
      evento.preventDefault();
      if (indiceFase > 0) accionPantalla();
    } else if (evento.key.toLowerCase() === 'h') {
      hud.classList.toggle('sin-controles');
    } else if (evento.key === 'N' && evento.shiftKey) {
      avanzarFase(); // atajo para ensayar la presentación
    }
  });
}

// =====================================================================
// Inicio
// =====================================================================

function iniciar() {
  colocarCamara(vistaActual);
  mostrarLugar();
  prepararPortada();
  prepararEventos();
  actualizarModo();

  let anterior = performance.now();
  let proximaRevision = 0;
  // El bucle corre dentro del ciclo de A-Frame para funcionar también dentro del visor.
  AFRAME.registerComponent('bucle-fosa', {
    tick: () => {
      const ahora = performance.now();
      const s = Math.min((ahora - anterior) / 1000, 0.1);
      anterior = ahora;
      reloj += s;
      if (indiceFase > 0) {
        actualizarRelato(s);
        pintarInterfaz();
      }
      actualizarAmbiente(s);
      if (reloj > proximaRevision) {
        proximaRevision = reloj + 1;
        actualizarLinterna();
      }
    },
  });
  escena.setAttribute('bucle-fosa', '');

  window.fosa = { avanzarFase, accionar, continuar, estado, get fase() { return FASES[indiceFase].id; } };
}

if (escena.hasLoaded) iniciar();
else escena.addEventListener('loaded', iniciar);
