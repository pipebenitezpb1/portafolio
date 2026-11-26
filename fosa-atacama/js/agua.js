/*
 * La columna de agua y el fondo: color y luz según la profundidad, nieve marina que solo
 * se ve donde la ilumina un haz, burbujas, bioluminiscencia, medusas, cardumen,
 * fondo de sedimento y nubes de limo.
 */
(function () {
  const B = window.FOSA_BASE;
  const { THREE, V3, U, estado, Lote, material, texSedimento, texDesgaste, texPunto, fbm, deformar, limitar, segundos, POSICION_CARNADA, ALTURA_FONDO } = B;

  /* ---------- Agua alrededor: gradiente, superficie vista desde abajo y rayos de sol ---------- */
  AFRAME.registerComponent('domo-agua', {
    init: function () {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTiempo: U.uTiempo, uColorAgua: U.uColorAgua, uLuzSol: U.uLuzSol, uProfundidad: U.uProfundidad },
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
          uniform vec3 uColorAgua;
          uniform float uLuzSol;
          uniform float uProfundidad;
          varying vec3 vDir;
          ${B.GLSL_RUIDO}
          void main(){
            vec3 d = normalize(vDir);
            vec3 c = uColorAgua;
            float arriba = max(d.y, 0.0);
            c += vec3(0.05, 0.30, 0.42) * uLuzSol * pow(arriba, 1.2);
            c *= 1.0 - 0.45 * max(-d.y, 0.0);

            if (d.y > 0.04) {
              // La superficie vista desde abajo: una ventana brillante que se aleja al bajar.
              float altura = uProfundidad + 3.0;
              vec2 q = d.xz / d.y * altura;
              float visible = exp(-altura * 0.035 / max(d.y, 0.25)) * uLuzSol;
              float ondas = fbm(q * 0.30 + uTiempo * 0.22) + 0.5 * ruido(q * 1.2 - uTiempo * 0.35);
              float destello = smoothstep(0.62, 1.05, ondas);
              float ventana = smoothstep(0.52, 0.74, d.y);
              c += vec3(0.42, 0.80, 0.92) * (0.30 + destello * 1.1) * ventana * visible;
              c += vec3(0.04, 0.16, 0.20) * destello * (1.0 - ventana) * visible;
            }

            // Rayos de sol que bajan desde la superficie.
            float angulo = atan(d.z, d.x);
            float rayos = pow(0.5 + 0.5 * sin(angulo * 9.0 + sin(angulo * 4.0 + uTiempo * 0.15) * 2.0 + uTiempo * 0.05), 5.0);
            rayos += 0.6 * pow(0.5 + 0.5 * sin(angulo * 17.0 - uTiempo * 0.08), 8.0);
            c += vec3(0.10, 0.42, 0.52) * rayos * smoothstep(-0.15, 0.7, d.y) * uLuzSol * 0.30;

            gl_FragColor = vec4(c, 1.0);
            ${B.GLSL_SALIDA}
          }`,
      });
      const domo = new THREE.Mesh(new THREE.SphereGeometry(90, 40, 24), mat);
      domo.renderOrder = -10;
      domo.frustumCulled = false;
      this.el.setObject3D('mesh', domo);
    },
  });

  /* ---------- Nieve marina ---------- */
  AFRAME.registerComponent('nieve-marina', {
    schema: { cantidad: { default: 2600 }, radio: { default: 9 } },
    init: function () {
      const n = this.data.cantidad;
      const r = this.data.radio;
      const posiciones = new Float32Array(n * 3);
      const datos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        posiciones[i * 3] = (Math.random() - 0.5) * 2 * r;
        posiciones[i * 3 + 1] = Math.random() * 14;
        posiciones[i * 3 + 2] = (Math.random() - 0.5) * 2 * r;
        datos[i * 3] = 0.004 + Math.pow(Math.random(), 3) * 0.02; // tamaño en metros
        datos[i * 3 + 1] = 0.75 + Math.random() * 0.5; // rapidez
        datos[i * 3 + 2] = Math.random(); // semilla
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
      geo.setAttribute('aDatos', new THREE.BufferAttribute(datos, 3));
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTiempo: U.uTiempo, uDesplazamiento: U.uDesplazamiento, uEscalaPuntos: U.uEscalaPuntos, uLuzSol: U.uLuzSol,
          uColorAgua: U.uColorAgua, uDensidad: U.uDensidad,
          uFocos: U.uFocos, uFocoPos: U.uFocoPos, uFocoDir: U.uFocoDir,
          uLinterna: U.uLinterna, uLinternaPos: U.uLinternaPos, uLinternaDir: U.uLinternaDir,
        },
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: `
          attribute vec3 aDatos;
          uniform float uTiempo;
          uniform float uDesplazamiento;
          uniform float uEscalaPuntos;
          uniform float uLuzSol;
          varying float vLuz;
          varying float vAlfa;
          ${B.GLSL_HACES}
          ${B.GLSL_NIEBLA}
          void main(){
            vec3 p = position;
            p.y = mod(position.y + uDesplazamiento * aDatos.y, 14.0) - 4.0;
            p.x += sin(uTiempo * 0.21 + aDatos.z * 37.0) * 0.12;
            p.z += cos(uTiempo * 0.17 + aDatos.z * 51.0) * 0.12;
            vec4 m = modelMatrix * vec4(p, 1.0);
            vec4 mv = viewMatrix * m;
            float d = -mv.z;
            vLuz = uLuzSol * 0.5 + luzHaces(m.xyz) * 4.5;
            gl_PointSize = clamp(aDatos.x * uEscalaPuntos / max(d, 0.12), 1.0, 60.0);
            // Muy cerca de los ojos los copos se ven grandes y desenfocados.
            vAlfa = (1.0 - factorNiebla(d)) * smoothstep(0.06, 0.3, d) * mix(0.3, 1.0, smoothstep(0.25, 1.8, d));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying float vLuz;
          varying float vAlfa;
          void main(){
            float r = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.12, r) * vAlfa * clamp(vLuz, 0.0, 1.0);
            if (a < 0.004) discard;
            gl_FragColor = vec4(vec3(0.86, 0.92, 0.95) * min(vLuz, 1.5), a);
            ${B.GLSL_SALIDA}
          }`,
      });
      const puntos = new THREE.Points(geo, mat);
      puntos.frustumCulled = false;
      puntos.renderOrder = 6;
      this.el.setObject3D('mesh', puntos);
    },
  });

  /* ---------- Burbujas al entrar al agua ---------- */
  AFRAME.registerComponent('burbujas', {
    schema: { cantidad: { default: 220 } },
    init: function () {
      const n = this.data.cantidad;
      const posiciones = new Float32Array(n * 3);
      const datos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.3 + Math.random() * 2.2;
        posiciones[i * 3] = Math.cos(a) * r;
        posiciones[i * 3 + 1] = Math.random() * 9;
        posiciones[i * 3 + 2] = Math.sin(a) * r;
        datos[i * 3] = 0.006 + Math.random() * 0.03;
        datos[i * 3 + 1] = 0.8 + Math.random() * 1.6;
        datos[i * 3 + 2] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
      geo.setAttribute('aDatos', new THREE.BufferAttribute(datos, 3));
      this.uFuerza = { value: 0 };
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTiempo: U.uTiempo, uEscalaPuntos: U.uEscalaPuntos, uFuerza: this.uFuerza, uLuzSol: U.uLuzSol },
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: `
          attribute vec3 aDatos;
          uniform float uTiempo;
          uniform float uEscalaPuntos;
          varying float vSemilla;
          void main(){
            vec3 p = position;
            p.y = mod(position.y + uTiempo * aDatos.y * 1.8, 9.0) - 2.0;
            p.x += sin(uTiempo * 3.0 + aDatos.z * 60.0) * 0.05;
            p.z += cos(uTiempo * 2.6 + aDatos.z * 44.0) * 0.05;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = clamp(aDatos.x * uEscalaPuntos / max(-mv.z, 0.15), 1.5, 50.0);
            vSemilla = aDatos.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform float uFuerza;
          uniform float uLuzSol;
          varying float vSemilla;
          void main(){
            vec2 q = gl_PointCoord - 0.5;
            float r = length(q);
            // Una burbuja: borde claro y un reflejo arriba.
            float aro = smoothstep(0.5, 0.42, r) * smoothstep(0.28, 0.44, r);
            float reflejo = smoothstep(0.16, 0.0, length(q - vec2(-0.12, -0.15)));
            float a = (aro * 0.7 + reflejo * 0.9 + smoothstep(0.5, 0.4, r) * 0.08) * uFuerza * step(vSemilla, uFuerza * 1.2);
            if (a < 0.01) discard;
            gl_FragColor = vec4(vec3(0.80, 0.95, 1.0) * (0.35 + uLuzSol * 0.9), a);
            ${B.GLSL_SALIDA}
          }`,
      });
      this.puntos = new THREE.Points(geo, mat);
      this.puntos.frustumCulled = false;
      this.el.setObject3D('mesh', this.puntos);
    },
    tick: function () {
      const fuerza = estado.enSuperficie ? 0 : limitar(1 - estado.profundidad / 45);
      this.uFuerza.value = fuerza;
      this.puntos.visible = fuerza > 0.01;
    },
  });

  /* ---------- Bioluminiscencia: destellos en la oscuridad ---------- */
  AFRAME.registerComponent('bioluminiscencia', {
    schema: { cantidad: { default: 260 } },
    init: function () {
      const n = this.data.cantidad;
      const posiciones = new Float32Array(n * 3);
      const datos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 2.5 + Math.random() * 13;
        posiciones[i * 3] = Math.cos(a) * r;
        posiciones[i * 3 + 1] = Math.random() * 18;
        posiciones[i * 3 + 2] = Math.sin(a) * r;
        datos[i * 3] = 0.03 + Math.random() * 0.06;
        datos[i * 3 + 1] = 0.5 + Math.random();
        datos[i * 3 + 2] = Math.random();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
      geo.setAttribute('aDatos', new THREE.BufferAttribute(datos, 3));
      this.uBio = { value: 0 };
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTiempo: U.uTiempo, uDesplazamiento: U.uDesplazamiento, uEscalaPuntos: U.uEscalaPuntos, uBio: this.uBio, uMapa: { value: texPunto() } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        vertexShader: `
          attribute vec3 aDatos;
          uniform float uTiempo;
          uniform float uDesplazamiento;
          uniform float uEscalaPuntos;
          uniform float uBio;
          varying float vBrillo;
          varying float vTono;
          void main(){
            vec3 p = position;
            p.y = mod(position.y + uDesplazamiento, 18.0) - 7.0;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float pulso = pow(max(sin(uTiempo * 0.7 * aDatos.y + aDatos.z * 40.0), 0.0), 14.0);
            vBrillo = pulso * uBio * exp(mv.z * 0.06);
            vTono = aDatos.z;
            gl_PointSize = clamp(aDatos.x * (0.6 + pulso) * uEscalaPuntos / max(-mv.z, 0.3), 1.0, 40.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uMapa;
          varying float vBrillo;
          varying float vTono;
          void main(){
            float a = texture2D(uMapa, gl_PointCoord).a * vBrillo;
            vec3 color = mix(vec3(0.15, 0.75, 1.0), vec3(0.25, 1.0, 0.75), step(0.7, vTono));
            gl_FragColor = vec4(color * a * 1.6, 1.0);
            ${B.GLSL_SALIDA}
          }`,
      });
      this.puntos = new THREE.Points(geo, mat);
      this.puntos.frustumCulled = false;
      this.el.setObject3D('mesh', this.puntos);
    },
    tick: function () {
      this.uBio.value = estado.bio;
      this.puntos.visible = estado.bio > 0.01;
    },
  });

  /* ---------- Medusa de aguas profundas ---------- */
  AFRAME.registerComponent('medusa', {
    schema: { color: { type: 'color', default: '#58d8ff' }, tamano: { default: 1 } },
    init: function () {
      const semilla = Math.random() * 100;
      const uniforms = { uTiempo: U.uTiempo, uSemilla: { value: semilla }, uBio: { value: 0 }, uColor: { value: new THREE.Color(this.data.color) } };
      this.uniforms = uniforms;
      const pulso = `
        float fase = uTiempo * 1.5 + uSemilla;
        float contraccion = sin(fase) * 0.5 + 0.5;
      `;
      const matCampana = new THREE.ShaderMaterial({
        uniforms: uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        vertexShader: `
          uniform float uTiempo;
          uniform float uSemilla;
          varying vec3 vNormalVista;
          varying vec3 vVista;
          varying vec3 vLocal;
          void main(){
            ${pulso}
            vec3 p = position;
            float borde = smoothstep(0.16, -0.06, p.y);
            p.xz *= 1.0 - 0.22 * contraccion * borde;
            p.y *= 1.0 + 0.10 * contraccion;
            vLocal = position;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vNormalVista = normalize(normalMatrix * normal);
            vVista = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform float uBio;
          uniform vec3 uColor;
          varying vec3 vNormalVista;
          varying vec3 vVista;
          varying vec3 vLocal;
          void main(){
            float contorno = pow(1.0 - abs(dot(normalize(vNormalVista), normalize(vVista))), 2.0);
            float gajos = pow(0.5 + 0.5 * sin(atan(vLocal.z, vLocal.x) * 16.0), 6.0);
            float a = (0.06 + contorno * 0.75 + gajos * 0.14 * smoothstep(0.2, 0.0, vLocal.y)) * uBio;
            gl_FragColor = vec4(uColor * a, 1.0);
            ${B.GLSL_SALIDA}
          }`,
      });
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), matCampana));
      // Estómago y gónadas: un núcleo más brillante dentro de la campana.
      const nucleo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), matCampana);
      nucleo.position.y = 0.07;
      nucleo.scale.y = 0.7;
      g.add(nucleo);

      // Tentáculos que ondulan.
      const tentaculos = 14;
      const tramos = 12;
      const pos = [];
      const avance = [];
      for (let i = 0; i < tentaculos; i++) {
        const a = (i / tentaculos) * Math.PI * 2;
        const largo = 0.6 + Math.random() * 0.7;
        for (let j = 0; j < tramos; j++) {
          [j, j + 1].forEach((k) => {
            const t = k / tramos;
            pos.push(Math.cos(a) * 0.185, -0.04 - t * largo, Math.sin(a) * 0.185);
            avance.push(t, a);
          });
        }
      }
      const geoT = new THREE.BufferGeometry();
      geoT.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geoT.setAttribute('aAvance', new THREE.Float32BufferAttribute(avance, 2));
      const matT = new THREE.ShaderMaterial({
        uniforms: uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        vertexShader: `
          attribute vec2 aAvance;
          uniform float uTiempo;
          uniform float uSemilla;
          varying float vAvance;
          void main(){
            ${pulso}
            vec3 p = position;
            float t = aAvance.x;
            p.xz *= 1.0 - 0.22 * contraccion * (1.0 - t) - 0.25 * t;
            p.x += sin(uTiempo * 1.2 - t * 5.0 + aAvance.y * 3.0 + uSemilla) * 0.06 * t;
            p.z += cos(uTiempo * 1.0 - t * 4.0 + aAvance.y * 2.0 + uSemilla) * 0.06 * t;
            p.y += contraccion * 0.05 * t;
            vAvance = t;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `
          uniform float uBio;
          uniform vec3 uColor;
          varying float vAvance;
          void main(){
            gl_FragColor = vec4(uColor * uBio * 0.5 * (1.0 - vAvance), 1.0);
            ${B.GLSL_SALIDA}
          }`,
      });
      const lineas = new THREE.LineSegments(geoT, matT);
      lineas.frustumCulled = false;
      g.add(lineas);
      g.scale.setScalar(this.data.tamano);
      g.traverse((o) => (o.frustumCulled = false));
      this.cuerpo = g;
      this.semilla = semilla;
      this.reubicar(true);
      this.el.setObject3D('mesh', g);
    },
    reubicar: function (alAzar) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.random() * 4.5;
      this.el.object3D.position.set(Math.cos(a) * r, alAzar ? Math.random() * 12 - 5 : -9, Math.sin(a) * r);
      this.el.object3D.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
    },
    tick: function (t, dt) {
      const s = segundos(dt);
      const p = this.el.object3D.position;
      const empuje = Math.max(0, Math.sin(U.uTiempo.value * 1.5 + this.semilla + 1.2));
      p.y += (estado.velocidad * 7 + 0.03 + empuje * 0.08) * s;
      if (p.y > 10) this.reubicar(false);
      // Al alumbrarla responde con un destello, como defensa.
      const luz = B.iluminado(p);
      this.destello = (this.destello || 0) + (luz - (this.destello || 0)) * Math.min(1, s * 4);
      this.uniforms.uBio.value = estado.bio * 0.85 * (1 + this.destello * 2.6);
      this.cuerpo.visible = estado.bio > 0.01;
    },
  });

  /* ---------- Cardumen cerca de la superficie ---------- */
  AFRAME.registerComponent('cardumen', {
    schema: { cantidad: { default: 150 } },
    init: function () {
      const lote = new Lote();
      const mPez = new THREE.MeshStandardMaterial({ color: '#9fb4c4', metalness: 0.75, roughness: 0.32 });
      lote.agregar(new THREE.SphereGeometry(1, 12, 8), mPez, [0, 0, 0], [0, 0, 0], [0.011, 0.02, 0.07]);
      lote.agregar(new THREE.ConeGeometry(0.02, 0.03, 4), mPez, [0, 0, -0.078], [Math.PI / 2, 0, 0], [0.12, 1, 1]);
      const geo = lote.construir().children[0].geometry;
      this.malla = new THREE.InstancedMesh(geo, mPez, this.data.cantidad);
      this.malla.frustumCulled = false;
      this.peces = [];
      for (let i = 0; i < this.data.cantidad; i++) {
        this.peces.push({
          atras: (Math.random() - 0.5) * 1.9,
          lado: (Math.random() - 0.5) * 1.6,
          alto: (Math.random() - 0.5) * 1.3,
          fase: Math.random() * 10,
        });
      }
      this.aux = new THREE.Object3D();
      this.el.setObject3D('mesh', this.malla);
    },
    tick: function () {
      const p = estado.profundidad;
      const visible = !estado.enSuperficie && p > 4 && p < 150;
      this.malla.visible = visible;
      if (!visible) return;
      const t = U.uTiempo.value;
      const alturaCentro = (p - 50) * 0.28 + 1.4; // el cardumen queda arriba a medida que se baja
      const radio = 4.6;
      this.peces.forEach((pez, i) => {
        const a = t * 0.3 + pez.atras / radio;
        const r = radio + pez.lado + Math.sin(t * 0.9 + pez.fase) * 0.15;
        this.aux.position.set(Math.cos(a) * r, alturaCentro + pez.alto + Math.sin(t * 0.7 + pez.fase) * 0.1, Math.sin(a) * r - 1.0);
        this.aux.rotation.set(0, -a + Math.sin(t * 9 + pez.fase) * 0.12, 0);
        this.aux.updateMatrix();
        this.malla.setMatrixAt(i, this.aux.matrix);
      });
      this.malla.instanceMatrix.needsUpdate = true;
    },
  });

  /* ---------- Fondo de la fosa ---------- */
  AFRAME.registerComponent('fondo-marino', {
    init: function () {
      const g = new THREE.Group();
      const barro = B.texPBR('brown_mud_03', [26, 26], 'rough');
      const mSedimento = new THREE.MeshStandardMaterial({
        map: barro.map,
        normalMap: barro.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughnessMap: barro.extra,
        roughness: 1,
        metalness: 0,
        color: '#a8a296', // el limo de la fosa es más pálido y grisáceo que el barro de la foto
      });

      const altura = (x, z) => {
        const lejos = Math.hypot(x, z);
        let h = (fbm(x * 0.09 + 20, z * 0.09 + 20, 4) - 0.5) * 0.7 + (fbm(x * 0.6 + 7, z * 0.6 + 3, 3) - 0.5) * 0.08;
        // Montículos de madrigueras.
        h += Math.pow(Math.max(0, fbm(x * 0.9 + 40, z * 0.9 + 12, 2) - 0.66), 1.4) * 0.9;
        // El lander se asienta en un claro casi plano.
        h *= B.suave(0.6, 3.5, lejos) * 0.85 + 0.15;
        // A lo lejos se levantan las paredes de la fosa.
        if (lejos > 11) h += Math.pow((lejos - 11) * 0.2, 2) * 0.9;
        return h;
      };
      const geo = new THREE.PlaneGeometry(64, 64, 160, 160);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, altura(pos.getX(i), pos.getZ(i)));
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, mSedimento));

      // Rocas medio enterradas, cubiertas de una capa de limo.
      const piedra = B.texPBR('boulder_01', [2, 2], null);
      const mRoca = new THREE.MeshStandardMaterial({ map: piedra.map, normalMap: piedra.normalMap, roughness: 0.95, color: '#8a857c' });
      const lote = new Lote();
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 2.4 + Math.pow(Math.random(), 0.7) * 13;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.abs(x) < 0.9 && z < -1.5 && z > -3.6) continue; // despejar la zona de la carnada
        const tamano = 0.08 + Math.pow(Math.random(), 2) * 0.5;
        const roca = deformar(new THREE.IcosahedronGeometry(1, 3), 0.7, 1.3);
        lote.agregar(roca, mRoca, [x, altura(x, z) + tamano * 0.12, z], [Math.random() * 3, Math.random() * 3, Math.random() * 3], [tamano, tamano * (0.45 + Math.random() * 0.3), tamano * (0.7 + Math.random() * 0.5)]);
      }
      g.add(lote.construir());

      // Pepinos de mar: animales translúcidos que recorren lentamente el sedimento.
      const mPepino = new THREE.MeshStandardMaterial({ color: '#8d6f78', transparent: true, opacity: 0.72, roughness: 0.35 });
      this.pepinos = [];
      [[-1.9, -3.4], [2.3, -4.6], [-3.3, -1.2], [1.2, -5.8]].forEach(([x, z], i) => {
        const cuerpo = new Lote();
        cuerpo.agregar(new THREE.SphereGeometry(1, 20, 14), mPepino, [0, 0.032, 0], [0, 0, 0], [0.034, 0.03, 0.075]);
        [[-0.012, 0.03], [0.012, 0.03], [-0.01, -0.02], [0.01, -0.02]].forEach(([px, pz]) =>
          cuerpo.agregar(new THREE.ConeGeometry(0.005, 0.03, 6), mPepino, [px, 0.068, pz], [pz > 0 ? 0.4 : -0.3, 0, 0])
        );
        for (let k = -2; k <= 2; k++) {
          cuerpo.agregar(new THREE.ConeGeometry(0.005, 0.02, 5), mPepino, [-0.022, 0.008, k * 0.022], [0, 0, 2.7]);
          cuerpo.agregar(new THREE.ConeGeometry(0.005, 0.02, 5), mPepino, [0.022, 0.008, k * 0.022], [0, 0, -2.7]);
        }
        const pepino = cuerpo.construir();
        pepino.position.set(x, altura(x, z), z);
        pepino.rotation.y = i * 1.7;
        pepino.scale.setScalar(0.9 + (i % 2) * 0.35);
        g.add(pepino);
        this.pepinos.push({ objeto: pepino, altura: altura });
      });

      this.grupo = g;
      this.el.setObject3D('mesh', g);
    },
    tick: function (t, dt) {
      this.grupo.position.y = estado.alturaSuelo;
      this.grupo.visible = estado.alturaSuelo > -50;
      if (!this.grupo.visible) return;
      const avance = segundos(dt) * 0.004;
      this.pepinos.forEach((p) => {
        const o = p.objeto;
        o.position.x += Math.sin(o.rotation.y) * avance;
        o.position.z += Math.cos(o.rotation.y) * avance;
        o.position.y = p.altura(o.position.x, o.position.z);
      });
    },
  });

  /* ---------- Nube de sedimento ---------- */
  AFRAME.registerComponent('nube-sedimento', {
    schema: {
      fuente: { default: 'desdeFondo' },
      retraso: { default: 0 },
      origen: { type: 'vec3', default: { x: 0, y: ALTURA_FONDO, z: 0 } },
      radio: { default: 0.9 },
      alcance: { default: 2.4 },
      cantidad: { default: 140 },
      tamano: { default: 1 },
    },
    init: function () {
      const d = this.data;
      const n = d.cantidad;
      const direcciones = new Float32Array(n * 3);
      const datos = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        direcciones[i * 3] = Math.cos(a);
        direcciones[i * 3 + 1] = 0.15 + Math.random() * 0.85;
        direcciones[i * 3 + 2] = Math.sin(a);
        datos[i * 2] = (0.5 + Math.random() * 0.9) * d.tamano;
        datos[i * 2 + 1] = 0.3 + Math.random() * 0.7;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('aDir', new THREE.BufferAttribute(direcciones, 3));
      geo.setAttribute('aDatos', new THREE.BufferAttribute(datos, 2));
      this.uEdad = { value: 0 };
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uEdad: this.uEdad, uEscalaPuntos: U.uEscalaPuntos, uMapa: { value: texPunto() },
          uOrigen: { value: new V3(d.origen.x, d.origen.y, d.origen.z) }, uRadio: { value: d.radio }, uAlcance: { value: d.alcance },
          uColorAgua: U.uColorAgua, uDensidad: U.uDensidad,
          uFocos: U.uFocos, uFocoPos: U.uFocoPos, uFocoDir: U.uFocoDir,
          uLinterna: U.uLinterna, uLinternaPos: U.uLinternaPos, uLinternaDir: U.uLinternaDir,
        },
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: `
          attribute vec3 aDir;
          attribute vec2 aDatos;
          uniform float uEdad;
          uniform float uEscalaPuntos;
          uniform vec3 uOrigen;
          uniform float uRadio;
          uniform float uAlcance;
          varying float vAlfa;
          varying float vLuz;
          ${B.GLSL_HACES}
          ${B.GLSL_NIEBLA}
          void main(){
            float t = max(uEdad, 0.0);
            float k = 1.0 - exp(-t * 0.5);
            vec3 p = uOrigen + vec3(aDir.x, 0.0, aDir.z) * (uRadio + k * uAlcance * aDatos.y);
            p.y += aDir.y * k * 0.8 * aDatos.y + t * 0.012 + 0.05;
            vec4 mv = viewMatrix * vec4(p, 1.0);
            float d = -mv.z;
            gl_PointSize = clamp((0.25 + 0.75 * k) * aDatos.x * 0.9 * uEscalaPuntos / max(d, 0.3), 1.0, 220.0);
            vLuz = luzHaces(p) * 2.2 + 0.015;
            vAlfa = smoothstep(0.0, 0.5, t) * exp(-t * 0.075) * (1.0 - factorNiebla(d)) * smoothstep(0.2, 0.9, d);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uMapa;
          varying float vAlfa;
          varying float vLuz;
          void main(){
            float a = texture2D(uMapa, gl_PointCoord).a * vAlfa * 0.16 * clamp(vLuz * 3.0, 0.0, 1.0);
            if (a < 0.003) discard;
            gl_FragColor = vec4(vec3(0.72, 0.66, 0.54) * min(vLuz, 1.2), a);
            ${B.GLSL_SALIDA}
          }`,
      });
      this.puntos = new THREE.Points(geo, mat);
      this.puntos.frustumCulled = false;
      this.puntos.renderOrder = 7;
      this.el.setObject3D('mesh', this.puntos);
    },
    tick: function () {
      const base = estado[this.data.fuente];
      const edad = base > 0 ? base - this.data.retraso : 0;
      this.uEdad.value = edad;
      this.puntos.visible = edad > 0 && edad < 70;
    },
  });
})();
