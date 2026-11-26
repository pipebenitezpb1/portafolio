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

  Object.assign(estado, { sumergible: 0, idoos: 0, pared: 0, foto: 0, jibias: 0 });

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

  /* ---------- Laderas de la fosa ---------- */
  // Dos laderas de roca con relieve real (cornisas, grietas y salientes) que pasan hacia arriba
  // mientras se baja. El relieve se repite cada 40 m para poder dar la vuelta sin saltos.
  const PERIODO_LADERA = 40;
  let geometriaLadera = null;
  function crearLadera() {
    const ANCHO = 54;
    const geo = new THREE.PlaneGeometry(ANCHO, PERIODO_LADERA * 2, 90, 150);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const u = (x / ANCHO + 0.5) * 6;
      const v = (((y / PERIODO_LADERA) % 1) + 1) % 1 * 6;
      const grande = B.fbmP(u, v, 6, 4) - 0.5;
      const cornisas = Math.abs(B.fbmP(u * 0.7 + 3, v * 2.2, 6, 3) - 0.5) * 2;
      const fino = B.fbmP(u * 5, v * 5, 30, 2) - 0.5;
      // Las cornisas sobresalen y las grietas se hunden.
      pos.setZ(i, grande * 5.5 + (1 - cornisas) * 1.6 + fino * 0.5);
    }
    geo.computeVertexNormals();
    return geo;
  }

  AFRAME.registerComponent('pared-fosa', {
    schema: { lado: { default: 1 }, distancia: { default: 8 } },
    init: function () {
      geometriaLadera = geometriaLadera || crearLadera();
      const roca = B.texPBR('boulder_01', [5, 8], null);
      const mat = new THREE.MeshStandardMaterial({ map: roca.map, normalMap: roca.normalMap, normalScale: new THREE.Vector2(1.8, 1.8), roughness: 1, color: '#a8a195', side: THREE.DoubleSide });
      this.malla = new THREE.Mesh(geometriaLadera, mat);
      // La ladera mira hacia la persona y se inclina un poco, como el talud de la fosa.
      this.malla.rotation.set(0, -this.data.lado * (Math.PI / 2 - 0.35), 0);
      this.malla.visible = false;
      this.el.setObject3D('mesh', this.malla);
    },
    tick: function () {
      const k = estado.pared;
      this.malla.visible = k > 0.01;
      if (!this.malla.visible) return;
      const d = this.data;
      const subida = ((U.uDesplazamiento.value % PERIODO_LADERA) + PERIODO_LADERA) % PERIODO_LADERA;
      // Lejos queda oculta por el agua; se acerca al entrar en la zona hadal.
      this.malla.position.set(d.lado * (d.distancia + (1 - k) * 30), subida - PERIODO_LADERA / 2, -3 - d.lado * 2);
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

  /* ---------- Luz de posición del lander: deja ver lo que pasa cerca durante la bajada ---------- */
  AFRAME.registerComponent('luz-descenso', {
    init: function () {
      this.luz = new THREE.PointLight('#cfe0ff', 0, 18, 1.2);
      this.el.setObject3D('luz', this.luz);
    },
    tick: function () {
      const p = estado.profundidad;
      const bajando = estado.enSuperficie || estado.desdeFondo > 0 ? 0 : limitar((p - 250) / 350) * limitar((7950 - p) / 250);
      this.luz.intensity = bajando * (2.6 + Math.max(estado.pared, estado.idoos) * 9);
    },
  });

  /* ---------- Jibias (calamar de Humboldt) ---------- */
  // Pasan en grupo, nadando hacia atrás a impulsos, entre los 300 y los 900 m.
  function crearJibia() {
    const lote = new Lote();
    const piel = new THREE.MeshStandardMaterial({ color: '#8e2f2a', roughness: 0.35, metalness: 0.05, emissive: new THREE.Color('#2a0806'), emissiveIntensity: 0.6 });
    const ojo = new THREE.MeshStandardMaterial({ color: '#d9d2c0', roughness: 0.15 });
    const pupila = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.1 });
    // Manto: un huso que termina en punta (la punta mira hacia −Z).
    const perfil = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      perfil.push(new THREE.Vector2(0.004 + Math.pow(Math.sin(t * Math.PI * 0.62), 0.75) * 0.105, t * 0.62));
    }
    lote.agregar(new THREE.LatheGeometry(perfil, 22), piel, [0, 0, -0.62], [Math.PI / 2, 0, 0]);
    lote.agregar(new THREE.SphereGeometry(0.1, 18, 12), piel, [0, 0, 0.02], [0, 0, 0], [0.85, 0.85, 1.1]);
    // Aletas en rombo cerca de la punta.
    [-1, 1].forEach((lado) => lote.agregar(new THREE.ConeGeometry(0.16, 0.3, 3), piel, [lado * 0.11, 0, -0.5], [Math.PI / 2, 0, lado * 0.35], [1, 1, 0.08]));
    [-1, 1].forEach((lado) => {
      lote.agregar(new THREE.SphereGeometry(0.036, 14, 10), ojo, [lado * 0.078, 0.01, 0.05]);
      lote.agregar(new THREE.SphereGeometry(0.02, 10, 8), pupila, [lado * 0.103, 0.01, 0.055]);
    });
    const cuerpo = lote.construir();
    cuerpo.userData.piel = piel;
    // Brazos y tentáculos, que se abren y cierran con cada impulso.
    const brazos = new THREE.Group();
    brazos.position.z = 0.1;
    const lista = [];
    for (let i = 0; i < 10; i++) {
      const largo = i < 2 ? 0.75 : 0.42;
      const brazo = new THREE.Mesh(new THREE.ConeGeometry(i < 2 ? 0.012 : 0.02, largo, 6), piel);
      brazo.geometry.translate(0, -largo / 2, 0);
      const pivote = new THREE.Group();
      pivote.rotation.z = (i / 10) * Math.PI * 2;
      const codo = new THREE.Group();
      codo.rotation.x = -Math.PI / 2;
      codo.add(brazo);
      pivote.add(codo);
      pivote.position.set(Math.cos((i / 10) * Math.PI * 2) * 0.05, Math.sin((i / 10) * Math.PI * 2) * 0.05, 0);
      brazos.add(pivote);
      lista.push(codo);
    }
    cuerpo.add(brazos);
    cuerpo.userData.brazos = lista;
    return cuerpo;
  }

  AFRAME.registerComponent('jibias', {
    schema: { cantidad: { default: 4 }, duracion: { default: 13 } },
    init: function () {
      const grupo = new THREE.Group();
      this.animales = [];
      for (let i = 0; i < this.data.cantidad; i++) {
        const jibia = crearJibia();
        jibia.scale.setScalar(1.3 + Math.random() * 0.7);
        grupo.add(jibia);
        this.animales.push({ objeto: jibia, avance: 0, susto: 0, desfase: new V3((Math.random() - 0.5) * 3.5, (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.5 - i * 0.3), fase: Math.random() * 6, retraso: i * 0.6 });
      }
      grupo.visible = false;
      this.grupo = grupo;
      this.ruta = new THREE.CatmullRomCurve3([new V3(-11, 3.5, -7), new V3(-4, 1.8, -4.6), new V3(1.5, 1.2, -3.6), new V3(6, 0.2, -5), new V3(13, -3, -9)]);
      this.punto = new V3();
      this.siguiente = new V3();
      this.el.setObject3D('mesh', grupo);
    },
    tick: function (tiempo, dt) {
      const t = estado.jibias;
      this.grupo.visible = t > 0;
      if (!this.grupo.visible) {
        this.animales.forEach((a) => (a.avance = 0));
        return;
      }
      const s = segundos(dt);
      const ahora = U.uTiempo.value;
      this.animales.forEach((a) => {
        // Si la alumbran, la jibia destella en blanco y rojo y escapa más rápido.
        const luz = a.objeto.visible ? B.iluminado(a.objeto.position) : 0;
        a.susto += (luz - a.susto) * Math.min(1, s * (luz > a.susto ? 6 : 0.8));
        const piel = a.objeto.userData.piel;
        const destello = a.susto * (0.5 + 0.5 * Math.sin(ahora * 14 + a.fase));
        piel.emissive.setRGB(0.16 + destello * 0.9, 0.03 + destello * 0.55, 0.02 + destello * 0.45);
        if (t > a.retraso) a.avance += (s / this.data.duracion) * (1 + a.susto * 1.8);
        const k = limitar(a.avance);
        // Avanza a impulsos: cada chorro la empuja y luego se desliza.
        const pulso = Math.sin(ahora * (2.6 + a.susto * 3) + a.fase);
        const avance = limitar(k + pulso * 0.006);
        this.ruta.getPointAt(avance, this.punto);
        this.ruta.getPointAt(Math.max(0, avance - 0.02), this.siguiente);
        a.objeto.position.copy(this.punto).add(a.desfase);
        // Nadan con la punta del manto por delante: miran hacia atrás.
        a.objeto.lookAt(this.siguiente.add(a.desfase));
        a.objeto.visible = k > 0 && k < 1;
        const apertura = 0.12 + Math.max(0, pulso) * 0.28;
        a.objeto.userData.brazos.forEach((codo, i) => (codo.rotation.x = -Math.PI / 2 + apertura * (i < 2 ? 0.5 : 1)));
      });
    },
  });

  /* ---------- Peces linterna: un banco de luces pequeñas ---------- */
  AFRAME.registerComponent('peces-linterna', {
    schema: { cantidad: { default: 220 } },
    init: function () {
      const n = this.data.cantidad;
      const posiciones = new Float32Array(n * 3);
      const datos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        posiciones[i * 3] = (Math.random() - 0.5) * 7;
        posiciones[i * 3 + 1] = (Math.random() - 0.5) * 2.6;
        posiciones[i * 3 + 2] = (Math.random() - 0.5) * 3.2;
        datos[i * 3] = Math.random();
        datos[i * 3 + 1] = 0.6 + Math.random() * 0.8;
        datos[i * 3 + 2] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
      geo.setAttribute('aDatos', new THREE.BufferAttribute(datos, 3));
      this.uFuerza = { value: 0 };
      this.uDispersion = { value: 0 };
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTiempo: U.uTiempo, uEscalaPuntos: U.uEscalaPuntos, uFuerza: this.uFuerza, uDispersion: this.uDispersion, uMapa: { value: B.texPunto() } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        vertexShader: `
          attribute vec3 aDatos;
          uniform float uTiempo;
          uniform float uEscalaPuntos;
          uniform float uDispersion;
          varying float vBrillo;
          void main(){
            // Al alumbrarlo, el banco se abre y se dispersa.
            vec3 p = position * (1.0 + uDispersion * 1.7);
            // El banco ondula y cada pez se mueve un poco por su cuenta.
            p.x += sin(uTiempo * 1.3 * aDatos.y + aDatos.x * 30.0) * 0.25;
            p.y += sin(uTiempo * 0.9 + p.x * 0.8 + aDatos.z * 10.0) * 0.3;
            p.z += cos(uTiempo * 1.1 * aDatos.y + aDatos.z * 20.0) * 0.2;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vBrillo = (0.45 + 0.55 * sin(uTiempo * 5.0 * aDatos.y + aDatos.x * 50.0)) * exp(mv.z * 0.05) * (1.0 + uDispersion * 0.8);
            gl_PointSize = clamp(0.035 * uEscalaPuntos / max(-mv.z, 0.3), 1.0, 22.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uMapa;
          uniform float uFuerza;
          varying float vBrillo;
          void main(){
            float a = texture2D(uMapa, gl_PointCoord).a * vBrillo * uFuerza;
            gl_FragColor = vec4(vec3(0.35, 0.75, 1.0) * a * 1.4, 1.0);
            ${B.GLSL_SALIDA}
          }`,
      });
      this.puntos = new THREE.Points(geo, mat);
      this.puntos.frustumCulled = false;
      this.el.setObject3D('mesh', this.puntos);
    },
    tick: function (tiempo, dt) {
      const p = estado.profundidad;
      const luz = this.puntos.visible ? B.iluminado(this.puntos.position) : 0;
      this.uDispersion.value += (luz - this.uDispersion.value) * Math.min(1, segundos(dt) * (luz > this.uDispersion.value ? 3 : 0.5));
      const fuerza = estado.enSuperficie ? 0 : limitar((p - 230) / 120) * limitar((1150 - p) / 200);
      this.uFuerza.value = fuerza;
      this.puntos.visible = fuerza > 0.01;
      if (!this.puntos.visible) return;
      // El banco cruza de derecha a izquierda y queda arriba a medida que se baja.
      const k = (p - 230) / 920;
      this.puntos.position.set(7 - k * 15, 2.2 + k * 3.5, -5.5 + Math.sin(k * 3.1) * 1.5);
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
