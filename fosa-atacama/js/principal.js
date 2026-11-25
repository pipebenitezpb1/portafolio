// Lógica principal: avance del relato, descenso, ambiente según la profundidad,
// modo VR (Meta Quest) y modo en pantalla.

import { FASES, ZONAS, PROFUNDIDAD_FINAL, VISTAS } from './narrativa.js';
import { crearSonido } from './sonido.js';

const estado = window.FOSA;
const THREE = AFRAME.THREE;
const $ = (id) => document.getElementById(id);
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
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

const sinSonido = { iniciar() {}, actualizar() {}, sonar() {}, clic() {}, chapuzon() {}, golpe() {}, encenderFocos() {}, soltarCarnada() {} };
const sonido = parametros.has('silencio') ? sinSonido : crearSonido();
const modoDemo = parametros.has('demo');

let indiceFase = 0;
let tiempoFase = 0;
let tiempoAccion = null; // segundos desde que se bajó la palanca de la etapa
let pidioContinuar = false;
let cambiandoFase = false;
let enVR = false;
let vistaActual = VISTAS.barco;
let telonObjetivo = 0;
let proximoSonar = 0;
let toco = false;

const colorAgua = new THREE.Color();
const COLORES_AGUA = [
  [0, new THREE.Color('#0f4f73')],
  [250, new THREE.Color('#06263d')],
  [1000, new THREE.Color('#020b14')],
  [3000, new THREE.Color('#000000')],
];

// =====================================================================
// Relato
// =====================================================================

function actualizarRelato(s) {
  const fase = FASES[indiceFase];
  tiempoFase += s;
  if (tiempoAccion !== null) tiempoAccion += s;

  // --- Descenso y profundidad ---
  if (fase.id === 'superficie') {
    estado.profundidad = 0;
    estado.caida = tiempoAccion === null ? 0 : limitar(tiempoAccion / 1.3);
  } else if (fase.id === 'descenso') {
    const k = limitar(tiempoFase / fase.duracionDescenso);
    estado.profundidad = PROFUNDIDAD_FINAL * (0.5 - Math.cos(Math.PI * k) / 2);
    estado.velocidad = Math.sin(Math.PI * k) * 0.9 + 0.1 * (k < 1 ? 1 : 0);
    if (k >= 1 && !cambiandoFase) avanzarFase();
  } else {
    estado.profundidad = PROFUNDIDAD_FINAL;
    estado.velocidad = 0;
  }

  const p = estado.profundidad;
  const enProfundidad = vistaActual.lugar === 'profundidad';
  estado.alturaSuelo = !enProfundidad ? -60 : p > 7700 ? -(PROFUNDIDAD_FINAL - p) * 0.12 - 0.15 : -60;
  estado.luzSol = enProfundidad ? Math.pow(limitar(1 - p / 260), 1.5) : 1;
  estado.bio = enProfundidad ? limitar((p - 250) / 400) * limitar((5800 - p) / 1500) : 0;
  estado.linterna = enProfundidad ? limitar((p - 80) / 300) : 0;

  // Contacto con el fondo.
  if (fase.id === 'descenso' && p > PROFUNDIDAD_FINAL - 5 && !toco) {
    toco = true;
    sonido.golpe();
    vibrar(1, 350);
  }

  // Sonar y vibración que crecen con la presión.
  if (enProfundidad && reloj > proximoSonar) {
    proximoSonar = reloj + 4.5;
    sonido.sonar();
    if (fase.id === 'descenso') vibrar(0.08 + (p / PROFUNDIDAD_FINAL) * 0.5, 70);
  }

  // --- Focos y carnada ---
  const despuesDe = (id) => FASES.findIndex((f) => f.id === id) < indiceFase;
  if (fase.id === 'fondo' && tiempoAccion !== null) {
    const encendido = limitar(tiempoAccion / 0.9);
    estado.focos = encendido < 1 ? encendido * (Math.random() > 0.3 ? 1 : 0.2) : 1;
  } else {
    estado.focos = despuesDe('fondo') ? 1 : 0;
  }
  if (fase.id === 'carnada' && tiempoAccion !== null) estado.carnada = tiempoAccion + 0.001;
  else if (despuesDe('carnada')) estado.carnada += s;
  else estado.carnada = 0;

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

  // --- Modo demo para grabar en pantalla ---
  if (modoDemo && !cambiandoFase) {
    if (fase.requiere === 'palanca' && tiempoAccion === null && tiempoFase > Math.min(4, fase.duracionMinima)) bajarPalanca();
    if (fase.requiere === 'continuar' && tiempoFase > fase.duracionMinima + 2 && !fase.reinicia) pidioContinuar = true;
  }

  sonido.actualizar(estado, vistaActual.lugar);
}

function bajarPalanca() {
  const fase = FASES[indiceFase];
  if (cambiandoFase || fase.requiere !== 'palanca' || tiempoAccion !== null || tiempoFase < 1) return;
  tiempoAccion = 0;
  palanca.components.palanca.activar();
  sonido.clic();
  if (fase.accion === 'soltar') setTimeout(() => sonido.chapuzon(), 1100);
  if (fase.accion === 'focos') sonido.encenderFocos();
  if (fase.accion === 'carnada') sonido.soltarCarnada();
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
  const cambiaLugar = vista.lugar !== vistaActual.lugar;

  relato.classList.add('saliendo');
  if (cambiaLugar) {
    await fundido(1);
  } else {
    await esperar(600);
  }

  indiceFase = indice;
  tiempoFase = 0;
  tiempoAccion = null;
  pidioContinuar = false;

  if (cambiaLugar) {
    colocarCamara(vista);
    vistaActual = vista;
    await esperar(200);
    fundido(0);
  }

  if (fase.requiere === 'palanca') {
    palanca.setAttribute('palanca', 'etiqueta', fase.etiqueta);
    palanca.components.palanca.reiniciar();
  }
  $('relatoLugar').textContent = fase.lugar;
  $('relatoTexto').textContent = fase.texto;
  relato.classList.remove('saliendo');
  pintarPuntosFase();
  actualizarModo();
}

