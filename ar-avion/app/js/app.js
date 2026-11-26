/*
 * Interfaz: botones, avisos, indicadores, ayuda y foto.
 */
window.AR = window.AR || {};

/* Cámara a mayor resolución = el marcador se detecta mejor y desde más lejos.
 * MindAR pide la cámara sin resolución; aquí le agregamos una ideal de 1280x720. */
(() => {
  const md = navigator.mediaDevices;
  if (!md || !md.getUserMedia) return;
  const original = md.getUserMedia.bind(md);
  md.getUserMedia = c => {
    if (c && c.video) {
      const v = c.video === true ? {} : { ...c.video };
      v.width ??= { ideal: 1280 };
      v.height ??= { ideal: 720 };
      c = { ...c, video: v };
    }
    return original(c);
  };
})();

AR.quiereManos = true;

(() => {
  const $ = s => document.querySelector(s);
  let toastTimer = null;

  AR.ui = {
    toast(msg, ms = 1500) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('visible'), ms);
    },
    /** lista de gestos detectados, o un texto de estado */
    /** Estado visual del botón de calibrar */
    calibracion(activa) {
      const b = $('#btn-calibrar');
      b.classList.toggle('activo', activa);
      b.classList.toggle('pendiente', !activa && !AR.manos?.calibrado);
      if (activa) setStatus('📏 Pon la mano plana sobre el marcador');
      else if ($('#status').textContent.startsWith('📏')) {
        setStatus(AR.seguimiento?.estado === 'estable' ? null : 'Apunta la cámara al marcador');
      }
    },
    manos(lista, texto) {
      const chip = $('#chip-manos');
      if (!chip) return;
      if (texto) chip.textContent = '🖐 ' + texto;
      else if (!lista || !lista.length) chip.textContent = '🖐 Muestra tus manos';
      else chip.textContent = lista.join('  ');
    }
  };

  function setStatus(txt) {
    const s = $('#status');
    if (txt) { s.textContent = txt; s.classList.remove('hidden'); }
    else s.classList.add('hidden');
  }

  function foto() {
    const scene = $('a-scene');
    const video = scene.systems['mindar-image-system']?.video || $('video');
    const gl = scene.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = innerWidth, H = innerHeight;
    const c = document.createElement('canvas');
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    if (document.body.classList.contains('espejo')) { g.translate(W, 0); g.scale(-1, 1); }
    if (video) { const r = video.getBoundingClientRect(); g.drawImage(video, r.left, r.top, r.width, r.height); }
    scene.renderer.render(scene.object3D, scene.camera);   // asegura que el canvas 3D tenga la imagen
    const r = gl.getBoundingClientRect();
    g.drawImage(gl, r.left, r.top, r.width, r.height);
    const a = document.createElement('a');
    a.download = 'avion-ar-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
    a.href = c.toDataURL('image/png');
    a.click();
    const flash = $('#flash');
    flash.classList.add('on');
    setTimeout(() => flash.classList.remove('on'), 150);
    AR.sonido?.click();
    AR.ui.toast('📷 Foto guardada');
  }

  /** Se llama justo después de <a-scene> para no perder eventos de MindAR */
  AR.iniciarUI = function () {
    const scene = $('a-scene');
    const ancla = $('#ancla');
    const contenido = $('#aparecer');

    scene.addEventListener('arReady', () => {
      AR.arListo = true;
      setStatus('Apunta la cámara al marcador');
      if (AR.quiereManos && AR.manos) AR.manos.activar();
    });
    scene.addEventListener('arError', () => setStatus('No se pudo abrir la cámara'));

    ancla.addEventListener('marcador-encontrado', () => AR.piloto?.aparecer());
    ancla.addEventListener('estado-seguimiento', e => {
      const est = e.detail;
      const chip = $('#chip-seguimiento');
      chip.dataset.estado = est;
      chip.textContent = { estable: 'Marcador detectado', manteniendo: 'Manteniendo posición…', buscando: 'Buscando marcador' }[est];
      if (est === 'buscando') setStatus('Apunta la cámara al marcador');
      else setStatus(null);
    });

    contenido.addEventListener('modo-cambiado', e => {
      const m = e.detail;
      $('#btn-modo').textContent = m.icono + ' ' + m.nombre;
      AR.ui.toast(m.icono + ' Modo ' + m.nombre);
    });

    $('#btn-modo').addEventListener('click', () => AR.piloto?.siguiente());
    $('#btn-voltear').addEventListener('click', () => document.body.classList.toggle('espejo'));
    $('#btn-sonido').addEventListener('click', e => {
      e.currentTarget.textContent = AR.sonido.toggle() ? '🔊' : '🔇';
    });
    $('#btn-manos').addEventListener('click', e => {
      AR.quiereManos = !AR.quiereManos;
      e.currentTarget.classList.toggle('apagado', !AR.quiereManos);
      if (AR.quiereManos) AR.manos?.activar(); else AR.manos?.desactivar();
    });
    $('#btn-foto').addEventListener('click', foto);
    $('#btn-turbo').addEventListener('click', () => { AR.piloto?.turbo(3500); AR.sonido?.whoosh(); AR.ui.toast('🚀 ¡Turbo!'); });
    $('#btn-estela').addEventListener('click', e => {
      const on = AR.piloto?.toggleEstela();
      e.currentTarget.classList.toggle('apagado', !on);
      AR.ui.toast(on ? '💨 Estela activada' : '💨 Estela desactivada');
    });
    $('#btn-reiniciar').addEventListener('click', () => { AR.manipulador?.reiniciar(); AR.ui.toast('↺ Tamaño original'); });
    $('#btn-ayuda').addEventListener('click', () => $('#ayuda').classList.toggle('visible'));
    $('#cerrar-ayuda').addEventListener('click', () => $('#ayuda').classList.remove('visible'));
    $('#btn-calibrar').addEventListener('click', () => {
      if (!AR.manos?.listo) { AR.ui.toast('Espera a que carguen las manos'); return; }
      AR.manos.calibrar();
    });
    // Si nunca se ha calibrado, el botón late para invitar a hacerlo
    const marcarPendiente = () => AR.manos ? AR.ui.calibracion(false) : setTimeout(marcarPendiente, 500);
    marcarPendiente();

    // Teclado (útil para probar en el computador)
    addEventListener('keydown', e => {
      const p = AR.piloto;
      if (!p) return;
      if (e.key === 'm') p.siguiente();
      if (e.key === 't') { p.turbo(3500); AR.ui.toast('🚀 Turbo'); }
      if (e.key === 'e') AR.ui.toast(p.toggleEstela() ? 'Estela activada' : 'Estela desactivada');
      if (e.key === ' ') { e.preventDefault(); AR.ui.toast(p.togglePausa() ? 'Pausa' : 'Reanudar'); }
      if (e.key === 'r' && p.tonel()) {
        const v = new THREE.Vector3();
        p.posicionMundo(v);
        AR.particulas?.explosion(v, 60);
        AR.sonido?.boop();
        AR.ui.toast('¡Tonel!');
      }
      if (e.key === 'f') foto();
      if (e.key === 'c') AR.manos?.calibrar();
      if (e.key === 'h') AR.ui.toast(AR.manos?.toggleMano3D() ? 'Mano 3D visible' : 'Mano 3D oculta');
      if (e.key === 'o') AR.ui.toast(AR.manos?.toggleOclusion() ? 'Oclusión activada' : 'Oclusión desactivada');
    });
  };
})();
