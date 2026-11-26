/*
 * Componentes A-Frame del proyecto.
 * Todo lo que necesita ser accedido desde otros scripts se publica en window.AR.
 */
window.AR = window.AR || {};

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

/* ------------------------------------------------------------------ *
 * fit-model: centra el GLB y lo escala para que su lado más largo
 * mida `size` (1 = ancho del marcador en MindAR).
 * ------------------------------------------------------------------ */
AFRAME.registerComponent('fit-model', {
  schema: { size: { default: 1 } },
  init() {
    this.el.addEventListener('model-loaded', () => {
      const obj = this.el.getObject3D('mesh');
      const parent = obj.parent;
      parent.remove(obj);                       // medir sin transformaciones del padre
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      parent.add(obj);

      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      obj.position.sub(center);
      this.el.object3D.scale.setScalar(this.data.size / Math.max(size.x, size.y, size.z));
    });
  }
});

/* ------------------------------------------------------------------ *
 * seguir-marcador: MEJORA DEL SEGUIMIENTO.
 * En vez de pegar el contenido directo al marcador de MindAR (que tiembla
 * y desaparece al primer cuadro perdido), este entity sigue la pose del
 * marcador con un filtro adaptativo:
 *   - movimiento pequeño (ruido)  -> mucho suavizado, no tiembla
 *   - movimiento grande (real)    -> sigue rápido, sin retraso
 * y si el marcador se pierde, mantiene la última pose `mantener` ms
 * (por ejemplo, cuando una mano lo tapa un momento).
 * ------------------------------------------------------------------ */
AFRAME.registerComponent('seguir-marcador', {
  schema: {
    target:   { type: 'selector' },
    suavidad: { default: 10 },     // más alto = sigue más rápido
    mantener: { default: 1500 }    // ms que se mantiene visible tras perder el marcador
  },
  init() {
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.scl = new THREE.Vector3();
    this.visto = false;
    this.ultimaVez = 0;
    this.estado = 'buscando';
    this.el.object3D.visible = false;
    AR.seguimiento = this;
  },
  tick(t, dt) {
    const tgt = this.data.target.object3D;
    const o = this.el.object3D;
    dt = Math.min(dt || 16, 100) / 1000;

    if (tgt.visible) {
      tgt.updateMatrixWorld(true);
      tgt.matrixWorld.decompose(this.pos, this.quat, this.scl);

      if (!this.visto) {
        // Primera detección: saltar directo a la pose
        o.position.copy(this.pos); o.quaternion.copy(this.quat); o.scale.copy(this.scl);
        this.visto = true;
        this.el.emit('marcador-encontrado');
      } else {
        const ancho = Math.max(this.scl.x, 1e-6);
        const distPos = o.position.distanceTo(this.pos) / ancho;     // en anchos de marcador
        const distRot = o.quaternion.angleTo(this.quat);             // radianes
        const k = this.data.suavidad * (1 + distPos * 10 + distRot * 6);
        const a = 1 - Math.exp(-k * dt);
        o.position.lerp(this.pos, a);
        o.quaternion.slerp(this.quat, a);
        o.scale.lerp(this.scl, a);
      }
      this.ultimaVez = t;
      o.visible = true;
      this.setEstado('estable');
    } else if (this.visto) {
      if (t - this.ultimaVez < this.data.mantener) {
        this.setEstado('manteniendo');
      } else {
        this.visto = false;
        o.visible = false;
        this.setEstado('buscando');
        this.el.emit('marcador-perdido');
      }
    }
  },
  setEstado(e) {
    if (e === this.estado) return;
    this.estado = e;
    this.el.emit('estado-seguimiento', e);
  }
});

/* ------------------------------------------------------------------ *
 * piloto: anima el avión (órbita, flotación, alabeo, tonel, turbo,
 * pausa, estela) con transiciones suaves entre modos.
 * ------------------------------------------------------------------ */
AR.MODOS = [
  { nombre: 'Giro',   icono: '🌀', radius: 0,    height: 0.15, bank: 0,  speed: 40 },
  { nombre: 'Vuelo',  icono: '✈️', radius: 0.32, height: 0.3,  bank: 25, speed: 55 },
  { nombre: 'Quieto', icono: '⏸', radius: 0,    height: 0.06, bank: 0,  speed: 0 }
];

