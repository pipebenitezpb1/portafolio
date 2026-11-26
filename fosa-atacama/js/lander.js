/*
 * Lander: vehículo autónomo de caída libre, como los que se usan para estudiar las fosas.
 * Bastidor de aluminio, esferas de flotación de vidrio en cascos amarillos, focos, cámara,
 * instrumentos, lastre y un brazo con carnada y barra de escala frente a la cámara.
 */
(function () {
  const B = window.FOSA_BASE;
  const { THREE, V3, U, estado, Lote, material, metal, pintura, texRejilla, suave } = B;

  const MEDIO = 0.8; // medio lado del bastidor
  const ALTO = 2.3;
  const PIVOTE_BRAZO = new V3(MEDIO, 0.08, -MEDIO - 0.02);
  const LARGO_BRAZO = 1.926;

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
      const mAlu = metal('#b3b8bc', 0.5);
      const mAluOscuro = metal('#6c7177', 0.55);
      const mTitanio = metal('#8d8f8c', 0.4);
      const mAcero = metal('#4d5055', 0.7);
      const oxido = B.texPBR('green_metal_rust', [1, 1], 'arm');
      const mLastre = new THREE.MeshStandardMaterial({ map: oxido.map, normalMap: oxido.normalMap, roughnessMap: oxido.extra, metalnessMap: oxido.extra, roughness: 1, metalness: 1, color: '#8d8f8c' });
      const mAmarillo = pintura('#d99a00', { roughness: 0.45 });
      const mNaranja = pintura('#ff5a14', { roughness: 0.6, side: THREE.DoubleSide });
      const mNegro = material('#131415', { roughness: 0.55 });
      const mPVC = material('#737b84', { roughness: 0.5 });
      const mVidrio = new THREE.MeshStandardMaterial({ color: '#cfeee8', transparent: true, opacity: 0.32, roughness: 0.04, metalness: 0 });
      const cilindro = (r, h, lados) => new THREE.CylinderGeometry(r, r, h, lados || 18);
      const caja = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      const a = MEDIO;

      // Bastidor de perfiles de aluminio.
      [[-a, -a], [a, -a], [-a, a], [a, a]].forEach(([x, z]) => {
        lote.tubo(mAlu, [x, -0.33, z], [x, ALTO, z], 0.034, 4);
        lote.agregar(cilindro(0.1, 0.03, 20), mAcero, [x, -0.335, z]);
        lote.agregar(caja(0.11, 0.11, 0.11), mAluOscuro, [x, 0.02, z]);
        lote.agregar(caja(0.11, 0.11, 0.11), mAluOscuro, [x, ALTO, z]);
      });
      [0.02, ALTO].forEach((y) => {
        lote.tubo(mAlu, [-a, y, -a], [a, y, -a], 0.03, 4);
        lote.tubo(mAlu, [-a, y, a], [a, y, a], 0.03, 4);
        lote.tubo(mAlu, [-a, y, -a], [-a, y, a], 0.03, 4);
        lote.tubo(mAlu, [a, y, -a], [a, y, a], 0.03, 4);
      });
      // Barandas a media altura (el frente queda libre para operar).
      lote.tubo(mAlu, [-a, 1.02, a], [a, 1.02, a], 0.024, 4);
      lote.tubo(mAlu, [-a, 1.02, -a], [-a, 1.02, a], 0.024, 4);
      lote.tubo(mAlu, [a, 1.02, -a], [a, 1.02, a], 0.024, 4);
      // Cruces de refuerzo atrás.
      lote.tubo(mAlu, [-a, 1.02, a], [a, ALTO, a], 0.016, 4);
      lote.tubo(mAlu, [a, 1.02, a], [-a, ALTO, a], 0.016, 4);
      // Pernos en las uniones.
      [[-a, -a], [a, -a], [-a, a], [a, a]].forEach(([x, z]) => {
        [0.02, 1.02, ALTO].forEach((y) => lote.agregar(cilindro(0.012, 0.012, 6), mAcero, [x + Math.sign(x) * 0.058, y, z], [0, 0, Math.PI / 2]));
      });

      // Esferas de flotación de vidrio dentro de cascos amarillos.
      [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].forEach(([x, z]) => {
        lote.agregar(new THREE.SphereGeometry(0.235, 28, 18), mAmarillo, [x, ALTO + 0.3, z]);
        lote.agregar(cilindro(0.262, 0.035, 28), mAmarillo, [x, ALTO + 0.3, z]);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          lote.agregar(cilindro(0.012, 0.05, 6), mAcero, [x + Math.cos(ang) * 0.245, ALTO + 0.3, z + Math.sin(ang) * 0.245]);
        }
        lote.agregar(cilindro(0.06, 0.08, 12), mNegro, [x, ALTO + 0.055, z]);
      });
      lote.tubo(mAlu, [-a, ALTO, 0], [a, ALTO, 0], 0.025, 4);
      lote.tubo(mAlu, [0, ALTO, -a], [0, ALTO, a], 0.025, 4);

      // Mástil con banderín y baliza, para encontrarlo al volver a la superficie.
      lote.tubo(mAlu, [0, ALTO, a], [0, ALTO + 1.25, a], 0.014);
      lote.agregar(new THREE.PlaneGeometry(0.34, 0.22), mNaranja, [0.18, ALTO + 1.12, a]);
      lote.agregar(cilindro(0.03, 0.09, 12), mNegro, [0, ALTO + 0.86, a]);

      // Focos LED en los brazos delanteros.
      const dirFoco = U.uFocoDir.value;
      [-1, 1].forEach((lado, i) => {
        const centro = U.uFocoPos.value[i];
        lote.tubo(mAlu, [lado * a, ALTO, -a], [centro.x, centro.y + 0.03, centro.z + 0.12], 0.018, 4);
        const orientacion = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), dirFoco[i]);
        const matriz = (desplazamiento) =>
          new THREE.Matrix4().compose(centro.clone().addScaledVector(dirFoco[i], desplazamiento), orientacion, new V3(1, 1, 1));
        lote.agregarM(cilindro(0.055, 0.14, 20), mTitanio, matriz(-0.07));
        lote.agregarM(cilindro(0.066, 0.03, 20), mNegro, matriz(-0.005));
        [-0.045, -0.075, -0.105].forEach((d) => lote.agregarM(cilindro(0.064, 0.008, 20), mTitanio, matriz(d)));
      });

      // Cámara en carcasa de titanio con cúpula de vidrio.
      const dirCamara = new V3(0, -0.5, -0.87).normalize();
      const qCamara = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), dirCamara);
      const centroCamara = new V3(0, ALTO - 0.06, -a - 0.02);
      const mCamara = (d) => new THREE.Matrix4().compose(centroCamara.clone().addScaledVector(dirCamara, d), qCamara, new V3(1, 1, 1));
      lote.agregarM(cilindro(0.06, 0.3, 20), mTitanio, mCamara(-0.15));
      lote.agregarM(cilindro(0.068, 0.03, 20), mAluOscuro, mCamara(-0.01));
      lote.agregarM(cilindro(0.045, 0.01, 20), mNegro, mCamara(0.01));
      lote.agregar(caja(0.16, 0.04, 0.1), mAluOscuro, [0, ALTO - 0.02, -a + 0.02]);

      // CTD (salinidad, temperatura y presión) con su jaula.
      lote.agregar(cilindro(0.048, 0.62, 16), mTitanio, [-a + 0.11, 1.55, a - 0.11]);
      [1.3, 1.8].forEach((y) => lote.agregar(new THREE.TorusGeometry(0.075, 0.008, 6, 20), mAlu, [-a + 0.11, y, a - 0.11], [Math.PI / 2, 0, 0]));
      lote.agregar(cilindro(0.03, 0.1, 12), mNegro, [-a + 0.11, 1.2, a - 0.11]);

      // Botellas para muestras de agua.
      [0.25, 0.45].forEach((dx) => {
        lote.agregar(cilindro(0.058, 0.7, 16), mPVC, [a - dx, 1.5, a - 0.1]);
        lote.agregar(cilindro(0.063, 0.04, 16), mNegro, [a - dx, 1.87, a - 0.1]);
        lote.agregar(cilindro(0.063, 0.04, 16), mNegro, [a - dx, 1.13, a - 0.1]);
      });
      lote.agregar(caja(0.34, 0.03, 0.05), mAlu, [a - 0.35, 1.5, a - 0.03]);

      // Baterías y electrónica en cilindros de presión.
      lote.agregar(cilindro(0.09, 1.0, 20), mAluOscuro, [0, 0.2, a - 0.14], [0, 0, Math.PI / 2]);
      [-0.52, 0.52].forEach((x) => lote.agregar(cilindro(0.1, 0.05, 20), mTitanio, [x, 0.2, a - 0.14], [0, 0, Math.PI / 2]));
      lote.agregar(new THREE.TorusGeometry(0.16, 0.012, 6, 20, Math.PI), mNegro, [0.56, 0.36, a - 0.14], [0, Math.PI / 2, 0]);
      lote.agregar(new THREE.TorusGeometry(0.2, 0.012, 6, 20, Math.PI), mNegro, [-0.56, 0.4, a - 0.14], [0, Math.PI / 2, 0]);

      // Lastre de acero: se suelta al terminar para que el lander suba solo.
      [-1, 1].forEach((lado) => {
        for (let i = 0; i < 3; i++) lote.agregar(caja(0.12, 0.05, 0.6), mLastre, [lado * (a + 0.085), 0.1 + i * 0.055, 0]);
        lote.agregar(caja(0.03, 0.22, 0.05), mAluOscuro, [lado * (a + 0.085), 0.13, 0.22]);
        lote.agregar(caja(0.03, 0.22, 0.05), mAluOscuro, [lado * (a + 0.085), 0.13, -0.22]);
      });

      const grupo = lote.construir();

      // Plataforma de rejilla.
      const rejilla = new THREE.Mesh(
        new THREE.PlaneGeometry(a * 2, a * 2),
        new THREE.MeshStandardMaterial({ map: texRejilla(), color: '#5d6166', alphaTest: 0.5, metalness: 0.85, roughness: 0.55, side: THREE.DoubleSide })
      );
      rejilla.rotation.x = -Math.PI / 2;
      rejilla.position.y = 0.045;
      grupo.add(rejilla);

      // Cúpula de la cámara y baliza intermitente.
      const cupula = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mVidrio);
      cupula.position.copy(centroCamara).addScaledVector(dirCamara, 0.0);
      cupula.quaternion.setFromUnitVectors(new V3(0, 1, 0), dirCamara);
      grupo.add(cupula);
      this.baliza = new THREE.MeshBasicMaterial({ color: '#111111' });
      const luzBaliza = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), this.baliza);
      luzBaliza.position.set(0, ALTO + 0.93, a);
      grupo.add(luzBaliza);

      // Lentes de los focos, luces y haces.
      this.lente = new THREE.MeshBasicMaterial({ color: '#1c1c18' });
      this.focos = [];
      this.haces = [];
      [0, 1].forEach((i) => {
        const centro = U.uFocoPos.value[i];
        const lente = new THREE.Mesh(new THREE.CircleGeometry(0.052, 24), this.lente);
        lente.position.copy(centro).addScaledVector(dirFoco[i], 0.012);
        lente.quaternion.setFromUnitVectors(new V3(0, 0, 1), dirFoco[i]);
        grupo.add(lente);
        if (interior) {
          const foco = new THREE.SpotLight('#eaf3ff', 0, 20, 0.64, 0.6, 1.3);
          foco.position.copy(centro);
          foco.target.position.copy(centro).addScaledVector(dirFoco[i], 4);
          grupo.add(foco);
          grupo.add(foco.target);
          this.focos.push(foco);
          const haz = hazDeLuz(9, 4.4, 0.09);
          haz.position.copy(centro);
          haz.quaternion.setFromUnitVectors(new V3(0, -1, 0), dirFoco[i]);
          grupo.add(haz);
          this.haces.push(haz);
        }
      });

      // Brazo de la carnada, con barra de escala.
      this.brazo = this.crearBrazo(mAlu, mNegro, mAcero);
      this.brazo.position.copy(PIVOTE_BRAZO);
      grupo.add(this.brazo);
      const bisagra = new THREE.Mesh(caja(0.12, 0.1, 0.08), mAluOscuro);
      bisagra.position.copy(PIVOTE_BRAZO);
      grupo.add(bisagra);

      // Eslingas para colgarlo de la grúa.
      if (!interior) {
        const mCable = metal('#2c2f33', 0.6);
        const eslingas = new Lote();
        [[-a, -a], [a, -a], [-a, a], [a, a]].forEach(([x, z]) => eslingas.tubo(mCable, [x, ALTO, z], [0, ALTO + 1.3, 0], 0.008, 6));
        eslingas.agregar(new THREE.TorusGeometry(0.06, 0.014, 8, 16), mAcero, [0, ALTO + 1.35, 0]);
        grupo.add(eslingas.construir());
      }

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
      // Guardado, el brazo va plegado a lo largo del borde delantero.
      grupo.rotation.order = 'YXZ';
      grupo.rotation.y = Math.PI / 2;
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

      // Baliza: un destello corto cada dos segundos.
      const destello = t % 2000 < 90 ? 1 : 0;
      this.baliza.color.setRGB(0.06 + destello * 1.5, 0.06 + destello * 1.5, 0.06 + destello * 1.4);

      if (interior) {
        // El brazo gira y baja la carnada frente a la cámara.
        const k = estado.carnada > 0 ? suave(0, 2.4, estado.carnada) : 0;
        this.brazo.rotation.y = Math.PI / 2 + (0.433 - Math.PI / 2) * k;
        this.brazo.rotation.x = -0.146 * k;
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
