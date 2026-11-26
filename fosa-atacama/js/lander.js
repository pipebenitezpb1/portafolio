/*
 * Lander Audacia: el vehículo de caída libre de la expedición Atacamex 2018, modelado a partir
 * de las fotografías publicadas. Es una torre blanca, alta y angosta: arriba lleva esferas de
 * vidrio que la hacen flotar (tres en una columna lateral), abajo cilindros negros con las
 * botellas de muestras y los instrumentos, y encima antenas y un banderín para encontrarla.
 * Los focos, la cámara y el brazo con carnada son los que usa la experiencia.
 */
(function () {
  const B = window.FOSA_BASE;
  const { THREE, V3, U, estado, Lote, material, metal, pintura, texRejilla, suave } = B;

  // La torre queda adelante y a la izquierda de la persona; ilumina el fondo frente a ella.
  const BASE = new V3(-1.15, B.ALTURA_FONDO, -1.95);
  const LADO = 0.31; // medio lado de la torre
  const ALTO = 2.6;
  const PIVOTE_BRAZO = new V3(BASE.x + LADO, B.ALTURA_FONDO + 0.38, BASE.z + LADO);
  const HACIA_CARNADA = B.POSICION_CARNADA.clone().sub(PIVOTE_BRAZO);
  const LARGO_BRAZO = HACIA_CARNADA.length();
  const GIRO_BRAZO = Math.atan2(-HACIA_CARNADA.x, -HACIA_CARNADA.z);
  const CAIDA_BRAZO = Math.asin(HACIA_CARNADA.y / LARGO_BRAZO);

  // Los focos van en la torre y apuntan a la zona de la carnada.
  [[BASE.x + LADO + 0.05, B.ALTURA_FONDO + 2.2, BASE.z + LADO], [BASE.x + LADO + 0.05, B.ALTURA_FONDO + 1.55, BASE.z + LADO]].forEach((p, i) => {
    U.uFocoPos.value[i].fromArray(p);
    U.uFocoDir.value[i].copy(B.POSICION_CARNADA).add(new V3(i ? 0.5 : -0.3, 0, i ? -0.6 : 0.2)).sub(U.uFocoPos.value[i]).normalize();
  });

  function hazDeLuz(largo, radio, intensidad) {
    const geo = new THREE.ConeGeometry(radio, largo, 96, 16, true);
    geo.translate(0, -largo / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTiempo: U.uTiempo, uLuzSol: U.uLuzSol, uFuerza: { value: 0 }, uLargo: { value: largo } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: `
        uniform float uLargo;
        varying vec3 vNormalVista;
        varying vec3 vVista;
        varying float vAvance;
        varying vec3 vMundo;
        void main(){
          vAvance = -position.y / uLargo;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormalVista = normalize(normalMatrix * normal);
          vVista = normalize(-mv.xyz);
          vMundo = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTiempo;
        uniform float uLuzSol;
        uniform float uFuerza;
        varying vec3 vNormalVista;
        varying vec3 vVista;
        varying float vAvance;
        varying vec3 vMundo;
        ${B.GLSL_RUIDO}
        void main(){
          float borde = pow(abs(dot(normalize(vNormalVista), normalize(vVista))), 2.2);
          float polvo = 0.75 + 0.25 * ruido(vMundo.xy * 5.0 + vec2(0.0, uTiempo * 0.15));
          float a = uFuerza * borde * pow(1.0 - vAvance, 2.0) * smoothstep(0.0, 0.05, vAvance) * polvo * (1.0 - uLuzSol * 0.85);
          gl_FragColor = vec4(vec3(0.78, 0.88, 1.0) * a, 1.0);
          ${B.GLSL_SALIDA}
        }`,
    });
    const malla = new THREE.Mesh(geo, mat);
    malla.userData.intensidad = intensidad;
    malla.renderOrder = 5;
    return malla;
  }
  B.hazDeLuz = hazDeLuz;

  AFRAME.registerComponent('lander', {
    schema: { modo: { default: 'interior' } },
    init: function () {
      const interior = this.data.modo === 'interior';
      const lote = new Lote();
      const mBlanco = material('#d9dcda', { roughness: 0.55 });
      const mNegro = material('#131415', { roughness: 0.5 });
      const mAcero = metal('#9a9fa4', 0.35);
      const mTitanio = metal('#8d8f8c', 0.4);
      const mRosa = material('#d8457f', { roughness: 0.7 });
      const mVerde = new THREE.MeshStandardMaterial({ color: '#b8f000', roughness: 0.7, side: THREE.DoubleSide, emissive: new THREE.Color('#3a4d00'), emissiveIntensity: 0.25 });
      const mRojo = new THREE.MeshStandardMaterial({ color: '#d8261c', roughness: 0.7, side: THREE.DoubleSide });
      const mVidrio = new THREE.MeshStandardMaterial({ color: '#dff2f0', transparent: true, opacity: 0.38, roughness: 0.03, metalness: 0.1 });
      const cilindro = (r, h, lados) => new THREE.CylinderGeometry(r, r, h, lados || 18);
      const caja = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      const a = LADO;

      // Bastidor de placas blancas: cuatro esquinas y marcos horizontales.
      [[-a, -a], [a, -a], [-a, a], [a, a]].forEach(([x, z]) => {
        lote.agregar(caja(0.07, ALTO, 0.018), mBlanco, [x, ALTO / 2, z + Math.sign(z) * 0.0]);
        lote.agregar(caja(0.018, ALTO, 0.07), mBlanco, [x, ALTO / 2, z]);
      });
      [0.02, 0.5, 1.02, 1.48, 1.92, 2.34, ALTO].forEach((y) => {
        lote.agregar(caja(a * 2 + 0.07, 0.06, 0.018), mBlanco, [0, y, -a]);
        lote.agregar(caja(a * 2 + 0.07, 0.06, 0.018), mBlanco, [0, y, a]);
        lote.agregar(caja(0.018, 0.06, a * 2 + 0.07), mBlanco, [-a, y, 0]);
        lote.agregar(caja(0.018, 0.06, a * 2 + 0.07), mBlanco, [a, y, 0]);
      });
      lote.agregar(caja(a * 2, 0.02, a * 2), mBlanco, [0, 0.02, 0]);
      lote.agregar(caja(a * 2, 0.02, a * 2), mBlanco, [0, 1.12, 0]);

      // Columna lateral con tres esferas de vidrio, en sus placas con ventana redonda.
      const xAla = -a - 0.2;
      [a, a - 0.34].forEach((z) => {
        [-0.18, 0.18].forEach((dx) => lote.agregar(caja(0.045, 1.32, 0.018), mBlanco, [xAla + dx, 1.86, z]));
      });
      [1.3, 1.74, 2.18, 2.52].forEach((y) => lote.agregar(caja(0.4, 0.018, 0.36), mBlanco, [xAla, y - 0.1, a - 0.17]));
      this.esferas = [];
      [1.42, 1.86, 2.3].forEach((y) => this.esferas.push([xAla, y, a - 0.17]));
      // Dos esferas más dentro de la parte alta de la torre.
      this.esferas.push([0.02, 1.4, 0], [0.02, 1.84, 0], [0.02, 2.28, 0]);
      this.esferas.forEach(([x, y, z]) => {
        lote.agregar(new THREE.TorusGeometry(0.168, 0.012, 8, 32), mAcero, [x, y, z]);
        lote.agregar(new THREE.SphereGeometry(0.05, 12, 8), mAcero, [x, y - 0.1, z]);
      });
      // Boya rosada de recuperación.
      lote.agregar(new THREE.SphereGeometry(0.11, 18, 12), mRosa, [0.12, 1.62, a - 0.06]);

      // Parte baja: botellas de muestras y cilindros de instrumentos.
      [[-0.13, 0.12], [0.13, 0.12]].forEach(([x, z]) => {
        lote.agregar(cilindro(0.105, 0.86, 22), mNegro, [x, 0.56, z]);
        lote.agregar(cilindro(0.112, 0.03, 22), mAcero, [x, 0.99, z]);
        lote.agregar(cilindro(0.112, 0.03, 22), mAcero, [x, 0.13, z]);
      });
      lote.agregar(cilindro(0.045, 0.9, 14), mTitanio, [-0.12, 0.56, -0.16]);
      lote.agregar(cilindro(0.035, 0.7, 12), mAcero, [0.13, 0.5, -0.17]);
      lote.agregar(cilindro(0.06, 0.34, 14), mTitanio, [0.02, 0.3, -0.05]);
      // Cables.
      lote.agregar(new THREE.TorusGeometry(0.16, 0.009, 6, 20, Math.PI), mNegro, [0.05, 1.12, -0.1], [0, 0.6, 0]);
      lote.agregar(new THREE.TorusGeometry(0.12, 0.009, 6, 20, Math.PI), mNegro, [-0.08, 1.12, 0.1], [0, -0.9, 0]);

      // Antenas, banderín y bandera chilena.
      [[-0.2, -0.2], [0.05, -0.24]].forEach(([x, z], i) => lote.tubo(mAcero, [x, ALTO, z], [x, ALTO + 0.34 + i * 0.1, z], 0.012));
      lote.agregar(cilindro(0.02, 0.07, 10), mNegro, [-0.2, ALTO + 0.36, -0.2]);
      lote.tubo(mAcero, [0.22, ALTO, 0.22], [0.22, ALTO + 0.95, 0.22], 0.008);
      lote.agregar(new THREE.PlaneGeometry(0.4, 0.3), mVerde, [0.43, ALTO + 0.78, 0.22]);
      lote.agregar(new THREE.PlaneGeometry(0.46, 0.035), mRojo, [0.43, ALTO + 0.78, 0.221], [0, 0, 0.62]);
      // Eslinga para izarlo.
      [[-a, -a], [a, -a], [-a, a], [a, a]].forEach(([x, z]) => lote.tubo(mAcero, [x, ALTO, z], [0, ALTO + 0.55, 0], 0.006, 6));
      lote.agregar(new THREE.TorusGeometry(0.045, 0.01, 8, 16), mAcero, [0, ALTO + 0.58, 0]);

      // Lastre: cuelga bajo la torre y se suelta para volver a la superficie.
      lote.agregar(cilindro(0.16, 0.12, 20), metal('#3c3f43', 0.75), [0, -0.02, 0]);

      // Focos LED y cámara, en el costado que mira a la carnada.
      const dirFoco = U.uFocoDir.value;
      const local = (v) => v.clone().sub(BASE);
      [0, 1].forEach((i) => {
        const centro = local(U.uFocoPos.value[i]);
        const giro = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), dirFoco[i]);
        const matriz = (d) => new THREE.Matrix4().compose(centro.clone().addScaledVector(dirFoco[i], d), giro, new V3(1, 1, 1));
        lote.agregarM(cilindro(0.05, 0.13, 20), mTitanio, matriz(-0.065));
        lote.agregarM(cilindro(0.06, 0.025, 20), mNegro, matriz(-0.005));
        lote.agregar(caja(0.1, 0.03, 0.05), mBlanco, [centro.x - 0.05, centro.y, centro.z]);
      });
      const dirCamara = B.POSICION_CARNADA.clone().sub(BASE).sub(new V3(a, 1.9, a)).normalize();
      const centroCamara = new V3(a + 0.03, 1.9, a - 0.12);
      const qCamara = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), dirCamara);
      const mCamara = (d) => new THREE.Matrix4().compose(centroCamara.clone().addScaledVector(dirCamara, d), qCamara, new V3(1, 1, 1));
      lote.agregarM(cilindro(0.055, 0.26, 20), mTitanio, mCamara(-0.13));
      lote.agregarM(cilindro(0.04, 0.01, 20), mNegro, mCamara(0.006));

      const grupo = lote.construir();

      // Esferas de vidrio (transparentes) con su carga interior.
      this.esferas.forEach(([x, y, z]) => {
        const vidrio = new THREE.Mesh(new THREE.SphereGeometry(0.165, 28, 18), mVidrio);
        vidrio.position.set(x, y, z);
        vidrio.renderOrder = 4;
        grupo.add(vidrio);
      });

      // Bandera chilena en la placa superior.
      const lienzo = document.createElement('canvas');
      lienzo.width = 96;
      lienzo.height = 64;
      const c = lienzo.getContext('2d');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, 96, 32);
      c.fillStyle = '#d52b1e';
      c.fillRect(0, 32, 96, 32);
      c.fillStyle = '#0039a6';
      c.fillRect(0, 0, 32, 32);
      c.fillStyle = '#ffffff';
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        c.lineTo(16 + Math.cos(ang) * 9, 16 + Math.sin(ang) * 9);
      }
      c.fill();
      const texBandera = new THREE.CanvasTexture(lienzo);
      texBandera.colorSpace = THREE.SRGBColorSpace;
      const bandera = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshStandardMaterial({ map: texBandera, roughness: 0.6 }));
      bandera.position.set(-a + 0.12, 2.47, a + 0.012);
      grupo.add(bandera);

      // Lentes, luces y haces.
      this.lente = new THREE.MeshBasicMaterial({ color: '#1c1c18' });
      this.focos = [];
      this.haces = [];
      [0, 1].forEach((i) => {
        const centro = local(U.uFocoPos.value[i]);
        const lente = new THREE.Mesh(new THREE.CircleGeometry(0.047, 24), this.lente);
        lente.position.copy(centro).addScaledVector(dirFoco[i], 0.011);
        lente.quaternion.setFromUnitVectors(new V3(0, 0, 1), dirFoco[i]);
        grupo.add(lente);
        if (interior) {
          const foco = new THREE.SpotLight('#eaf3ff', 0, 20, 0.7, 0.6, 1.3);
          foco.position.copy(centro);
          foco.target.position.copy(centro).addScaledVector(dirFoco[i], 4);
          grupo.add(foco);
          grupo.add(foco.target);
          this.focos.push(foco);
          const haz = hazDeLuz(7, 3.6, 0.09);
          haz.position.copy(centro);
          haz.quaternion.setFromUnitVectors(new V3(0, -1, 0), dirFoco[i]);
          grupo.add(haz);
          this.haces.push(haz);
        }
      });

      // Brazo de la carnada, con barra de escala.
      this.brazo = this.crearBrazo(material('#c9ccca', { roughness: 0.5 }), mNegro, mAcero);
      this.brazo.position.copy(local(PIVOTE_BRAZO));
      grupo.add(this.brazo);

      grupo.position.copy(interior ? BASE : new V3(0, 0, 0));
      this.grupo = grupo;
      this.el.setObject3D('mesh', grupo);
    },

    crearBrazo: function (mAlu, mNegro, mAcero) {
      const lote = new Lote();
      const L = LARGO_BRAZO;
      lote.tubo(mAlu, [0, 0, 0], [0, 0, -L], 0.016, 8);
      // Barra de escala con marcas cada 5 cm.
      const lienzo = document.createElement('canvas');
      lienzo.width = 256;
      lienzo.height = 16;
      const c = lienzo.getContext('2d');
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? '#f4f4f0' : '#111111';
        c.fillRect(i * 32, 0, 32, 16);
      }
      const texEscala = new THREE.CanvasTexture(lienzo);
      texEscala.colorSpace = THREE.SRGBColorSpace;
      const mEscala = new THREE.MeshStandardMaterial({ map: texEscala, roughness: 0.6 });
      lote.agregar(new THREE.BoxGeometry(0.4, 0.022, 0.022), mEscala, [0, 0, -L + 0.02]);

      // Carnada: un pescado amarrado con amarras plásticas.
      const mPescado = new THREE.MeshStandardMaterial({ color: '#8fa3b4', metalness: 0.55, roughness: 0.35 });
      const mVientre = new THREE.MeshStandardMaterial({ color: '#d9dcd8', metalness: 0.3, roughness: 0.4 });
      lote.agregar(new THREE.SphereGeometry(1, 20, 14), mPescado, [0, 0.035, -L + 0.19], [0, 0, 0], [0.03, 0.036, 0.15]);
      lote.agregar(new THREE.SphereGeometry(1, 16, 10), mVientre, [0, 0.022, -L + 0.19], [0, 0, 0], [0.027, 0.028, 0.14]);
      lote.agregar(new THREE.ConeGeometry(0.04, 0.07, 4), mPescado, [0, 0.035, -L + 0.37], [-Math.PI / 2, 0, 0], [0.18, 1, 1]);
      [0.1, 0.26].forEach((d) => lote.agregar(new THREE.TorusGeometry(0.04, 0.004, 6, 16), mNegro, [0, 0.022, -L + d]));
      lote.agregar(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), mAcero, [0, 0, -L]);
      const grupo = lote.construir();
      // Guardado, el brazo va plegado hacia arriba, pegado a la torre.
      grupo.rotation.order = 'YXZ';
      grupo.rotation.y = GIRO_BRAZO;
      grupo.rotation.x = 1.5;
      return grupo;
    },

    tick: function (t) {
      const interior = this.data.modo === 'interior';
      const f = interior ? estado.focos : 0;
      this.focos.forEach((foco) => (foco.intensity = f * 13));
      this.haces.forEach((haz) => {
        haz.material.uniforms.uFuerza.value = f * haz.userData.intensidad;
        haz.visible = f > 0.01;
      });
      this.lente.color.setRGB(0.1 + f * 1.6, 0.1 + f * 1.7, 0.09 + f * 1.8);

      if (interior) {
        // El brazo baja la carnada frente a la cámara.
        const k = estado.carnada > 0 ? suave(0, 2.4, estado.carnada) : 0;
        this.brazo.rotation.x = 1.5 + (CAIDA_BRAZO - 1.5) * k;
      } else {
        // Colgado de la grúa: se balancea y cae al soltarlo.
        this.grupo.rotation.z = Math.sin(t * 0.0011) * 0.035;
        this.grupo.rotation.x = Math.sin(t * 0.0008 + 1.0) * 0.02;
        this.grupo.position.y = -estado.caida * estado.caida * 7.5;
        this.grupo.visible = estado.caida < 0.99;
      }
    },
  });
})();
