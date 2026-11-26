/*
 * Interacción: consola con palanca, linterna, panel de textos dentro de la escena,
 * fundido a negro en VR y el "operador", que entiende controles del Quest y manos sin controles.
 *
 * La palanca se puede accionar de cuatro maneras, para que nadie quede atascado:
 *   1. Empujarla con la mano (sin apretar nada).
 *   2. Agarrarla con el gatillo o el botón lateral y tirar.
 *   3. Apuntarle con el control y apretar el gatillo.
 *   4. Apretar A o X en el control (o juntar los dedos si se usan las manos).
 */
(function () {
  const B = window.FOSA_BASE;
  const { THREE, V3, U, estado, Lote, material, metal, pintura, segundos, limitar } = B;

  function lienzoTexto(ancho, alto) {
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    return { lienzo, contexto: lienzo.getContext('2d'), textura };
  }
  function partirLineas(c, texto, anchoMaximo) {
    const lineas = [];
    let linea = '';
    texto.split(' ').forEach((palabra) => {
      const prueba = linea ? linea + ' ' + palabra : palabra;
      if (c.measureText(prueba).width > anchoMaximo && linea) {
        lineas.push(linea);
        linea = palabra;
      } else linea = prueba;
    });
    if (linea) lineas.push(linea);
    return lineas;
  }
  function rectanguloRedondeado(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function visibleEnMundo(objeto) {
    for (let o = objeto; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  /* ---------- Consola con palanca ---------- */
  const ANGULO_REPOSO = -0.85;
  const ANGULO_FINAL = 0.95;
  const ANGULO_ACTIVA = 0.15;
  const LARGO_PALANCA = 0.17;

  AFRAME.registerComponent('palanca', {
    schema: { etiqueta: { default: '' } },
    init: function () {
      const lote = new Lote();
      const mAlu = metal('#aab0b5', 0.5);
      const mCaja = pintura('#e0a40c', { roughness: 0.5 });
      const mNegro = material('#131415', { roughness: 0.5 });
      const mAcero = metal('#6a6f75', 0.45);

      // Pedestal.
      lote.agregar(new THREE.CylinderGeometry(0.11, 0.13, 0.02, 24), mAcero, [0, 0.055, 0]);
      lote.tubo(mAlu, [0, 0.06, 0], [0, 0.86, 0], 0.028, 4);
      const grupo = lote.construir();

      // Tablero inclinado hacia la persona.
      const tablero = new THREE.Group();
      tablero.position.set(0, 0.9, 0);
      tablero.rotation.x = 0.35;
      const piezas = new Lote();
      piezas.agregar(new THREE.BoxGeometry(0.36, 0.09, 0.27), mCaja, [0, 0, 0]);
      piezas.agregar(new THREE.BoxGeometry(0.37, 0.012, 0.28), mNegro, [0, 0.03, 0]);
      [[-0.165, -0.12], [0.165, -0.12], [-0.165, 0.12], [0.165, 0.12]].forEach(([x, z]) => piezas.agregar(new THREE.BoxGeometry(0.03, 0.1, 0.03), mNegro, [x, 0, z]));
      // Placa metálica donde va la palanca y protecciones laterales.
      piezas.agregar(new THREE.BoxGeometry(0.2, 0.008, 0.2), mAcero, [0, 0.049, -0.015]);
      [-0.075, 0.075].forEach((x) => {
        piezas.agregar(new THREE.TorusGeometry(0.075, 0.008, 8, 20, Math.PI), mAcero, [x, 0.05, -0.015], [0, Math.PI / 2, 0]);
        piezas.agregar(new THREE.BoxGeometry(0.014, 0.045, 0.03), mAcero, [x * 0.52, 0.07, -0.015]);
      });
      piezas.agregar(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 10), mAcero, [0, 0.085, -0.015], [0, 0, Math.PI / 2]);
      tablero.add(piezas.construir());

      // Palanca.
      this.brazo = new THREE.Group();
      this.brazo.position.set(0, 0.085, -0.015);
      const vastago = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, LARGO_PALANCA, 12), mAcero);
      vastago.position.y = LARGO_PALANCA / 2;
      this.brazo.add(vastago);
      this.mMango = new THREE.MeshStandardMaterial({ color: '#b3231c', roughness: 0.45, emissive: new THREE.Color('#ff7a1a'), emissiveIntensity: 0 });
      const mango = new THREE.Mesh(new THREE.SphereGeometry(0.032, 20, 14), this.mMango);
      mango.position.y = LARGO_PALANCA + 0.015;
      this.brazo.add(mango);
      this.punta = new THREE.Object3D();
      this.punta.position.y = LARGO_PALANCA + 0.015;
      this.brazo.add(this.punta);
      tablero.add(this.brazo);

      // Luz piloto: roja en espera, verde al accionar.
      this.mPiloto = new THREE.MeshBasicMaterial({ color: '#ff3b1f' });
      const piloto = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.mPiloto);
      piloto.position.set(0.135, 0.046, -0.09);
      tablero.add(piloto);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 6, 16), mAcero);
      aro.rotation.x = Math.PI / 2;
      aro.position.copy(piloto.position);
      tablero.add(aro);

      // Placa con la instrucción.
      const { lienzo, contexto, textura } = lienzoTexto(512, 96);
      this.lienzoEtiqueta = lienzo;
      this.contextoEtiqueta = contexto;
      this.texturaEtiqueta = textura;
      const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.056), new THREE.MeshBasicMaterial({ map: textura }));
      placa.position.set(0, 0.0475, 0.1);
      placa.rotation.x = -Math.PI / 2;
      tablero.add(placa);

      grupo.add(tablero);
      this.tablero = tablero;
      this.angulo = ANGULO_REPOSO;
      this.activada = false;
      this.seguida = false;
      this.cercania = 0;
      this.local = new V3();
      this.mundo = new V3();
      this.el.setObject3D('mesh', grupo);
      this.dibujarEtiqueta();
      if (document.fonts) document.fonts.ready.then(() => this.dibujarEtiqueta());
    },
    update: function () {
      this.dibujarEtiqueta();
    },
    dibujarEtiqueta: function () {
      if (!this.contextoEtiqueta) return;
      const c = this.contextoEtiqueta;
      c.fillStyle = '#16181b';
      c.fillRect(0, 0, 512, 96);
      c.strokeStyle = '#8b9096';
      c.lineWidth = 4;
      c.strokeRect(6, 6, 500, 84);
      c.font = '700 40px "IBM Plex Sans", system-ui, sans-serif';
      c.fillStyle = '#f4f1e8';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(this.data.etiqueta, 256, 50);
      this.texturaEtiqueta.needsUpdate = true;
    },
    disponible: function () {
      return !this.activada && visibleEnMundo(this.el.object3D);
    },
    posicionMango: function (destino) {
      return this.punta.getWorldPosition(destino);
    },
    distancia: function (posicionMundo) {
      return this.punta.getWorldPosition(this.mundo).distanceTo(posicionMundo);
    },
    // Lleva la palanca hacia donde está la mano. Devuelve cuánto se movió.
    mover: function (posicionMundo) {
      if (this.activada) return 0;
      this.local.copy(posicionMundo);
      this.tablero.worldToLocal(this.local);
      const nuevo = limitar(Math.atan2(this.local.z + 0.015, this.local.y - 0.085), ANGULO_REPOSO, ANGULO_FINAL);
      const cambio = Math.abs(nuevo - this.angulo);
      this.angulo = nuevo;
      this.seguida = true;
      if (this.angulo > ANGULO_ACTIVA) this.activar();
      return cambio;
    },
    activar: function () {
      if (this.activada) return;
      this.activada = true;
      this.el.sceneEl.emit('palanca-activada');
    },
    reiniciar: function () {
      this.activada = false;
      this.angulo = ANGULO_REPOSO;
    },
    tick: function (t, dt) {
      const s = segundos(dt);
      if (this.activada) this.angulo = Math.min(ANGULO_FINAL, this.angulo + s * 5);
      else if (!this.seguida) this.angulo = Math.max(ANGULO_REPOSO, this.angulo - s * 3); // vuelve sola si se suelta antes
      this.seguida = false;
      this.brazo.rotation.x = this.angulo;

      // El mango late en ámbar mientras espera, y brilla más cuando la mano se acerca.
      const pulso = 0.5 + 0.5 * Math.sin(t * 0.005);
      this.mMango.emissiveIntensity = this.activada ? 0 : 0.25 + pulso * 0.5 + this.cercania * 1.2;
      this.mPiloto.color.set(this.activada ? '#3dff7a' : '#ff3b1f');
    },
  });

  /* ---------- Linterna ---------- */
  AFRAME.registerComponent('linterna', {
    schema: { intensidad: { default: 12 }, alcance: { default: 13 }, cuerpo: { default: false } },
    init: function () {
      const g = new THREE.Group();
      if (this.data.cuerpo) {
        // Linterna de buceo.
        const lote = new Lote();
        const mNegro = metal('#1d1f22', 0.45);
        const mAro = metal('#8d9399', 0.35);
        lote.agregar(new THREE.CylinderGeometry(0.017, 0.017, 0.12, 16), mNegro, [0, 0, 0.0], [Math.PI / 2, 0, 0]);
        lote.agregar(new THREE.CylinderGeometry(0.027, 0.019, 0.045, 20), mNegro, [0, 0, -0.08], [Math.PI / 2, 0, 0]);
        lote.agregar(new THREE.CylinderGeometry(0.029, 0.029, 0.012, 20), mAro, [0, 0, -0.105], [Math.PI / 2, 0, 0]);
        for (let i = 0; i < 4; i++) lote.agregar(new THREE.CylinderGeometry(0.0185, 0.0185, 0.004, 16), mAro, [0, 0, -0.02 + i * 0.02], [Math.PI / 2, 0, 0]);
        g.add(lote.construir());
        this.mLente = new THREE.MeshBasicMaterial({ color: '#222' });
        const lente = new THREE.Mesh(new THREE.CircleGeometry(0.025, 20), this.mLente);
        lente.position.z = -0.112;
        lente.rotation.y = Math.PI;
        g.add(lente);
      }
      this.boca = new THREE.Object3D();
      this.boca.position.z = this.data.cuerpo ? -0.115 : 0;
      g.add(this.boca);
      this.luz = new THREE.SpotLight('#fff1d2', 0, this.data.alcance, 0.36, 0.65, 1.2);
      this.luz.position.copy(this.boca.position);
      this.luz.target.position.set(0, 0, this.boca.position.z - 1);
      g.add(this.luz);
      g.add(this.luz.target);
      // Haz visible en el agua.
      this.haz = B.hazDeLuz(5.5, 1.75, 0.08);
      this.haz.position.copy(this.boca.position);
      this.haz.rotation.x = Math.PI / 2; // el cono apunta hacia −Z
      g.add(this.haz);
      this.posicion = new V3();
      this.direccion = new V3();
      this.cuaternion = new THREE.Quaternion();
      this.el.setObject3D('linterna', g);
    },
    tick: function () {
      const activa = visibleEnMundo(this.el.object3D);
      const fuerza = activa ? estado.linterna : 0;
      this.luz.intensity = fuerza * this.data.intensidad;
      this.haz.visible = fuerza > 0.01 && this.data.cuerpo;
      this.haz.material.uniforms.uFuerza.value = fuerza * this.haz.userData.intensidad;
      if (this.mLente) this.mLente.color.setRGB(0.12 + fuerza * 1.8, 0.12 + fuerza * 1.7, 0.1 + fuerza * 1.4);
      if (!activa) return;
      // Informa a los shaders dónde está el haz, para que ilumine la nieve marina.
      this.boca.getWorldPosition(this.posicion);
      this.boca.getWorldQuaternion(this.cuaternion);
      this.direccion.set(0, 0, -1).applyQuaternion(this.cuaternion);
      U.uLinternaPos.value.copy(this.posicion);
      U.uLinternaDir.value.copy(this.direccion);
      U.uLinterna.value = fuerza;
    },
  });

  /* ---------- Fundido a negro dentro del visor ---------- */
  AFRAME.registerComponent('telon-vr', {
    init: function () {
      this.material = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
      this.esfera = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), this.material);
      this.esfera.renderOrder = 9999;
      this.esfera.frustumCulled = false;
      this.el.setObject3D('telon', this.esfera);
    },
    tick: function () {
      this.material.opacity = estado.telon;
      this.esfera.visible = estado.telon > 0.001;
    },
  });

  /* ---------- Panel de textos dentro de la escena ---------- */
  AFRAME.registerComponent('panel-relato', {
    schema: { ancho: { default: 0.98 }, alto: { default: 0.56 } },
    init: function () {
      const { lienzo, contexto, textura } = lienzoTexto(1024, 586);
      this.lienzo = lienzo;
      this.contexto = contexto;
      this.textura = textura;
      const mat = new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false, fog: false, toneMapped: false });
      const malla = new THREE.Mesh(new THREE.PlaneGeometry(this.data.ancho, this.data.alto), mat);
      malla.renderOrder = 20;
      this.datos = { lugar: '', texto: '', indicacion: '', medidor: '' };
      this.el.setObject3D('mesh', malla);
      if (document.fonts) document.fonts.ready.then(() => this.dibujar());
      this.dibujar();
    },
    actualizar: function (nuevos) {
      let cambio = false;
      Object.keys(nuevos).forEach((k) => {
        if (this.datos[k] !== nuevos[k]) {
          this.datos[k] = nuevos[k];
          cambio = true;
        }
      });
      if (cambio) this.dibujar();
    },
    dibujar: function () {
      const c = this.contexto;
      const W = this.lienzo.width;
      const H = this.lienzo.height;
      c.clearRect(0, 0, W, H);
      const { lugar, texto, indicacion, medidor } = this.datos;
      if (lugar || texto || indicacion || medidor) {
        c.fillStyle = 'rgba(3, 8, 16, 0.84)';
        rectanguloRedondeado(c, 0, 0, W, H, 28);
        c.fill();
        c.fillStyle = '#f2b705';
        c.fillRect(0, 40, 8, H - 80);
        let y = 70;
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        if (lugar) {
          c.font = '600 28px "IBM Plex Sans", system-ui, sans-serif';
          c.fillStyle = '#5fd4e6';
          c.fillText(lugar.toUpperCase().split('').join(' '), 48, y);
          y += 22;
        }
        if (texto) {
          c.font = '600 39px "Fraunces", Georgia, serif';
          c.fillStyle = '#eef4f8';
          partirLineas(c, texto, W - 96).forEach((linea) => {
            y += 50;
            c.fillText(linea, 48, y);
          });
        }
        if (medidor) {
          c.font = '600 34px "IBM Plex Sans", system-ui, sans-serif';
          c.fillStyle = '#f2b705';
          c.fillText(medidor, 48, H - 92);
        }
        if (indicacion) {
          c.font = '500 30px "IBM Plex Sans", system-ui, sans-serif';
          c.fillStyle = '#9fe8f2';
          c.fillText('▸ ' + indicacion, 48, H - 42);
        }
      }
      this.textura.needsUpdate = true;
    },
  });

  /* ---------- Operador: controles y manos ---------- */
  AFRAME.registerComponent('operador-vr', {
    init: function () {
      this.manos = [];
      this.pos = new V3();
      this.dir = new V3();
      this.aux = new V3();
      this.cuaternion = new THREE.Quaternion();
      this.ultimaVibracion = 0;
      const preparar = () => {
        this.el.querySelectorAll('.control').forEach((el) => {
          const m = { el: el, tipo: 'control', presionado: false, tocando: false };
          this.manos.push(m);
          ['triggerdown', 'gripdown'].forEach((evento) => el.addEventListener(evento, () => { m.presionado = true; this.alPresionar(m, evento === 'triggerdown'); }));
          ['triggerup', 'gripup'].forEach((evento) => el.addEventListener(evento, () => { m.presionado = false; }));
          ['abuttondown', 'bbuttondown', 'xbuttondown', 'ybuttondown'].forEach((evento) => el.addEventListener(evento, () => this.accion()));
        });
        this.el.querySelectorAll('.mano-libre').forEach((el) => {
          const m = { el: el, tipo: 'mano', presionado: false, tocando: false };
          this.manos.push(m);
          el.addEventListener('pinchstarted', () => { m.presionado = true; this.alPresionar(m, true); });
          el.addEventListener('pinchended', () => { m.presionado = false; });
        });
      };
      if (this.el.hasLoaded) preparar();
      else this.el.addEventListener('loaded', preparar);
    },

    palanca: function () {
      const el = this.el.querySelector('[palanca]');
      return el && el.components.palanca;
    },

    // Posición de la mano en el mundo. Devuelve false si no se está siguiendo.
    posicionDe: function (m, destino) {
      if (m.tipo === 'control') {
        const seguimiento = m.el.components['tracked-controls'];
        if (!seguimiento || !seguimiento.controller || !m.el.object3D.visible) return false;
        m.el.object3D.getWorldPosition(destino);
        return true;
      }
      const manos = m.el.components['hand-tracking-controls'];
      if (!manos || !manos.hasPoses) return false;
      destino.copy(manos.indexTipPosition).applyMatrix4(m.el.object3D.parent.matrixWorld);
      return true;
    },

    hayControl: function (lado) {
      return this.manos.some((m) => m.tipo === 'control' && m.el.id.toLowerCase().includes(lado) && this.posicionDe(m, this.aux));
    },

    alPresionar: function (m, esGatillo) {
      const palanca = this.palanca();
      if (!palanca || !palanca.disponible()) {
        if (esGatillo) this.el.emit('continuar');
        return;
      }
      if (!this.posicionDe(m, this.pos)) return;
      if (palanca.distancia(this.pos) < 0.32) return; // la agarra: se resuelve en tick
      if (m.tipo === 'mano') {
        palanca.activar(); // juntar los dedos lejos de la palanca también la acciona
        return;
      }
      // Apuntarle con el control y apretar el gatillo.
      m.el.object3D.getWorldQuaternion(this.cuaternion);
      this.dir.set(0, 0, -1).applyQuaternion(this.cuaternion);
      palanca.posicionMango(this.aux).sub(this.pos);
      const alFrente = this.aux.dot(this.dir);
      const desvio = this.aux.addScaledVector(this.dir, -alFrente).length();
      if (alFrente > 0 && desvio < 0.3) palanca.activar();
    },

    accion: function () {
      const palanca = this.palanca();
      if (palanca && palanca.disponible()) palanca.activar();
      else this.el.emit('continuar');
    },

    vibrar: function (m, fuerza, ms) {
      if (m.tipo !== 'control') return;
      try {
        const seguimiento = m.el.components['tracked-controls'];
        const gamepad = seguimiento && seguimiento.controller && seguimiento.controller.gamepad;
        const actuador = gamepad && gamepad.hapticActuators && gamepad.hapticActuators[0];
        if (actuador) actuador.pulse(fuerza, ms);
      } catch (error) {
        /* algunos controles no vibran */
      }
    },
    vibrarTodas: function (fuerza, ms) {
      this.manos.forEach((m) => this.vibrar(m, fuerza, ms));
    },

    tick: function (t) {
      const palanca = this.palanca();
      if (!palanca) return;
      if (!palanca.disponible()) {
        palanca.cercania = 0;
        this.manos.forEach((m) => (m.tocando = false));
        return;
      }
      let cercania = 0;
      this.manos.forEach((m) => {
        if (!this.posicionDe(m, this.pos)) {
          m.tocando = false;
          return;
        }
        const d = palanca.distancia(this.pos);
        cercania = Math.max(cercania, 1 - d / 0.4);
        // Con el botón apretado se agarra desde más lejos; sin apretar, basta tocarla.
        const alcance = m.presionado ? 0.32 : m.tocando ? 0.2 : 0.1;
        m.tocando = d < alcance;
        if (!m.tocando) return;
        const cambio = palanca.mover(this.pos);
        if (cambio > 0.008 && t - this.ultimaVibracion > 45) {
          this.ultimaVibracion = t;
          this.vibrar(m, Math.min(1, 0.25 + cambio * 6), 20);
        }
        if (palanca.activada) this.vibrar(m, 1, 140);
      });
      palanca.cercania = limitar(cercania);
    },
  });
})();
