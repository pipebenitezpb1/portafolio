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
    texto: 'Bajo estas aguas se abre la Fosa de Atacama: casi 8.000 metros, uno de los lugares más extremos del planeta.',
    requiere: 'palanca',
    accion: 'soltar',
    etiqueta: 'SOLTAR EL LANDER',
    indicacion: 'Empuja la palanca hacia ti para soltar el lander',
    botonPantalla: 'Soltar el lander',
    duracionMinima: 6,
    segundosDespues: 2.6,
  },
  {
    id: 'descenso',
    vista: 'lander',
    lugar: 'Descenso',
    texto: '',
    requiere: 'automatico',
    duracionMinima: 0,
  },
  {
    id: 'fondo',
    vista: 'lander',
    lugar: 'Casi 8.000 metros',
    texto: 'El fondo de la fosa. La presión es 800 veces la de la superficie y nunca ha llegado la luz del sol.',
    requiere: 'palanca',
    accion: 'focos',
    etiqueta: 'ENCENDER LOS FOCOS',
    indicacion: 'Empuja la palanca hacia ti para encender los focos',
    botonPantalla: 'Encender los focos',
    duracionMinima: 5,
    segundosDespues: 5,
  },
  {
    id: 'carnada',
    vista: 'lander',
    lugar: 'Zona hadal',
    texto: 'Aquí casi no llega alimento. Por eso los científicos ponen carnada frente a las cámaras.',
    requiere: 'palanca',
    accion: 'carnada',
    etiqueta: 'BAJAR LA CARNADA',
    indicacion: 'Empuja la palanca hacia ti para bajar la carnada',
    botonPantalla: 'Bajar la carnada',
    duracionMinima: 6,
    segundosDespues: 19,
  },
  {
    id: 'especies',
    vista: 'lander',
    lugar: 'Especies nuevas para la ciencia',
    texto:
      'El anfípodo gigante Eurythenes atacamensis, de 8 centímetros. El pez caracol azul Paraliparis selti. ' +
      'Y Dulcibella camanchaca, un cazador hallado a 7.902 metros.',
    requiere: 'continuar',
    duracionMinima: 10,
  },
  {
    id: 'ascenso',
    vista: 'lander',
    lugar: 'El regreso',
    texto: 'Para volver, el lander suelta su lastre y sube solo, impulsado por sus esferas de vidrio.',
    requiere: 'palanca',
    accion: 'lastre',
    etiqueta: 'SOLTAR EL LASTRE',
    indicacion: 'Empuja la palanca hacia ti para soltar el lastre',
    botonPantalla: 'Soltar el lastre',
    duracionMinima: 5,
    segundosDespues: 27,
  },
  {
    id: 'final',
    vista: 'barco',
    lugar: 'Expediciones chilenas · desde 2018',
    texto: 'En 2018, el Audacia tocó por primera vez el punto más profundo de la fosa: 8.081 metros. Cada descenso trae algo que nadie había visto.',
    requiere: 'continuar',
    duracionMinima: 8,
    reinicia: true,
  },
];

// El descenso, hito por hito. "t" es el segundo en que empieza cada hito y "profundidad" la
// que marca el medidor en ese momento; entre hitos la profundidad avanza de forma pareja.
// evento: 'sumergible' hace aparecer el Limiting Factor; 'idoos', la línea de sensores.
export const HITOS = [
  { t: 0, profundidad: 0, lugar: 'Descenso', texto: 'Acompañas al lander Audacia, que cae libre hacia el fondo. Apunta la linterna a lo que veas.' },
  { t: 11, profundidad: 200, lugar: '200 metros', texto: 'Se acaba la luz del sol. Aquí casi no hay oxígeno: es la zona de mínimo de oxígeno del norte de Chile.' },
  { t: 22, profundidad: 1000, lugar: '1.000 metros · Zona de medianoche', texto: 'La única luz es la de los propios animales.' },
  { t: 34, profundidad: 4000, lugar: '4.000 metros · Zona abisal', texto: 'Aparece la ladera de la fosa. Aquí las cámaras registraron peces granadero.' },
  { t: 46, profundidad: 5400, lugar: '21 de enero de 2022', texto: 'Osvaldo Ulloa y Victor Vescovo bajan en el sumergible Limiting Factor: los primeros humanos en el fondo de la fosa.', evento: 'sumergible', foto: true },
  { t: 63, profundidad: 6000, lugar: '6.000 metros · Zona hadal', texto: 'Solo las fosas llegan tan hondo. Entre las rocas nadan congrios de profundidad.' },
  { t: 75, profundidad: 7000, lugar: 'Observatorio IDOOS · desde 2023', texto: 'Líneas de sensores chilenos miden el océano profundo y cómo se deforma la placa.', evento: 'idoos' },
  { t: 90, profundidad: 7700, lugar: 'Llegando al fondo', texto: 'El Aconcagua cabría completo aquí, y sobraría agua.' },
  { t: 100, profundidad: 8000, fin: true },
];

export const PROFUNDIDAD_FINAL = 8000;

// Puntos de vista. "pos" es la posición de los ojos (en VR, la del suelo + la altura real de la persona).
export const VISTAS = {
  barco: { lugar: 'superficie', pos: [200, 1.6, 1.6], yaw: 0, pitch: 7 },
  lander: { lugar: 'profundidad', pos: [0, 1.6, 0.15], yaw: 0, pitch: -28 },
};