function reiniciar() {
  cambiandoFase = true;
  toco = false;
  estado.carnada = 0;
  estado.caida = 0;
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

async function fundido(objetivo) {
  telonObjetivo = objetivo;
  $('telon').classList.toggle('activo', objetivo > 0.5);
  await esperar(850);
}

function actualizarAmbiente(s) {
  estado.telon += (telonObjetivo - estado.telon) * Math.min(1, s * 4);

  const niebla = escena.object3D.fog;
  const fondo = escena.object3D.background;
  const ambiente = $('luzAmbiente').getObject3D('light');
  const sol = $('luzSol').getObject3D('light');
  if (!niebla || !ambiente || !sol) return;

  if (vistaActual.lugar === 'superficie') {
    colorAgua.set('#0a1424');
    niebla.density = 0.006;
    ambiente.intensity = 0.5;
    sol.intensity = 0.5;
  } else {
    const p = estado.profundidad;
    let i = 0;
    while (i < COLORES_AGUA.length - 2 && p > COLORES_AGUA[i + 1][0]) i++;
    const [p0, c0] = COLORES_AGUA[i];
    const [p1, c1] = COLORES_AGUA[i + 1];
    colorAgua.copy(c0).lerp(c1, limitar((p - p0) / (p1 - p0)));
    niebla.density = 0.055 + limitar(p / 3000) * 0.05;
    ambiente.intensity = 0.55 * estado.luzSol + 0.035;
    sol.intensity = 0.8 * estado.luzSol;
  }
  niebla.color.copy(colorAgua);
  if (fondo && fondo.isColor) fondo.copy(colorAgua);
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
    let zona = ZONAS[0];
    ZONAS.forEach((z) => {
      if (estado.profundidad >= z.profundidad) zona = z;
    });
    return zona.texto;
  }
  if (fase.requiere === 'palanca') return tiempoAccion === null ? (enVR ? fase.indicacion : '') : '';
  if (fase.requiere === 'continuar' && tiempoFase >= fase.duracionMinima) {
    const accion = fase.reinicia ? 'volver a empezar' : 'continuar';
    return enVR ? `Aprieta el gatillo para ${accion}` : '';
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

  // Botón de acción en pantalla.
  let etiqueta = '';
  if (!cambiandoFase) {
    if (fase.requiere === 'palanca' && tiempoAccion === null && tiempoFase >= 1) etiqueta = fase.botonPantalla;
    if (fase.requiere === 'continuar' && tiempoFase >= fase.duracionMinima) etiqueta = fase.reinicia ? 'Volver a empezar' : 'Continuar';
  }
  botonAccion.textContent = etiqueta;
  botonAccion.classList.toggle('oculto', !etiqueta);

  // Panel dentro de la escena (solo se ve en VR).
  const panel = panelVR.components['panel-relato'];
  if (panel && enVR) {
    panel.actualizar({
      lugar: cambiandoFase ? '' : fase.lugar,
      texto: cambiandoFase ? '' : fase.texto,
      indicacion,
      medidor: vistaActual.lugar === 'profundidad' ? `${formatear(p)} m  ·  ${formatear(presion)} atm` : '',
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
  consola.setAttribute('visible', enVR && fase.requiere === 'palanca');
  panelVR.setAttribute('visible', enVR && indiceFase > 0);
  $('linternaMano').setAttribute('visible', enVR);
  $('linternaPantalla').setAttribute('visible', !enVR);
}

async function comenzar() {
  sonido.iniciar();
  $('portada').classList.add('oculto');
  hud.classList.remove('oculto');
  const faseInicial = limitar(parseInt(parametros.get('fase'), 10) || 1, 1, FASES.length - 1);
  cambiandoFase = true;
  await mostrarFase(faseInicial);
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
    ? 'Ponte el visor y usa los dos controles: agarra la palanca con el gatillo.'
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
  if (fase.requiere === 'palanca') bajarPalanca();
  else continuar();
}

function prepararEventos() {
  escena.addEventListener('enter-vr', () => {
    enVR = escena.is('vr-mode');
    colocarCamara(vistaActual);
    actualizarModo();
  });
  escena.addEventListener('exit-vr', () => {
    enVR = false;
    colocarCamara(vistaActual);
    actualizarModo();
  });
  escena.addEventListener('palanca-activada', () => {
    if (tiempoAccion === null) bajarPalanca();
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

let reloj = 0;

function iniciar() {
  colocarCamara(vistaActual);
  prepararPortada();
  prepararEventos();
  actualizarModo();

  let anterior = performance.now();
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
    },
  });
  escena.setAttribute('bucle-fosa', '');

  window.fosa = { avanzarFase, bajarPalanca, continuar, estado, get fase() { return FASES[indiceFase].id; } };
}

if (escena.hasLoaded) iniciar();
else escena.addEventListener('loaded', iniciar);