AFRAME.registerComponent('piloto', {
  init() {
    this.modo = 0;
    this.cur = { ...AR.MODOS[0] };
    this.angulo = 0;
    this.t = 0;
    this.pausa = false;
    this.turboHasta = 0;
    this.roll = null;
    this.entrada = 1;
    this.estela = false;
    this.velocidad = 0;
    this.orbita = this.el.querySelector('#orbita').object3D;
    this.avion = this.el.querySelector('#avion-pos').object3D;
    this.sombra = this.el.querySelector('#sombra').object3D;
    this.raiz = this.el.object3D;
    this.tmp = new THREE.Vector3();
    this.puntas = [new THREE.Vector3(0.36, 0, 0), new THREE.Vector3(-0.36, 0, 0)];
    // Control externo (manos): el avión vuela hacia un punto del mundo
    this.control = 0;
    this.controlActivo = false;
    this.controlObj = new THREE.Vector3();
    this.orbitPos = new THREE.Vector3();
    this.ctrlLocal = new THREE.Vector3();
    AR.piloto = this;
  },
  setModo(i) {
    this.modo = (i + AR.MODOS.length) % AR.MODOS.length;
    this.pausa = false;
    this.el.emit('modo-cambiado', AR.MODOS[this.modo]);
  },
  siguiente(d = 1) { this.setModo(this.modo + d); },
  togglePausa() { this.pausa = !this.pausa; return this.pausa; },
  turbo(ms = 3000) { this.turboHasta = performance.now() + ms; },
  enTurbo() { return performance.now() < this.turboHasta; },
  tonel() { if (!this.roll) { this.roll = { t: 0 }; return true; } return false; },
  toggleEstela() { this.estela = !this.estela; return this.estela; },
  aparecer() { this.entrada = 0; },

  /** Hace que el avión vuele a `posMundo` (Vector3) y se quede ahí; null = volver a su órbita */
  controlar(posMundo) {
    if (posMundo) { this.controlObj.copy(posMundo); this.controlActivo = true; }
    else this.controlActivo = false;
  },

  /** Posición del avión en coordenadas de mundo */
  posicionMundo(v) { return this.avion.getWorldPosition(v); },

  tick(t, dt) {
    dt = Math.min(dt || 16, 100) / 1000;
    const obj = AR.MODOS[this.modo];
    const c = this.cur;
    const a = 1 - Math.exp(-3 * dt);
    for (const k of ['radius', 'height', 'bank', 'speed']) c[k] += (obj[k] - c[k]) * a;

    const turbo = this.enTurbo() ? 3.5 : 1;
    const objetivo = this.pausa ? 0 : Math.max(c.speed, turbo > 1 ? 40 : 0) * turbo;
    this.velocidad += (objetivo - this.velocidad) * (1 - Math.exp(-4 * dt));
    this.angulo += this.velocidad * dt;
    if (!this.pausa) this.t += dt;

    const bob = Math.sin(this.t * 2) * 0.025;
    this.orbita.rotation.y = this.angulo * DEG;
    this.orbitPos.set(c.radius, c.height + bob, 0);

    // Mezcla suave entre la órbita y el punto que indica la mano
    this.control += ((this.controlActivo ? 1 : 0) - this.control) * (1 - Math.exp(-5 * dt));
    if (this.control > 0.002) {
      this.orbita.updateMatrixWorld(true);
      this.ctrlLocal.copy(this.controlObj);
      this.orbita.worldToLocal(this.ctrlLocal);
      this.ctrlLocal.y += bob * 0.6;
      this.avion.position.lerpVectors(this.orbitPos, this.ctrlLocal, this.control);
    } else {
      this.avion.position.copy(this.orbitPos);
    }

    let roll = 0;
    if (this.roll) {
      this.roll.t += dt / 0.9;
      roll = easeInOut(Math.min(this.roll.t, 1)) * 360;
      if (this.roll.t >= 1) this.roll = null;
    }
    const alabeo = c.bank * (turbo > 1 ? 1.6 : 1) + (c.radius < 0.05 && turbo > 1 ? 15 : 0);
    this.avion.rotation.set(0, 0, (alabeo + roll) * DEG);

    // Sombra: sigue al avión, más pequeña y tenue cuanto más alto vuela
    this.sombra.position.set(this.avion.position.x, 0.002, this.avion.position.z);
    const s = clamp(1 - this.avion.position.y * 1.2, 0.4, 1);
    this.sombra.scale.set(s, s, s);

    // Animación de entrada (crece con rebote)
    if (this.entrada < 1) {
      this.entrada = Math.min(1, this.entrada + dt / 0.7);
      this.raiz.scale.setScalar(Math.max(0.01, easeOutBack(this.entrada)));
    }

    // Estela de humo desde las puntas de las alas
    if ((this.estela || turbo > 1) && AR.particulas && this.velocidad > 5) {
      for (const p of this.puntas) {
        this.avion.localToWorld(this.tmp.copy(p));
        AR.particulas.emitirMundo(this.tmp, {
          color: turbo > 1 ? [1, 0.55, 0.15] : [0.92, 0.95, 1],
          tam: 0.035, crece: 0.08, vida: 1.2, alpha: 0.55, dispersion: 0.004
        });
      }
    }

    if (AR.sonido) AR.sonido.motor(this.velocidad, turbo > 1);
  }
});

/* ------------------------------------------------------------------ *
 * manipulador: rotación y escala que el usuario aplica con las manos.
 * ------------------------------------------------------------------ */
