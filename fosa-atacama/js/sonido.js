// Banda sonora y efectos generados en tiempo real con Web Audio: no usa archivos de audio,
// así que no hay música ni sonidos con derechos de terceros.
//
// Música: un colchón de acordes lentos con reverberación y notas sueltas tipo campana.
//   El acorde cambia con el momento del relato: amanecer, azul, descenso, abismo, oscuridad y vida.
// Ambiente: olas y viento arriba; bajo el agua, un rumor grave, el zumbido del lander,
//   sonar con eco y crujidos de la estructura que aumentan con la presión.
// Efectos: palanca, chapuzón y burbujas, paso del sumergible, golpe en el fondo, focos y carnada.

const NOTA = (semitonosDesdeLa4) => 440 * Math.pow(2, semitonosDesdeLa4 / 12);

// Acordes (en semitonos respecto de La4) y notas para las campanas de cada momento.
const MOMENTOS = {
  amanecer: { acorde: [-31, -24, -17, -14], campanas: [-5, -2, 0, 2, 5, 7], brillo: 1500, volumen: 1.0 }, // Re con novena
  azul: { acorde: [-31, -24, -19, -12], campanas: [-7, -5, 0, 2, 5], brillo: 1100, volumen: 0.95 }, // Re menor
  descenso: { acorde: [-33, -26, -21, -14], campanas: [-9, -7, -2, 0, 3], brillo: 800, volumen: 0.9 }, // Do menor
  abismo: { acorde: [-35, -28, -23, -20], campanas: [-11, -9, -4, -2], brillo: 520, volumen: 0.85 }, // Si bemol menor
  oscuridad: { acorde: [-36, -29, -24, -21], campanas: [], brillo: 300, volumen: 0.45 },
  vida: { acorde: [-28, -21, -17, -12], campanas: [-4, -2, 0, 3, 5, 7, 10], brillo: 1300, volumen: 1.0 }, // Fa mayor con séptima
};

