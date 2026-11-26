/*
 * Sonido sintetizado con Web Audio (sin archivos de audio).
 *  - motor: zumbido de hélices cuyo tono sube con la velocidad
 *  - efectos: boop, whoosh, campanita
 * El navegador solo permite audio después de un clic, por eso empieza apagado.
 */
window.AR = window.AR || {};

AR.sonido = (() => {
  let ctx = null, activo = false;
  let osc1, osc2, filtro, ganancia, lfo, lfoGain, ultimo = 0;

  function iniciar() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ganancia = ctx.createGain(); ganancia.gain.value = 0;
    filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 500;
    osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 55;
    osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 82;
    // LFO = "tac-tac" de las hélices
    lfo = ctx.createOscillator(); lfo.frequency.value = 14;
    lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(ganancia.gain);
    osc1.connect(filtro); osc2.connect(filtro);
    filtro.connect(ganancia).connect(ctx.destination);
    osc1.start(); osc2.start(); lfo.start();
  }

  function tono(f0, f1, dur, tipo = 'sine', vol = 0.15) {
    if (!activo) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  return {
    get activo() { return activo; },
    toggle() {
      if (!ctx) iniciar();
      activo = !activo;
      if (activo) ctx.resume();
      ganancia.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      lfoGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      return activo;
    },
    /** velocidad en grados/s del avión */
    motor(vel, turbo) {
      if (!activo || !ctx) return;
      const ahora = performance.now();
      if (ahora - ultimo < 50) return;
      ultimo = ahora;
      const v = Math.abs(vel);
      const t = ctx.currentTime;
      osc1.frequency.setTargetAtTime(45 + v * 0.5, t, 0.1);
      osc2.frequency.setTargetAtTime(68 + v * 0.75, t, 0.1);
      lfo.frequency.setTargetAtTime(8 + v * 0.15, t, 0.1);
      filtro.frequency.setTargetAtTime(turbo ? 1400 : 500, t, 0.2);
      ganancia.gain.setTargetAtTime(v > 1 ? 0.05 : 0.0, t, 0.15);
      lfoGain.gain.setTargetAtTime(v > 1 ? 0.02 : 0.0, t, 0.15);
    },
    boop()     { tono(500, 1200, 0.18, 'sine', 0.2); },
    whoosh()   { tono(900, 200, 0.3, 'triangle', 0.12); },
    campana()  { tono(1320, 1320, 0.4, 'sine', 0.12); setTimeout(() => tono(1760, 1760, 0.5, 'sine', 0.1), 90); },
    click()    { tono(800, 600, 0.06, 'square', 0.05); }
  };
})();