AFRAME.registerComponent('manipulador', {
  init() {
    this.cur = { yaw: 0, pitch: 0, escala: 1 };
    this.obj = { yaw: 0, pitch: 0, escala: 1 };
    this.el.object3D.rotation.order = 'YXZ';
    AR.manipulador = this;
  },
  rotar(dYaw, dPitch) {
    this.obj.yaw += dYaw;
    this.obj.pitch = clamp(this.obj.pitch + dPitch, -80, 80);
  },
  escalar(f) { this.obj.escala = clamp(f, 0.3, 3); },
  reiniciar() { this.obj = { yaw: 0, pitch: 0, escala: 1 }; },
  tick(t, dt) {
    dt = Math.min(dt || 16, 100) / 1000;
    const a = 1 - Math.exp(-10 * dt);
    for (const k of ['yaw', 'pitch', 'escala']) this.cur[k] += (this.obj[k] - this.cur[k]) * a;
    this.el.object3D.rotation.set(this.cur.pitch * DEG, this.cur.yaw * DEG, 0);
    this.el.object3D.scale.setScalar(this.cur.escala);
  }
});

/* ------------------------------------------------------------------ *
 * particulas: sistema de partículas simple (humo, chispas, confeti).
 * Vive en el espacio del marcador para moverse junto con él.
 * ------------------------------------------------------------------ */
AFRAME.registerComponent('particulas', {
  schema: { max: { default: 600 } },
  init() {
    const N = this.N = this.data.max;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3);
    this.alpha = new Float32Array(N);
    this.alpha0 = new Float32Array(N);
    this.size = new Float32Array(N);
    this.crece = new Float32Array(N);
    this.vida = new Float32Array(N);
    this.vidaMax = new Float32Array(N);
    this.gravedad = new Float32Array(N);
    this.i = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uAltura: { value: 800 }, uEscala: { value: 1 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
        uniform float uAltura; uniform float uEscala;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uEscala * uAltura * projectionMatrix[1][1] / (2.0 * max(-mv.z, 0.0001));
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, smoothstep(0.5, 0.1, d) * vAlpha);
        }`,
      transparent: true,
      depthWrite: false
    });

    const points = new THREE.Points(geo, this.mat);
    points.frustumCulled = false;
    this.el.setObject3D('particulas', points);
    this.tmp = new THREE.Vector3();
    this.escalaMundo = new THREE.Vector3();
    AR.particulas = this;
  },

  /** Emite una partícula en coordenadas de mundo */
  emitirMundo(p, o = {}) {
    this.el.object3D.worldToLocal(this.tmp.copy(p));
    this.emitir(this.tmp, o);
  },

  /** Emite una partícula en coordenadas locales (espacio del marcador) */
  emitir(p, o = {}) {
    const i = this.i; this.i = (this.i + 1) % this.N;
    const d = o.dispersion || 0;
    this.pos[i * 3] = p.x + (Math.random() - 0.5) * d;
    this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * d;
    this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * d;
    const v = o.vel || [0, 0, 0];
    this.vel[i * 3] = v[0]; this.vel[i * 3 + 1] = v[1]; this.vel[i * 3 + 2] = v[2];
    const c = o.color || [1, 1, 1];
    this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    this.alpha0[i] = this.alpha[i] = o.alpha ?? 1;
    this.size[i] = o.tam ?? 0.03;
    this.crece[i] = o.crece ?? 0;
    this.vida[i] = this.vidaMax[i] = o.vida ?? 1;
    this.gravedad[i] = o.gravedad ?? 0;
  },

  /** Explosión de partículas de colores en una posición de mundo */
  explosion(pMundo, n = 50) {
    this.el.object3D.worldToLocal(this.tmp.copy(pMundo));
    const colores = [[1, 0.3, 0.3], [1, 0.8, 0.2], [0.3, 0.8, 1], [0.5, 1, 0.5], [1, 0.5, 1]];
    for (let k = 0; k < n; k++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const sp = 0.4 + Math.random() * 0.6;
      this.emitir(this.tmp, {
        vel: [Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp + 0.3, Math.sin(ph) * Math.sin(th) * sp],
        color: colores[k % colores.length], tam: 0.03, vida: 1 + Math.random() * 0.6, gravedad: -1.2
      });
    }
  },

  tick(t, dt) {
    dt = Math.min(dt || 16, 100) / 1000;
    const renderer = this.el.sceneEl.renderer;
    this.mat.uniforms.uAltura.value = renderer.domElement.height;
    this.el.object3D.getWorldScale(this.escalaMundo);
    this.mat.uniforms.uEscala.value = this.escalaMundo.x;

    for (let i = 0; i < this.N; i++) {
      if (this.vida[i] <= 0) { this.alpha[i] = 0; continue; }
      this.vida[i] -= dt;
      const f = Math.max(0, this.vida[i] / this.vidaMax[i]);
      this.vel[i * 3 + 1] += this.gravedad[i] * dt;
      const drag = Math.exp(-1.5 * dt);
      for (let k = 0; k < 3; k++) {
        this.vel[i * 3 + k] *= drag;
        this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      }
      this.size[i] += this.crece[i] * dt;
      this.alpha[i] = this.alpha0[i] * f;
    }
    const at = this.geo.attributes;
    at.position.needsUpdate = at.aColor.needsUpdate = at.aAlpha.needsUpdate = at.aSize.needsUpdate = true;
  }
});
