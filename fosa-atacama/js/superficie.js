/*
 * Escena de superficie: amanecer frente a Antofagasta.
 * Cielo y océano con shaders propios, cordillera de la costa, barco de investigación y chapuzón.
 */
(function () {
  const B = window.FOSA_BASE;
  const { THREE, V3, U, estado, Lote, material, metal, pintura, texCubierta, texPunto, fbm } = B;

  /* ---------- Cielo al amanecer ---------- */
  AFRAME.registerComponent('cielo-amanecer', {
    init: function () {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTiempo: U.uTiempo, uSol: U.uSol, uCielo: U.uCielo },
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `
          varying vec3 vDir;
          void main(){
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform float uTiempo;
          varying vec3 vDir;
          ${B.GLSL_RUIDO}
          ${B.GLSL_CIELO}
          void main(){
            vec3 d = normalize(vDir);
            vec3 c = colorCielo(vec3(d.x, max(d.y, 0.0), d.z));
            // Resplandor del sol (en la foto el disco sale recortado).
            float s = max(dot(d, uSol), 0.0);
            c += vec3(1.0, 0.72, 0.42) * (pow(s, 600.0) * 2.5 + pow(s, 60.0) * 0.18);
            gl_FragColor = vec4(c, 1.0);
            ${B.GLSL_SALIDA}
          }`,
      });
      const domo = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat);
      domo.renderOrder = -20;
      domo.frustumCulled = false;
      this.el.setObject3D('mesh', domo);
    },
  });

  /* ---------- Océano ---------- */
  AFRAME.registerComponent('oceano', {
    schema: { tamano: { default: 5000 }, segmentos: { default: 220 } },
    init: function () {
      // Malla más densa cerca del barco: se comprimen los vértices hacia el centro.
      const geo = new THREE.PlaneGeometry(2, 2, this.data.segmentos, this.data.segmentos);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      const mitad = this.data.tamano / 2;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setX(i, Math.sign(x) * Math.pow(Math.abs(x), 2.6) * mitad);
        pos.setZ(i, Math.sign(z) * Math.pow(Math.abs(z), 2.6) * mitad);
      }
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTiempo: U.uTiempo, uSol: U.uSol, uCielo: U.uCielo },
        fog: false,
        vertexShader: `
          uniform float uTiempo;
          varying vec3 vMundo;
          varying vec2 vPendiente;
          #define OLA(dx, dz, k, a, w) { float f = dot(vec2(dx, dz), p) * k + uTiempo * w; h += a * sin(f); pendiente += a * k * cos(f) * vec2(dx, dz); }
          void main(){
            vec4 m = modelMatrix * vec4(position, 1.0);
            vec2 p = m.xz;
            float h = 0.0;
            vec2 pendiente = vec2(0.0);
            OLA(0.80, 0.60, 0.085, 0.34, 0.55)
            OLA(-0.50, 0.86, 0.150, 0.20, 0.78)
            OLA(0.95, -0.30, 0.290, 0.10, 1.15)
            OLA(0.20, 0.98, 0.610, 0.045, 1.80)
            OLA(-0.70, -0.70, 1.050, 0.022, 2.50)
            m.y += h;
            vMundo = m.xyz;
            vPendiente = pendiente;
            gl_Position = projectionMatrix * viewMatrix * m;
          }`,
        fragmentShader: `
          uniform float uTiempo;
          varying vec3 vMundo;
          varying vec2 vPendiente;
          ${B.GLSL_RUIDO}
          ${B.GLSL_CIELO}
          void main(){
            vec3 haciaCamara = cameraPosition - vMundo;
            float distancia = length(haciaCamara);
            vec3 V = haciaCamara / distancia;
            vec2 p = vMundo.xz;

            // Rizado fino que se desvanece con la distancia.
            float detalle = 1.0 / (1.0 + distancia * 0.025);
            vec2 pendiente = vPendiente;
            pendiente += detalle * 0.45 * (vec2(ruido(p * 1.6 + uTiempo * 0.55), ruido(p * 1.6 + 7.3 - uTiempo * 0.45)) - 0.5);
            pendiente += detalle * 0.28 * (vec2(ruido(p * 5.3 - uTiempo * 0.9), ruido(p * 5.3 + 3.1 + uTiempo * 0.8)) - 0.5);
            pendiente += 0.06 * (vec2(ruido(p * 0.35 + uTiempo * 0.2), ruido(p * 0.35 + 5.0)) - 0.5);
            vec3 N = normalize(vec3(-pendiente.x, 1.0, -pendiente.y));

            float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
            vec3 R = reflect(-V, N);
            R.y = abs(R.y);
            vec3 reflejo = colorCielo(R);
            vec3 profundo = vec3(0.006, 0.040, 0.060) + vec3(0.0, 0.03, 0.04) * max(dot(N, uSol), 0.0);
            vec3 c = mix(profundo, reflejo, fresnel);

            // Camino de luz del sol sobre el agua.
            float brillo = max(dot(R, uSol), 0.0);
            c += vec3(1.0, 0.66, 0.34) * (pow(brillo, 420.0) * 6.0 + pow(brillo, 50.0) * 0.30);

            // Luz cálida de la cubierta sobre el agua cercana.
            float cerca = exp(-length(p - vec2(200.0, -3.0)) * 0.10);
            c += vec3(1.0, 0.72, 0.42) * cerca * 0.05 * (0.4 + fresnel * 2.0);

            // Bruma hacia el horizonte.
            float bruma = 1.0 - exp(-pow(distancia / 1100.0, 2.0));
            c = mix(c, colorCielo(normalize(vec3(-V.x, 0.004, -V.z))), bruma);

            gl_FragColor = vec4(c, 1.0);
            ${B.GLSL_SALIDA}
          }`,
      });
      const malla = new THREE.Mesh(geo, mat);
      malla.frustumCulled = false;
      this.el.setObject3D('mesh', malla);
    },
  });

  /* ---------- Cordillera de la costa y luces de la ciudad ---------- */
  AFRAME.registerComponent('costa', {
    init: function () {
      const g = new THREE.Group();
      const sol = U.uSol.value;
      const azimut = Math.atan2(sol.z, sol.x);
      const pasos = 220;
      const posiciones = [];
      const colores = [];
      const indices = [];
      for (let i = 0; i <= pasos; i++) {
        const a = azimut - 1.25 + (i / pasos) * 2.5;
        const distancia = 4200 + fbm(i * 0.05, 3.1, 3) * 500;
        const borde = Math.min(1, Math.min(i, pasos - i) / 30);
        const alto = (25 + fbm(i * 0.09, 0.7, 4) * 95 + fbm(i * 0.5, 9.0, 2) * 18) * borde;
        const x = Math.cos(a) * distancia;
        const z = Math.sin(a) * distancia;
        posiciones.push(x, -4, z, x, alto, z);
        colores.push(0.20, 0.17, 0.20, 0.07, 0.07, 0.11);
        if (i < pasos) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
      geo.setIndex(indices);
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })));

      // Luces de Antofagasta al pie de los cerros.
      const cantidad = 420;
      const luces = new Float32Array(cantidad * 3);
      for (let i = 0; i < cantidad; i++) {
        const a = azimut - 0.75 + Math.pow(Math.random(), 1.4) * 1.1;
        const distancia = 4000 + Math.random() * 150;
        luces[i * 3] = Math.cos(a) * distancia;
        luces[i * 3 + 1] = 2 + Math.random() * Math.random() * 40;
        luces[i * 3 + 2] = Math.sin(a) * distancia;
      }
      const geoLuces = new THREE.BufferGeometry();
      geoLuces.setAttribute('position', new THREE.BufferAttribute(luces, 3));
      g.add(new THREE.Points(geoLuces, new THREE.PointsMaterial({ color: '#ffc27a', size: 2.2, sizeAttenuation: false, map: texPunto(), transparent: true, opacity: 0.9, depthWrite: false, fog: false })));
      this.el.setObject3D('mesh', g);
    },
  });

  /* ---------- Barco de investigación ---------- */
  AFRAME.registerComponent('barco', {
    init: function () {
      const lote = new Lote();
      const placa = B.texPBR('metal_plate', [5, 10], 'arm');
      const mCubierta = new THREE.MeshStandardMaterial({ map: placa.map, normalMap: placa.normalMap, roughnessMap: placa.extra, metalnessMap: placa.extra, aoMap: placa.extra, roughness: 1, metalness: 1, color: '#9aa39f' });
      const oxidado = B.texPBR('green_metal_rust', [3, 1], 'arm');
      const mBlanco = pintura('#a9a8a0');
      const mCasco = new THREE.MeshStandardMaterial({ map: oxidado.map, normalMap: oxidado.normalMap, roughnessMap: oxidado.extra, metalnessMap: oxidado.extra, roughness: 1, metalness: 1, color: '#7d8a82' });
      const mAmarillo = pintura('#c98a06');
      const mAcero = metal('#8a9096', 0.5);
      const mOscuro = metal('#2c2f33', 0.6);
      const mNegro = material('#101112', { roughness: 0.6 });
      const mCaja = pintura('#b98209');
      const mCuerda = material('#8a7650', { roughness: 1 });
      const caja = (w, h, d) => new THREE.BoxGeometry(w, h, d);
      const cilindro = (r, h, lados) => new THREE.CylinderGeometry(r, r, h, lados || 16);

      // Cubierta y casco.
      lote.agregar(caja(9, 0.2, 18), mCubierta, [0, -0.1, 5]);
      lote.agregar(caja(9.3, 3.2, 18.3), mCasco, [0, -1.85, 5]);
      lote.agregar(caja(9.36, 0.25, 18.36), mBlanco, [0, -0.32, 5]);

      // Amuradas laterales con pasamanos.
      [-1, 1].forEach((lado) => {
        lote.agregar(caja(0.08, 1.0, 17), mCasco, [lado * 4.46, 0.5, 5.5], [0, 0, 0]);
        lote.agregar(caja(0.16, 0.06, 17), mAcero, [lado * 4.46, 1.03, 5.5]);
        for (let z = -2.5; z <= 13; z += 1.55) lote.agregar(caja(0.06, 1.0, 0.1), mBlanco, [lado * 4.4, 0.5, z]);
      });

      // Popa abierta: candeleros y cadenas de seguridad.
      for (let x = -4.4; x <= 4.41; x += 1.1) {
        if (Math.abs(x) < 1.2) continue;
        lote.tubo(mAcero, [x, 0, -3.9], [x, 1.05, -3.9], 0.025);
      }
      [0.55, 1.0].forEach((y) => {
        lote.tubo(mOscuro, [-4.4, y, -3.9], [-1.65, y, -3.9], 0.012, 6);
        lote.tubo(mOscuro, [1.65, y, -3.9], [4.4, y, -3.9], 0.012, 6);
      });

      // Pórtico en A (grúa de popa) con cilindros hidráulicos.
      const cima = [0, 5.6, -5.6];
      [-1, 1].forEach((lado) => {
        lote.tubo(mAmarillo, [lado * 1.9, 0, -3.2], [lado * 1.25, 5.6, -5.6], 0.13, 4);
        lote.agregar(caja(0.5, 0.12, 0.6), mOscuro, [lado * 1.9, 0.06, -3.2]);
        lote.tubo(mAcero, [lado * 1.9, 0.15, -1.2], [lado * 1.62, 2.4, -4.2], 0.05);
        lote.tubo(mOscuro, [lado * 1.9, 0.15, -1.2], [lado * 1.78, 1.2, -2.55], 0.075);
        lote.agregar(caja(0.3, 0.3, 0.3), mOscuro, [lado * 1.9, 0.15, -1.2]);
      });
      lote.tubo(mAmarillo, [-1.3, 5.6, -5.6], [1.3, 5.6, -5.6], 0.13, 4);
      // Polea y cable hacia el winche.
      lote.agregar(cilindro(0.2, 0.08, 24), mOscuro, [0, 5.3, -5.6], [0, 0, Math.PI / 2]);
      lote.agregar(caja(0.14, 0.45, 0.3), mAmarillo, [0, 5.42, -5.6]);
      lote.tubo(mOscuro, [0.02, 5.45, -5.45], [2.6, 0.95, 2.1], 0.009, 6);

      // Winche.
      lote.agregar(caja(1.1, 0.12, 1.0), mOscuro, [2.6, 0.06, 2.3]);
      [-0.45, 0.45].forEach((dx) => lote.agregar(caja(0.08, 0.9, 0.8), mAmarillo, [2.6 + dx, 0.55, 2.3]));
      lote.agregar(cilindro(0.3, 0.8, 28), mOscuro, [2.6, 0.72, 2.3], [0, 0, Math.PI / 2]);
      lote.agregar(cilindro(0.42, 0.04, 28), mAmarillo, [2.2, 0.72, 2.3], [0, 0, Math.PI / 2]);
      lote.agregar(cilindro(0.42, 0.04, 28), mAmarillo, [3.0, 0.72, 2.3], [0, 0, Math.PI / 2]);
      lote.agregar(caja(0.35, 0.4, 0.4), mAcero, [3.3, 0.5, 2.3]);

      // Cajas de equipo, bitas y cuerda adujada.
      lote.agregar(caja(1.1, 0.5, 0.7), mCaja, [-3.2, 0.25, 0.4], [0, 0.2, 0]);
      lote.agregar(caja(1.12, 0.05, 0.72), mNegro, [-3.2, 0.36, 0.4], [0, 0.2, 0]);
      lote.agregar(caja(0.8, 0.42, 0.6), mCaja, [-3.4, 0.21, 1.6], [0, -0.1, 0]);
      lote.agregar(caja(0.7, 0.4, 0.55), mNegro, [-3.3, 0.7, 0.45], [0, 0.5, 0]);
      [-3.4, 3.4].forEach((x) => {
        lote.agregar(cilindro(0.11, 0.42), mOscuro, [x, 0.21, -2.6]);
        lote.agregar(cilindro(0.16, 0.06), mOscuro, [x, 0.43, -2.6]);
      });
      for (let i = 0; i < 5; i++) lote.agregar(new THREE.TorusGeometry(0.36 - i * 0.015, 0.035, 8, 28), mCuerda, [3.3, 0.04 + i * 0.065, -0.9], [Math.PI / 2, 0, i * 0.5]);

      // Superestructura con puente de mando.
      lote.agregar(caja(7, 3.0, 5), mBlanco, [0, 1.5, 11.5]);
      lote.agregar(caja(7.4, 0.12, 5.4), mBlanco, [0, 3.06, 11.5]);
      lote.agregar(caja(5, 2.2, 3.4), mBlanco, [0, 4.2, 12]);
      lote.agregar(caja(5.4, 0.1, 3.8), mBlanco, [0, 5.35, 12]);
      lote.agregar(caja(0.9, 1.95, 0.06), mOscuro, [-2.2, 0.98, 8.98]);
      lote.agregar(cilindro(0.09, 0.03, 20), mAcero, [-2.2, 1.45, 8.94], [Math.PI / 2, 0, 0]);
      // Mástil con antenas.
      lote.tubo(mBlanco, [0, 5.4, 12.6], [0, 8.6, 12.6], 0.07);
      lote.tubo(mBlanco, [-0.9, 7.6, 12.6], [0.9, 7.6, 12.6], 0.035);
      lote.agregar(new THREE.SphereGeometry(0.28, 16, 12), mBlanco, [0.6, 7.95, 12.6]);
      // Focos de cubierta.
      [-2.4, 2.4].forEach((x) => {
        lote.tubo(mOscuro, [x, 3.1, 9.0], [x, 3.6, 8.75], 0.03);
        lote.agregar(caja(0.34, 0.24, 0.16), mOscuro, [x, 3.66, 8.68], [0.6, 0, 0]);
      });

      const grupo = lote.construir();

      // Vidrios encendidos y lentes de los focos (brillan solos).
      const mVentana = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
      const mLente = new THREE.MeshBasicMaterial({ color: '#fff3d8' });
      for (let i = -2; i <= 2; i++) {
        const v = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.6), mVentana);
        v.position.set(i * 0.95, 4.5, 10.29);
        v.rotation.y = Math.PI;
        grupo.add(v);
      }
      [0.6, 2.4].forEach((x) => {
        const ojo = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), mVentana);
        ojo.position.set(x, 1.7, 8.99);
        ojo.rotation.y = Math.PI;
        grupo.add(ojo);
        const marco = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 24), mAcero);
        marco.position.copy(ojo.position);
        grupo.add(marco);
      });
      [-2.4, 2.4].forEach((x) => {
        const lente = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), mLente);
        lente.position.set(x, 3.61, 8.61);
        lente.rotation.order = 'YXZ';
        lente.rotation.set(-0.6, Math.PI, 0);
        grupo.add(lente);
        const foco = new THREE.SpotLight('#ffd7a6', 7, 26, 0.75, 0.7, 1.6);
        foco.position.set(x, 3.6, 8.6);
        foco.target.position.set(x * 0.3, 0, -1.5);
        grupo.add(foco);
        grupo.add(foco.target);
      });

      // Radar que gira sobre el puente.
      this.radar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.16), mBlanco);
      this.radar.position.set(-1.2, 5.75, 12);
      grupo.add(this.radar);
      const pieRadar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.35, 12), mBlanco);
      pieRadar.position.set(-1.2, 5.55, 12);
      grupo.add(pieRadar);

      // Cable del que cuelga el lander (desaparece al soltarlo).
      this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), mOscuro);
      this.cable.position.set(0, 5.2, -5.6);
      grupo.add(this.cable);

      this.el.setObject3D('mesh', grupo);
    },
    tick: function (t, dt) {
      this.radar.rotation.y += B.segundos(dt) * 1.6;
      this.cable.visible = estado.caida === 0;
    },
  });

  /* ---------- Chapuzón del lander ---------- */
  AFRAME.registerComponent('chapuzon', {
    schema: { cantidad: { default: 260 } },
    init: function () {
      const n = this.data.cantidad;
      const direcciones = new Float32Array(n * 3);
      const datos = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const abre = 0.25 + Math.random() * 0.9;
        direcciones[i * 3] = Math.cos(a) * abre;
        direcciones[i * 3 + 1] = 1.2 + Math.random() * 2.6;
        direcciones[i * 3 + 2] = Math.sin(a) * abre;
        datos[i * 2] = 0.05 + Math.random() * 0.16;
        datos[i * 2 + 1] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('aDir', new THREE.BufferAttribute(direcciones, 3));
      geo.setAttribute('aDatos', new THREE.BufferAttribute(datos, 2));
      this.uEdad = { value: 0 };
      const mat = new THREE.ShaderMaterial({
        uniforms: { uEdad: this.uEdad, uEscalaPuntos: U.uEscalaPuntos, uMapa: { value: texPunto() } },
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: `
          attribute vec3 aDir;
          attribute vec2 aDatos;
          uniform float uEdad;
          uniform float uEscalaPuntos;
          varying float vAlfa;
          void main(){
            float t = max(uEdad - aDatos.y * 0.25, 0.0);
            vec3 p = vec3(aDir.x, 0.0, aDir.z) * (0.4 + t * 1.3) + vec3(0.0, aDir.y * t - 4.9 * t * t, 0.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = aDatos.x * (1.0 + t) * uEscalaPuntos / max(-mv.z, 0.2);
            vAlfa = step(0.0001, t) * step(-0.3, p.y) * (1.0 - smoothstep(0.6, 1.5, t));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uMapa;
          varying float vAlfa;
          void main(){
            float a = texture2D(uMapa, gl_PointCoord).a * vAlfa * 0.75;
            gl_FragColor = vec4(vec3(0.95, 0.93, 0.9), a);
            ${B.GLSL_SALIDA}
          }`,
      });
      this.puntos = new THREE.Points(geo, mat);
      this.puntos.frustumCulled = false;
      this.el.setObject3D('mesh', this.puntos);
    },
    tick: function () {
      this.uEdad.value = estado.chapuzon;
      this.puntos.visible = estado.chapuzon > 0 && estado.chapuzon < 2;
    },
  });
})();
