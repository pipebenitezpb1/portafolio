// Paisaje sonoro generado en tiempo real con Web Audio (sin archivos de audio con derechos).
//   superficie: olas y viento
//   profundidad: rumor grave del océano, zumbido del lander, sonar y crujidos de la estructura
//   eventos: chapuzón al soltar el lander, golpe al tocar fondo, encendido de focos, clic de la palanca

export function crearSonido() {
  let contexto = null;
  let nodos = null;
  let ultimoCrujido = 0;

  const ganancia = (valor = 0) => {
    const g = contexto.createGain();
    g.gain.value = valor;
    return g;
  };
  const filtro = (tipo, frecuencia, q = 0.7) => {
    const f = contexto.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = frecuencia;
    f.Q.value = q;
    return f;
  };
  function ruido() {
    const buffer = contexto.createBuffer(1, contexto.sampleRate * 2, contexto.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    const fuente = contexto.createBufferSource();
    fuente.buffer = buffer;
    fuente.loop = true;
    return fuente;
  }

  function iniciar() {
    if (contexto) {
      contexto.resume();
      return;
    }
    contexto = new (window.AudioContext || window.webkitAudioContext)();
    const maestro = ganancia(0.9);
    maestro.connect(contexto.createDynamicsCompressor()).connect(contexto.destination);

    // Eco para el sonar.
    const eco = contexto.createDelay(1);
    eco.delayTime.value = 0.42;
    const retorno = ganancia(0.38);
    eco.connect(retorno).connect(eco);
    eco.connect(maestro);

    const fuenteRuido = ruido();
    const gananciaOlas = ganancia();
    const filtroOlas = filtro('lowpass', 700);
    fuenteRuido.connect(filtroOlas).connect(gananciaOlas).connect(maestro);
    const gananciaRumor = ganancia();
    fuenteRuido.connect(filtro('lowpass', 110)).connect(gananciaRumor).connect(maestro);

    const zumbido = contexto.createOscillator();
    zumbido.frequency.value = 58;
    const gananciaZumbido = ganancia();
    zumbido.connect(filtro('lowpass', 300)).connect(gananciaZumbido).connect(maestro);

    fuenteRuido.start();
    zumbido.start();
    nodos = { maestro, eco, gananciaOlas, filtroOlas, gananciaRumor, gananciaZumbido };
  }

  function tono({ frecuencia, final = frecuencia, duracion = 0.3, volumen = 0.1, tipo = 'sine', destino = 'maestro', ataque = 0.005 }) {
    if (!contexto) return;
    const t = contexto.currentTime;
    const osc = contexto.createOscillator();
    const g = ganancia(0);
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(final, 1), t + duracion);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(g).connect(nodos.maestro);
    if (destino === 'eco') g.connect(nodos.eco);
    osc.start(t);
    osc.stop(t + duracion + 0.05);
  }

  function rafaga({ duracion = 0.6, volumen = 0.3, frecuencia = 800, tipo = 'lowpass' }) {
    if (!contexto) return;
    const t = contexto.currentTime;
    const fuente = ruido();
    const g = ganancia(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    fuente.connect(filtro(tipo, frecuencia)).connect(g).connect(nodos.maestro);
    fuente.start(t);
    fuente.stop(t + duracion + 0.05);
  }

  const sonar = () => tono({ frecuencia: 1480, final: 1420, duracion: 0.9, volumen: 0.07, destino: 'eco' });
  const clic = () => tono({ frecuencia: 2200, final: 900, duracion: 0.06, volumen: 0.12, tipo: 'square' });
  const chapuzon = () => rafaga({ duracion: 1.6, volumen: 0.5, frecuencia: 1200 });
  const golpe = () => {
    tono({ frecuencia: 70, final: 35, duracion: 0.9, volumen: 0.5 });
    rafaga({ duracion: 1.2, volumen: 0.25, frecuencia: 300 });
  };
  const encenderFocos = () => {
    tono({ frecuencia: 120, final: 60, duracion: 0.25, volumen: 0.2, tipo: 'square' });
    tono({ frecuencia: 880, final: 1760, duracion: 0.5, volumen: 0.04 });
  };
  const soltarCarnada = () => {
    tono({ frecuencia: 300, final: 180, duracion: 0.2, volumen: 0.15, tipo: 'triangle' });
    rafaga({ duracion: 0.8, volumen: 0.1, frecuencia: 600, tipo: 'bandpass' });
  };

  function crujido(intensidad) {
    // Gemido metálico de la estructura por la presión.
    tono({ frecuencia: 180 + Math.random() * 120, final: 90 + Math.random() * 40, duracion: 1.4, volumen: 0.03 + intensidad * 0.05, tipo: 'sawtooth', ataque: 0.3 });
  }

  function actualizar(estado, lugar) {
    if (!contexto) return;
    const t = contexto.currentTime;
    const enSuperficie = lugar === 'superficie';
    nodos.gananciaOlas.gain.setTargetAtTime(enSuperficie ? 0.22 + Math.sin(t * 0.7) * 0.06 : 0, t, 0.3);
    nodos.gananciaRumor.gain.setTargetAtTime(enSuperficie ? 0.04 : 0.22, t, 0.5);
    nodos.gananciaZumbido.gain.setTargetAtTime(enSuperficie ? 0 : 0.025 + estado.focos * 0.02, t, 0.5);

    const presion = estado.profundidad / 8000;
    if (!enSuperficie && presion > 0.35 && t - ultimoCrujido > 7 - presion * 4 + Math.random() * 3) {
      ultimoCrujido = t;
      crujido(presion);
    }
  }

  return { iniciar, actualizar, sonar, clic, chapuzon, golpe, encenderFocos, soltarCarnada };
}
