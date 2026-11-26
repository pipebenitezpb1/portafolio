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
    texto:
      'Llegaste al fondo de la fosa. La presión es unas 800 veces la de la superficie ' +
      'y aquí nunca ha llegado la luz del sol.',
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
    texto:
      'Aquí abajo casi no hay alimento: lo que llega cae desde arriba como nieve marina. ' +
      'Por eso los científicos ponen carnada frente a las cámaras: atrae a la vida que se esconde en la oscuridad.',
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
      'En la fosa viven especies que nadie conocía: el pez caracol azul Paraliparis selti ' +
      '(«selti» significa azul en kunza) y Dulcibella camanchaca, un crustáceo cazador ' +
      'hallado a 7.902 m y nombrado como la niebla del desierto.',
    requiere: 'continuar',
    duracionMinima: 10,
  },
  {
    id: 'final',
    vista: 'lander',
    lugar: 'Expediciones chilenas · desde 2018',
    texto:
      'En 2018, la expedición Atacamex llevó el lander Audacia a 8.081 metros, la primera vez que la ciencia ' +
      'chilena tocó el punto más profundo de la fosa. Desde entonces, cada descenso revela cómo la vida ' +
      'resiste la presión, la oscuridad y la escasez.',
    requiere: 'continuar',
    duracionMinima: 6,
    reinicia: true,
  },
];

// El descenso, hito por hito. "t" es el segundo en que empieza cada hito y "profundidad" la
// que marca el medidor en ese momento; entre hitos la profundidad avanza de forma pareja.
// evento: 'sumergible' hace aparecer el Limiting Factor; 'idoos', la línea de sensores.
export const HITOS = [
  {
    t: 0,
    profundidad: 0,
    lugar: 'Descenso',
    texto: 'Acompañas a un lander: un vehículo sin tripulación que cae libre hasta el fondo con cámaras, luces y sensores. Mira a tu alrededor.',
  },
  {
    t: 11,
    profundidad: 200,
    lugar: '200 metros',
    texto: 'Aquí se acaba la luz del sol. Desde este punto, el océano está siempre a oscuras.',
  },
  {
    t: 22,
    profundidad: 1000,
    lugar: '1.000 metros · Zona de medianoche',
    texto: 'La única luz es la que producen los propios animales: la bioluminiscencia.',
  },
  {
    t: 34,
    profundidad: 4000,
    lugar: '4.000 metros · Zona abisal',
    texto: 'El agua está cerca de los 2 °C y la presión supera las 400 atmósferas. La mayor parte del fondo de los océanos está a esta profundidad; la fosa sigue bajando.',
  },
  {
    t: 46,
    profundidad: 5400,
    lugar: '21 de enero de 2022',
    texto: 'Por aquí bajaron los primeros seres humanos: Osvaldo Ulloa, del Instituto Milenio de Oceanografía, y el explorador Victor Vescovo llegaron a 8.069 metros en el sumergible Limiting Factor.',
    evento: 'sumergible',
    foto: true,
  },
  {
    t: 63,
    profundidad: 6000,
    lugar: '6.000 metros · Zona hadal',
    texto: 'Bajo los 6.000 metros solo quedan las fosas. Su nombre viene de Hades, el inframundo griego. Las paredes de la Fosa de Atacama se cierran a tu alrededor.',
  },
  {
    t: 75,
    profundidad: 7000,
    lugar: 'Observatorio IDOOS · desde 2023',
    texto: 'Chile instaló en la fosa su primer observatorio del océano profundo: líneas de sensores que miden corrientes, temperatura, salinidad y oxígeno, y sensores de presión en el fondo que registran cómo se deforma la placa.',
    evento: 'idoos',
  },
  {
    t: 90,
    profundidad: 7700,
    lugar: 'Llegando al fondo',
    texto: 'A esta profundidad cabría el Aconcagua completo, y todavía quedaría agua encima.',
  },
  { t: 100, profundidad: 8000, fin: true },
];

export const PROFUNDIDAD_FINAL = 8000;

// Puntos de vista. "pos" es la posición de los ojos (en VR, la del suelo + la altura real de la persona).
export const VISTAS = {
  barco: { lugar: 'superficie', pos: [200, 1.6, 1.6], yaw: 0, pitch: 7 },
  lander: { lugar: 'profundidad', pos: [0, 1.6, 0.15], yaw: 0, pitch: -28 },
};
