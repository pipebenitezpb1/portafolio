// Relato de "Fosa de Atacama · 8.000 metros bajo el Pacífico".
// La persona viaja dentro de un lander, el vehículo sin tripulación que usan los científicos
// para llegar al fondo de la fosa, y lo opera con sus manos.
//
// Fuentes (ver README): bases del concurso Chile Re-Descubre (2026); Emol (2018 y 2019) sobre
// la expedición Atacamex del Instituto Milenio de Oceanografía; Newcastle University y
// Marine Biodiversity (2022) sobre Paraliparis selti; WHOI y Systematics and Biodiversity
// (2024) sobre Dulcibella camanchaca.
//
// requiere:
//   'palanca'     la persona baja la palanca de la consola (accion indica qué hace)
//   'automatico'  la etapa avanza sola (el descenso)
//   'continuar'   avanza con el gatillo o con el botón Continuar

export const FASES = [
  { id: 'portada', vista: 'barco', lugar: '', texto: '', requiere: null, duracionMinima: 0 },
  {
    id: 'superficie',
    vista: 'barco',
    lugar: 'Océano Pacífico · frente a Antofagasta',
    texto:
      'Bajo estas aguas se abre la Fosa de Atacama, uno de los ambientes más extremos y ' +
      'desconocidos del planeta: alcanza profundidades cercanas a los 8.000 metros.',
    requiere: 'palanca',
    accion: 'soltar',
    etiqueta: 'SOLTAR EL LANDER',
    indicacion: 'Baja la palanca para soltar el lander',
    botonPantalla: 'Soltar el lander',
    duracionMinima: 6,
    segundosDespues: 2.2,
  },
  {
    id: 'descenso',
    vista: 'lander',
    lugar: 'Descenso',
    texto:
      'Viajas dentro de un lander: un vehículo sin tripulación que cae libre hasta el fondo ' +
      'con cámaras, luces y sensores. Mira a tu alrededor.',
    requiere: 'automatico',
    duracionDescenso: 50,
    duracionMinima: 0,
  },
  {
    id: 'fondo',
    vista: 'lander',
    lugar: 'Casi 8.000 metros',
    texto:
      'Llegaste al fondo de la fosa. La presión es unas 800 veces la de la superficie ' +
      'y aquí nunca ha llegado la luz del sol.',
    requiere: 'palanca',
    accion: 'focos',
    etiqueta: 'ENCENDER LOS FOCOS',
    indicacion: 'Baja la palanca para encender los focos',
    botonPantalla: 'Encender los focos',
    duracionMinima: 5,
    segundosDespues: 5,
  },
  {
    id: 'carnada',
    vista: 'lander',
    lugar: 'Zona hadal',
    texto:
      'Aquí abajo casi no hay alimento: lo que llega cae desde arriba como nieve marina. ' +
      'Por eso los científicos usan carnada para atraer a la vida que se esconde en la oscuridad.',
    requiere: 'palanca',
    accion: 'carnada',
    etiqueta: 'SOLTAR LA CARNADA',
    indicacion: 'Baja la palanca para soltar la carnada',
    botonPantalla: 'Soltar la carnada',
    duracionMinima: 6,
    segundosDespues: 14,
  },
  {
    id: 'especies',
    vista: 'lander',
    lugar: 'Especies nuevas para la ciencia',
    texto:
      'En la fosa viven especies que nadie conocía: el pez caracol azul Paraliparis selti ' +
      '(«selti» significa azul en kunza) y Dulcibella camanchaca, un crustáceo cazador ' +
      'hallado a 7.902 m y nombrado como la niebla del desierto.',
    requiere: 'continuar',
    duracionMinima: 10,
  },
  {
    id: 'final',
    vista: 'lander',
    lugar: 'Atacamex · 2018',
    texto:
      'En 2018, científicos chilenos del Instituto Milenio de Oceanografía llevaron por primera vez ' +
      'un lander a la parte más profunda de la fosa: 8.081 m frente a Antofagasta. Cada descenso ' +
      'revela cómo la vida resiste la presión, la oscuridad y la escasez.',
    requiere: 'continuar',
    duracionMinima: 6,
    reinicia: true,
  },
];

// Mensajes que aparecen al pasar por cada profundidad durante el descenso.
export const ZONAS = [
  { profundidad: 0, texto: 'Superficie' },
  { profundidad: 200, texto: '200 m · Aquí se acaba la luz del sol' },
  { profundidad: 1000, texto: '1.000 m · Oscuridad total: solo brillan los animales bioluminiscentes' },
  { profundidad: 4000, texto: '4.000 m · Zona abisal' },
  { profundidad: 6000, texto: '6.000 m · Zona hadal, por Hades, el inframundo griego' },
  { profundidad: 7000, texto: '7.000 m · Aquí cabría el Aconcagua completo' },
  { profundidad: 7900, texto: 'Llegando al fondo' },
];

export const PROFUNDIDAD_FINAL = 8000;

// Puntos de vista. "pos" es la posición de los ojos (en VR, la del suelo + la altura real de la persona).
export const VISTAS = {
  barco: { lugar: 'superficie', pos: [200, 1.6, 3.2], yaw: 0, pitch: 3 },
  lander: { lugar: 'profundidad', pos: [0, 1.6, 0], yaw: 0, pitch: -16 },
};
