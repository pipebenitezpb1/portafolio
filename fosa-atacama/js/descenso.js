/*
 * Encuentros durante el descenso:
 *   - el sumergible tripulado Limiting Factor (inmersión de 2022),
 *   - una línea de sensores como las del observatorio IDOOS,
 *   - las paredes de la fosa, que se cierran al entrar en la zona hadal,
 *   - una ficha con fotografía dentro de la escena.
 *
 * Leen de window.FOSA:
 *   sumergible  segundos desde que aparece el sumergible (0 = no está)
 *   idoos       0..1  cercanía de la línea de sensores
 *   pared       0..1  cercanía de la pared de la fosa
 *   foto        0..1  visibilidad de la ficha con foto
 */
(function () {
  const B = window.FOSA_BASE;
  const { THREE, V3, U, estado, Lote, material, metal, pintura, segundos, limitar, suave, fbm } = B;

  Object.assign(estado, { sumergible: 0, idoos: 0, pared: 0, foto: 0 });

  // Caja de esquinas redondeadas, con normales suaves.
  function cajaRedondeada(ancho, alto, largo, radio) {
    const geo = new THREE.BoxGeometry(ancho, alto, largo, 10, 16, 20);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const mitad = new V3(ancho / 2 - radio, alto / 2 - radio, largo / 2 - radio);
    const p = new V3();
    const q = new V3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      q.copy(p).clamp(mitad.clone().negate(), mitad);
      const d = p.clone().sub(q);
      if (d.lengthSq() > 1e-8) {
        d.normalize();
        p.copy(q).addScaledVector(d, radio);
        pos.setXYZ(i, p.x, p.y, p.z);
        nor.setXYZ(i, d.x, d.y, d.z);
      }
    }
    return geo;
  }

  /* ---------- Sumergible Limiting Factor ---------- */
  // Modelado a partir de fotografías publicadas: casco blanco alto y angosto, tres ventanas
  // en la proa, brazo manipulador, propulsores en soportes y paneles de luces LED.
  const DURACION_PASADA = 17;

  AFRAME.registerComponent('sumergible', {
    init: function () {
      const lote = new Lote();
      const mCasco = new THREE.MeshStandardMaterial({ color: '#c9cdcf', roughness: 0.32, metalness: 0.05 });
      const mNegro = material('#0e0f10', { roughness: 0.5 });
      const mTitanio = metal('#9a9c99', 0.35);
      const mJunta = material('#2a2d30', { roughness: 0.7 });
      const mVidrio = new THREE.MeshStandardMaterial({ color: '#0a1a22', roughness: 0.05, metalness: 0.6 });
      const cilindro = (r, h, lados) => new THREE.CylinderGeometry(r, r, h, lados || 20);
      const caja = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      const ANCHO = 1.9;
      const ALTO = 3.7;
      const LARGO = 4.6;
      const proa = LARGO / 2;

      lote.agregar(cajaRedondeada(ANCHO, ALTO, LARGO, 0.7), mCasco, [0, 0, 0]);
      // Juntas entre paneles.
      [-0.9, 0.5].forEach((z) => lote.agregar(caja(ANCHO + 0.01, ALTO - 1.2, 0.02), mJunta, [0, 0, z]));
      lote.agregar(caja(ANCHO + 0.01, 0.02, LARGO - 1.3), mJunta, [0, -0.85, 0]);
      // Bandeja inferior con baterías y patines.
      lote.agregar(caja(1.5, 0.22, 3.6), mNegro, [0, -ALTO / 2 - 0.05, 0]);
      [-0.62, 0.62].forEach((x) => lote.agregar(caja(0.12, 0.1, 3.9), mNegro, [x, -ALTO / 2 - 0.2, 0]));

      // Esfera de titanio que asoma en la proa, con sus tres ventanas.
      lote.agregar(new THREE.SphereGeometry(0.8, 28, 20), mCasco, [0, -0.55, proa - 0.62]);
      [[0, -0.95, 0.66], [-0.52, -0.3, 0.52], [0.52, -0.3, 0.52]].forEach(([x, y, dz]) => {
        const centro = new V3(0, -0.55, proa - 0.62);
        const dir = new V3(x, y + 0.55, dz).normalize();
        const posicion = centro.clone().addScaledVector(dir, 0.79);
        const giro = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir);
        lote.agregarM(cilindro(0.2, 0.04, 28), mTitanio, new THREE.Matrix4().compose(posicion, giro, new V3(1, 1, 1)));
        lote.agregarM(cilindro(0.16, 0.05, 28), mVidrio, new THREE.Matrix4().compose(posicion.clone().addScaledVector(dir, 0.005), giro, new V3(1, 1, 1)));
      });

      // Brazo manipulador plegado.
      lote.agregar(caja(0.16, 0.9, 0.16), mNegro, [0.42, 0.2, proa + 0.08], [0.1, 0, 0]);
      lote.agregar(caja(0.14, 0.7, 0.14), mNegro, [0.42, -0.55, proa + 0.2], [-0.35, 0, 0]);
      lote.agregar(caja(0.1, 0.25, 0.2), mNegro, [0.42, -0.98, proa + 0.36]);
      lote.agregar(cilindro(0.1, 0.2, 14), mTitanio, [0.42, 0.66, proa + 0.03], [0, 0, Math.PI / 2]);

      // Propulsores en soportes.
      [[-1, 1.2, -1.9], [1, 1.2, -1.9], [-1, -0.2, -2.0], [1, -0.2, -2.0], [-1, 1.5, 1.3], [1, 1.5, 1.3]].forEach(([lado, y, z], i) => {
        const x = lado * (ANCHO / 2 + 0.28);
        lote.tubo(mNegro, [lado * (ANCHO / 2 - 0.1), y, z], [x, y, z], 0.035);
        const vertical = i >= 4;
        const giro = vertical ? [0, 0, 0] : [Math.PI / 2, 0, 0];
        lote.agregar(new THREE.TorusGeometry(0.19, 0.035, 10, 28), mNegro, [x, y, z], vertical ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
        lote.agregar(cilindro(0.07, 0.24, 14), mNegro, [x, y, z], giro);
        for (let k = 0; k < 3; k++) lote.agregar(caja(0.34, 0.012, 0.07), mNegro, [x, y, z], vertical ? [0, (k * Math.PI) / 3, 0] : [0, 0, (k * Math.PI) / 3]);
      });

      // Escotilla y pasamanos arriba.
      lote.agregar(cilindro(0.42, 0.14, 28), mCasco, [0, ALTO / 2 + 0.03, 0.5]);
      lote.agregar(cilindro(0.3, 0.05, 28), mTitanio, [0, ALTO / 2 + 0.12, 0.5]);
      lote.tubo(mTitanio, [-0.5, ALTO / 2 + 0.25, -1.4], [-0.5, ALTO / 2 + 0.25, -0.2], 0.02);
      [-1.4, -0.2].forEach((z) => lote.tubo(mTitanio, [-0.5, ALTO / 2 - 0.05, z], [-0.5, ALTO / 2 + 0.25, z], 0.02));

      const grupo = lote.construir();

      // Paneles LED, luces y haces.
      this.mLed = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      this.haces = [];
      this.luces = [];
      [[-0.55, 0.75], [0.55, 0.75], [-0.3, -1.45], [0.62, -1.3]].forEach(([x, y]) => {
        const marco = new THREE.Mesh(caja(0.26, 0.2, 0.06), mNegro);
        marco.position.set(x, y, proa - 0.12 + (y < 0 ? 0.25 : 0));
        grupo.add(marco);
        const led = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), this.mLed);
        led.position.set(x, y, marco.position.z + 0.032);
        grupo.add(led);
        const haz = B.hazDeLuz(8, 3.2, 0.11);
        haz.position.copy(led.position);
        haz.quaternion.setFromUnitVectors(new V3(0, -1, 0), new V3(x * 0.25, -0.3, 1).normalize());
        grupo.add(haz);
        this.haces.push(haz);
      });
      // Luz que rebota en el agua e ilumina el propio casco.
      [[0, 0.4, proa + 1.6], [0, -1.6, proa + 0.8], [1.8, 1.0, 0.5]].forEach(([x, y, z]) => {
        const luz = new THREE.PointLight('#dcecff', 0, 9, 1.6);
        luz.position.set(x, y, z);
        grupo.add(luz);
        this.luces.push(luz);
      });

      grupo.visible = false;
      this.grupo = grupo;
      this.ruta = new THREE.CatmullRomCurve3([
        new V3(11, -7, -15),
        new V3(5.5, -1.2, -9.5),
        new V3(3.4, 0.9, -7.2),
        new V3(2.4, 0.8, -6.6),
        new V3(0.5, -2.5, -7.5),
        new V3(-4, -11, -11),
      ]);
      this.el.setObject3D('mesh', grupo);
    },
    tick: function () {
      const t = estado.sumergible;
      const activo = t > 0 && t < DURACION_PASADA;
      this.grupo.visible = activo;
      if (!activo) {
        this.luces.forEach((l) => (l.intensity = 0));
        return;
      }
      const k = t / DURACION_PASADA;
      // Llega rápido, se queda un momento a la par y sigue bajando.
      const avance = k < 0.3 ? suave(0, 0.3, k) * 0.42 : k < 0.7 ? 0.42 + ((k - 0.3) / 0.4) * 0.2 : 0.62 + suave(0.7, 1, k) * 0.38;
      this.ruta.getPointAt(limitar(avance), this.grupo.position);
      this.grupo.rotation.set(Math.sin(t * 0.5) * 0.03, -1.0 + k * 0.9, Math.sin(t * 0.37) * 0.025);
      const fuerza = suave(0, 0.08, k) * (1 - suave(0.9, 1, k));
      this.luces.forEach((l, i) => (l.intensity = fuerza * (i === 2 ? 0.9 : 2.2)));
      this.haces.forEach((haz) => (haz.material.uniforms.uFuerza.value = fuerza * haz.userData.intensidad));
      this.mLed.color.setScalar(0.2 + fuerza * 2.2);
    },
  });

  /* ---------- Pared de la fosa ---------- */
  AFRAME.registerComponent('pared-fosa', {
    init: function () {
      const ALTO = 40;
      const geo = new THREE.CylinderGeometry(9, 9, ALTO, 72, 40, true, 0.15, 2.7);
      const pos = geo.attributes.position;
      const p = new V3();
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i);
        const angulo = Math.atan2(p.x, p.z);
        // Relieve de roca: salientes grandes y rugosidad fina. Se repite en vertical para que el
        // desplazamiento de la textura no delate la costura.
        const relieve = (fbm(angulo * 2.2 + 5, Math.sin((p.y / ALTO) * Math.PI * 2) * 1.5 + 9, 4) - 0.5) * 3.2;
        const radio = 9 + relieve;
        pos.setXYZ(i, Math.sin(angulo) * radio, p.y, Math.cos(angulo) * radio);
      }
      geo.computeVertexNormals();
      const roca = B.texPBR('boulder_01', [3, 4], null);
      this.texturas = [roca.map, roca.normalMap];
      const mat = new THREE.MeshStandardMaterial({ map: roca.map, normalMap: roca.normalMap, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.95, color: '#a09a90', side: THREE.BackSide });
      this.malla = new THREE.Mesh(geo, mat);
      this.malla.position.y = 4;
      this.malla.visible = false;
      this.tramo = ALTO / 4;
      this.el.setObject3D('mesh', this.malla);
    },
    tick: function () {
      const k = estado.pared;
      this.malla.visible = k > 0.01;
      if (!this.malla.visible) return;
      // Lejos, la pared queda oculta por el agua; se acerca al entrar en la zona hadal.
      this.malla.position.x = 0.5 + (1 - k) * 26;
      const corrimiento = -(U.uDesplazamiento.value / this.tramo);
      this.texturas.forEach((t) => (t.offset.y = corrimiento));
    },
  });

  /* ---------- Línea de sensores (observatorio IDOOS) ---------- */
  AFRAME.registerComponent('linea-idoos', {
    init: function () {
      const TRAMO = 14;
      const lote = new Lote();
      const mCable = material('#1a1b1c', { roughness: 0.7 });
      const mAmarillo = pintura('#d99a00', { roughness: 0.45 });
      const mNaranja = pintura('#e2541a', { roughness: 0.5 });
      const mTitanio = metal('#8d8f8c', 0.4);
      const mNegro = material('#131415', { roughness: 0.5 });
      const cilindro = (r, h, lados) => new THREE.CylinderGeometry(r, r, h, lados || 16);
      for (let n = -1; n < 3; n++) {
        const y0 = n * TRAMO;
        lote.tubo(mCable, [0, y0, 0], [0, y0 + TRAMO, 0], 0.012, 6);
        // Flotadores de vidrio en cascos.
        [0, 0.55, 1.1].forEach((dy, i) => {
          lote.agregar(new THREE.SphereGeometry(0.22, 22, 14), i === 1 ? mNaranja : mAmarillo, [0.02, y0 + 11 + dy, 0]);
          lote.agregar(cilindro(0.245, 0.03, 22), i === 1 ? mNaranja : mAmarillo, [0.02, y0 + 11 + dy, 0]);
        });
        // Sensor de salinidad, temperatura y presión.
        lote.agregar(cilindro(0.045, 0.6), mTitanio, [0.09, y0 + 6.5, 0]);
        [6.3, 6.7].forEach((y) => lote.agregar(new THREE.BoxGeometry(0.2, 0.04, 0.08), mNegro, [0.05, y0 + (y - 6.5) + 6.5, 0]));
        lote.agregar(cilindro(0.02, 0.12, 8), mNegro, [0.09, y0 + 6.15, 0]);
        // Correntómetro.
        lote.agregar(cilindro(0.07, 0.42), mNaranja, [-0.11, y0 + 2.5, 0]);
        lote.agregar(cilindro(0.085, 0.05), mNegro, [-0.11, y0 + 2.73, 0]);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          lote.agregar(cilindro(0.012, 0.09, 8), mNegro, [-0.11 + Math.cos(a) * 0.05, y0 + 2.24, Math.sin(a) * 0.05]);
        }
        lote.agregar(new THREE.BoxGeometry(0.24, 0.035, 0.07), mNegro, [-0.05, y0 + 2.5, 0]);
      }
      this.tramo = TRAMO;
      this.grupo = lote.construir();
      this.grupo.visible = false;
      this.el.setObject3D('mesh', this.grupo);
    },
    tick: function () {
      const k = estado.idoos;
      this.grupo.visible = k > 0.01;
      if (!this.grupo.visible) return;
      const y = (((U.uDesplazamiento.value % this.tramo) + this.tramo) % this.tramo) - this.tramo;
      this.grupo.position.set(-3.3 - (1 - k) * 22, y, -2.3);
    },
  });

  /* ---------- Luz de posición del lander: deja ver la pared y los sensores al pasar ---------- */
  AFRAME.registerComponent('luz-descenso', {
    init: function () {
      this.luz = new THREE.PointLight('#cfe0ff', 0, 17, 1.2);
      this.el.setObject3D('luz', this.luz);
    },
    tick: function () {
      this.luz.intensity = Math.max(estado.pared, estado.idoos) * 9;
    },
  });

  /* ---------- Ficha con fotografía dentro de la escena ---------- */
  AFRAME.registerComponent('ficha-foto', {
    schema: { src: { default: '' }, titulo: { default: '' }, credito: { default: '' }, ancho: { default: 0.74 } },
    init: function () {
      const d = this.data;
      const lienzo = document.createElement('canvas');
      lienzo.width = 1024;
      lienzo.height = 700;
      const c = lienzo.getContext('2d');
      const textura = new THREE.CanvasTexture(lienzo);
      textura.colorSpace = THREE.SRGBColorSpace;
      textura.anisotropy = 4;
      const pintar = (imagen) => {
        c.fillStyle = '#05090f';
        c.fillRect(0, 0, 1024, 700);
        if (imagen) c.drawImage(imagen, 16, 16, 992, 517);
        c.strokeStyle = '#f2b705';
        c.lineWidth = 4;
        c.strokeRect(2, 2, 1020, 696);
        c.textBaseline = 'alphabetic';
        c.font = '600 36px "IBM Plex Sans", system-ui, sans-serif';
        c.fillStyle = '#eef4f8';
        c.fillText(d.titulo, 28, 592);
        c.font = '400 25px "IBM Plex Sans", system-ui, sans-serif';
        c.fillStyle = '#9fb6c4';
        c.fillText(d.credito, 28, 642);
        textura.needsUpdate = true;
      };
      pintar(null);
      const imagen = new Image();
      imagen.onload = () => pintar(imagen);
      imagen.src = d.src;
      this.material = new THREE.MeshBasicMaterial({ map: textura, transparent: true, opacity: 0, fog: false, toneMapped: false, depthWrite: false });
      this.malla = new THREE.Mesh(new THREE.PlaneGeometry(d.ancho, (d.ancho * 700) / 1024), this.material);
      this.malla.renderOrder = 21;
      this.el.setObject3D('mesh', this.malla);
    },
    tick: function () {
      this.material.opacity = estado.foto;
      this.malla.visible = estado.foto > 0.01;
    },
  });
})();