export function crearSonido() {
  let ctx = null;
  let n = null; // nodos
  let momentoActual = '';
  let ultimoCrujido = 0;
  let proximaCampana = 0;
  let enAgua = false;

  const ganancia = (valor = 0) => {
    const g = ctx.createGain();
    g.gain.value = valor;
    return g;
  };
  const filtro = (tipo, frecuencia, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = frecuencia;
    f.Q.value = q;
    return f;
  };
  function ruido(segundos = 2) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * segundos, ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.loop = true;
    return fuente;
  }
  // Reverberación: una respuesta de sala hecha con ruido que se apaga.
  function crearReverberacion(segundos) {
    const largo = ctx.sampleRate * segundos;
    const impulso = ctx.createBuffer(2, largo, ctx.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const datos = impulso.getChannelData(canal);
      let previo = 0;
      for (let i = 0; i < largo; i++) {
        const t = i / largo;
        const blanco = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
        previo = previo * 0.55 + blanco * 0.45; // un poco más oscura
        datos[i] = previo;
      }
    }
    const convolucion = ctx.createConvolver();
    convolucion.buffer = impulso;
    return convolucion;
  }

  function iniciar() {
    if (ctx) {
      ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const maestro = ganancia(0.85);
    const compresor = ctx.createDynamicsCompressor();
    compresor.threshold.value = -16;
    compresor.ratio.value = 3;
    maestro.connect(compresor).connect(ctx.destination);

    const reverberacion = crearReverberacion(4.2);
    const retornoReverb = ganancia(0.55);
    reverberacion.connect(retornoReverb).connect(maestro);

    // --- Música: colchón de cuatro voces ---
    const filtroColchon = filtro('lowpass', 900, 0.4);
    const gananciaColchon = ganancia(0);
    filtroColchon.connect(gananciaColchon);
    gananciaColchon.connect(maestro);
    gananciaColchon.connect(reverberacion);
    const voces = [];
    for (let i = 0; i < 4; i++) {
      const osciladores = [-6, 6].map((desafinacion) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sawtooth';
        o.detune.value = desafinacion + (Math.random() - 0.5) * 4;
        o.frequency.value = 110;
        return o;
      });
      const g = ganancia(i === 0 ? 0.5 : 0.22);
      // Cada voz respira a su propio ritmo.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.023;
      const profundidadLfo = ganancia(0.09);
      lfo.connect(profundidadLfo).connect(g.gain);
      osciladores.forEach((o) => {
        o.connect(g);
        o.start();
      });
      lfo.start();
      g.connect(filtroColchon);
      voces.push(osciladores);
    }
    // Bajo profundo que crece con la profundidad.
    const subgrave = ctx.createOscillator();
    subgrave.frequency.value = 41;
    const gananciaSubgrave = ganancia(0);
    subgrave.connect(gananciaSubgrave).connect(maestro);
    subgrave.start();

    // --- Ambiente ---
    const fuenteRuido = ruido();
    const gananciaOlas = ganancia();
    fuenteRuido.connect(filtro('lowpass', 650)).connect(gananciaOlas).connect(maestro);
    const gananciaViento = ganancia();
    const filtroViento = filtro('bandpass', 420, 0.6);
    fuenteRuido.connect(filtroViento).connect(gananciaViento).connect(maestro);
    const gananciaRumor = ganancia();
    fuenteRuido.connect(filtro('lowpass', 95)).connect(gananciaRumor).connect(maestro);
    const gananciaFlujo = ganancia();
    fuenteRuido.connect(filtro('bandpass', 260, 0.8)).connect(gananciaFlujo).connect(maestro);

    const zumbido = ctx.createOscillator();
    zumbido.frequency.value = 58;
    const gananciaZumbido = ganancia();
    zumbido.connect(filtro('lowpass', 260)).connect(gananciaZumbido).connect(maestro);

    // Propulsores del sumergible.
    const gananciaSub = ganancia();
    const filtroSub = filtro('bandpass', 520, 1.6);
    fuenteRuido.connect(filtroSub).connect(gananciaSub);
    const motorSub = ctx.createOscillator();
    motorSub.type = 'sawtooth';
    motorSub.frequency.value = 86;
    motorSub.connect(filtro('lowpass', 340)).connect(gananciaSub);
    gananciaSub.connect(maestro);
    gananciaSub.connect(reverberacion);

    fuenteRuido.start();
    zumbido.start();
    motorSub.start();

    n = { maestro, reverberacion, filtroColchon, gananciaColchon, voces, gananciaSubgrave, gananciaOlas, gananciaViento, filtroViento, gananciaRumor, gananciaFlujo, gananciaZumbido, gananciaSub, filtroSub };
  }

  // ---------- Herramientas para efectos ----------
  function tono({ frecuencia, final = frecuencia, duracion = 0.3, volumen = 0.1, tipo = 'sine', ataque = 0.005, reverb = 0, retraso = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + retraso;
    const osc = ctx.createOscillator();
    const g = ganancia(0);
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(final, 1), t + duracion);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(g);
    g.connect(n.maestro);
    if (reverb > 0) {
      const envio = ganancia(reverb);
      g.connect(envio).connect(n.reverberacion);
    }
    osc.start(t);
    osc.stop(t + duracion + 0.05);
  }

  function rafaga({ duracion = 0.6, volumen = 0.3, frecuencia = 800, tipo = 'lowpass', q = 0.7, reverb = 0, retraso = 0, barrido = 0 }) {
    if (!ctx) return;
    const t = ctx.currentTime + retraso;
    const fuente = ruido(Math.min(duracion + 0.2, 3));
    const f = filtro(tipo, frecuencia, q);
    if (barrido) f.frequency.exponentialRampToValueAtTime(barrido, t + duracion);
    const g = ganancia(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    fuente.connect(f).connect(g);
    g.connect(n.maestro);
    if (reverb > 0) {
      const envio = ganancia(reverb);
      g.connect(envio).connect(n.reverberacion);
    }
    fuente.start(t);
    fuente.stop(t + duracion + 0.1);
  }

  // ---------- Música ----------
  function cambiarMomento(nombre) {
    if (!ctx || nombre === momentoActual) return;
    momentoActual = nombre;
    const m = MOMENTOS[nombre];
    const t = ctx.currentTime;
    n.voces.forEach((osciladores, i) => {
      const frecuencia = NOTA(m.acorde[i]);
      osciladores.forEach((o) => o.frequency.setTargetAtTime(frecuencia, t, 1.8));
    });
    n.filtroColchon.frequency.setTargetAtTime(m.brillo, t, 2.5);
    n.gananciaColchon.gain.setTargetAtTime(0.085 * m.volumen, t, 2.5);
    proximaCampana = t + 2.5;
  }

  function campana() {
    const m = MOMENTOS[momentoActual];
    if (!m || !m.campanas.length) return;
    const semitono = m.campanas[Math.floor(Math.random() * m.campanas.length)] + (Math.random() < 0.3 ? 12 : 0);
    const frecuencia = NOTA(semitono);
    tono({ frecuencia, duracion: 4.5, volumen: 0.035, ataque: 0.02, reverb: 0.9 });
    tono({ frecuencia: frecuencia * 2.01, duracion: 2.2, volumen: 0.01, ataque: 0.01, reverb: 0.9 });
  }

  // ---------- Efectos ----------
  const sonar = () => {
    tono({ frecuencia: 1480, final: 1440, duracion: 1.1, volumen: 0.05, reverb: 1.2 });
    tono({ frecuencia: 1480, final: 1440, duracion: 0.7, volumen: 0.012, reverb: 1.0, retraso: 0.62 });
  };
  const clic = () => {
    rafaga({ duracion: 0.07, volumen: 0.35, frecuencia: 2400, tipo: 'bandpass', q: 2 });
    tono({ frecuencia: 190, final: 70, duracion: 0.16, volumen: 0.3, tipo: 'triangle' });
    tono({ frecuencia: 950, final: 420, duracion: 0.05, volumen: 0.1, tipo: 'square', retraso: 0.09 });
  };
  const chapuzon = () => {
    rafaga({ duracion: 1.9, volumen: 0.55, frecuencia: 2600, barrido: 300, reverb: 0.2 });
    tono({ frecuencia: 95, final: 38, duracion: 1.1, volumen: 0.4 });
    // Burbujas que suben después del impacto.
    for (let i = 0; i < 26; i++) {
      const f = 380 + Math.random() * 900;
      tono({ frecuencia: f, final: f * (1.5 + Math.random()), duracion: 0.07 + Math.random() * 0.08, volumen: 0.035, retraso: 0.5 + Math.random() * 4.5, reverb: 0.3 });
    }
  };
  const golpe = () => {
    tono({ frecuencia: 62, final: 28, duracion: 1.3, volumen: 0.6 });
    rafaga({ duracion: 0.35, volumen: 0.3, frecuencia: 900, tipo: 'bandpass', q: 1.2 });
    // El sedimento que se levanta.
    rafaga({ duracion: 3.2, volumen: 0.12, frecuencia: 420, barrido: 140, reverb: 0.5, retraso: 0.1 });
    tono({ frecuencia: 310, final: 180, duracion: 0.9, volumen: 0.06, tipo: 'sawtooth', ataque: 0.05, reverb: 0.8, retraso: 0.15 });
  };
  const encenderFocos = () => {
    tono({ frecuencia: 150, final: 60, duracion: 0.22, volumen: 0.28, tipo: 'square' });
    rafaga({ duracion: 0.05, volumen: 0.25, frecuencia: 3000, tipo: 'highpass' });
    tono({ frecuencia: 220, final: 880, duracion: 1.1, volumen: 0.03, ataque: 0.2, reverb: 0.8, retraso: 0.1 });
  };
  const soltarCarnada = () => {
    // Motor del brazo y el toque en el fondo.
    tono({ frecuencia: 120, final: 150, duracion: 2.2, volumen: 0.06, tipo: 'sawtooth', ataque: 0.2 });
    rafaga({ duracion: 2.2, volumen: 0.04, frecuencia: 1500, tipo: 'bandpass', q: 3 });
    tono({ frecuencia: 90, final: 45, duracion: 0.5, volumen: 0.2, retraso: 2.25 });
    rafaga({ duracion: 1.4, volumen: 0.06, frecuencia: 380, barrido: 160, retraso: 2.3, reverb: 0.4 });
  };
  // Nota suave que acompaña cada hito del relato.
  const hito = () => {
    if (!ctx) return;
    const m = MOMENTOS[momentoActual];
    const base = m && m.campanas.length ? m.campanas[0] : -9;
    [0, 7].forEach((intervalo, i) => tono({ frecuencia: NOTA(base + intervalo), duracion: 3.5, volumen: 0.04, ataque: 0.03, reverb: 1.0, retraso: i * 0.18 }));
  };

  function crujido(intensidad) {
    // Gemido metálico de la estructura por la presión.
    const f = 150 + Math.random() * 130;
    tono({ frecuencia: f, final: f * 0.55, duracion: 1.6, volumen: 0.025 + intensidad * 0.05, tipo: 'sawtooth', ataque: 0.35, reverb: 0.7 });
    if (Math.random() < 0.5) tono({ frecuencia: f * 3.1, final: f * 2.2, duracion: 0.5, volumen: 0.012 + intensidad * 0.02, tipo: 'square', ataque: 0.05, reverb: 0.9, retraso: 0.3 });
  }

  // ---------- Actualización por cuadro ----------
  function actualizar(estado, lugar) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const enSuperficie = lugar === 'superficie';
    const p = estado.profundidad;
    const presion = p / 8000;

    // Momento musical.
    let momento = 'amanecer';
    if (!enSuperficie) {
      if (estado.carnada > 6) momento = 'vida';
      else if (estado.desdeFondo > 0 && estado.focos < 0.5) momento = 'oscuridad';
      else if (estado.desdeFondo > 0) momento = 'abismo';
      else if (p < 220) momento = 'azul';
      else if (p < 4000) momento = 'descenso';
      else momento = 'abismo';
    }
    cambiarMomento(momento);
    if (t > proximaCampana) {
      proximaCampana = t + 3.5 + Math.random() * 5;
      campana();
    }

    // Ambiente.
    n.gananciaOlas.gain.setTargetAtTime(enSuperficie ? 0.17 + Math.sin(t * 0.55) * 0.07 : 0, t, 0.3);
    n.gananciaViento.gain.setTargetAtTime(enSuperficie ? 0.035 + Math.sin(t * 0.23) * 0.02 : 0, t, 0.5);
    n.filtroViento.frequency.setTargetAtTime(380 + Math.sin(t * 0.31) * 160, t, 0.5);
    n.gananciaRumor.gain.setTargetAtTime(enSuperficie ? 0.03 : 0.2, t, 0.5);
    n.gananciaFlujo.gain.setTargetAtTime(enSuperficie ? 0 : estado.velocidad * 0.06, t, 0.4); // agua pasando durante el descenso
    n.gananciaZumbido.gain.setTargetAtTime(enSuperficie ? 0 : 0.02 + estado.focos * 0.02, t, 0.5);
    n.gananciaSubgrave.gain.setTargetAtTime(enSuperficie ? 0 : 0.03 + presion * 0.1, t, 1.5);

    // Paso del sumergible.
    const s = estado.sumergible;
    const cercania = s > 0 ? Math.sin(Math.min(1, s / 17) * Math.PI) : 0;
    n.gananciaSub.gain.setTargetAtTime(cercania * 0.09, t, 0.4);
    n.filtroSub.frequency.setTargetAtTime(420 + cercania * 380, t, 0.4);

    // Al entrar al agua el sonido cambia de golpe.
    if (!enSuperficie && !enAgua) rafaga({ duracion: 2.4, volumen: 0.2, frecuencia: 1800, barrido: 200, reverb: 0.4 });
    enAgua = !enSuperficie;

    if (!enSuperficie && presion > 0.3 && t - ultimoCrujido > 8 - presion * 4.5 + Math.random() * 3) {
      ultimoCrujido = t;
      crujido(presion);
    }
  }

  return { iniciar, actualizar, sonar, clic, chapuzon, golpe, encenderFocos, soltarCarnada, hito };
}
