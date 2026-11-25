/*
 * Componentes A-Frame de "Fosa de Atacama · 8.000 metros bajo el Pacífico".
 * Todos leen el estado compartido window.FOSA, que actualiza js/principal.js:
 *   profundidad   metros bajo la superficie
 *   velocidad     0..1  rapidez del descenso (mueve la nieve marina y las medusas)
 *   luzSol        0..1  luz que llega desde la superficie
 *   bio           0..1  cantidad de bioluminiscencia visible
 *   focos         0..1  focos del lander
 *   linterna      0..1  linterna de mano
 *   alturaSuelo   altura (m) del fondo marino respecto del lander
 *   caida         0..1  caída del lander al agua, en la superficie
 *   carnada       segundos desde que se soltó la carnada (0 = no se ha soltado)
 *   telon         0..1  fundido a negro en VR
 */
(function () {
  const THREE = AFRAME.THREE;

  window.FOSA = window.FOSA || {
    profundidad: 0,
    velocidad: 0,
    luzSol: 1,
    bio: 0,
    focos: 0,
    linterna: 0,
    alturaSuelo: -60,
    caida: 0,
    carnada: 0,
    telon: 0,
  };
  const estado = () => window.FOSA;
  const segundos = (dt) => Math.min(dt || 16, 50) / 1000;
  const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const POSICION_CARNADA = new THREE.Vector3(0, 0.08, -1.9);

  function materialMate(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.85, metalness: 0.05 }, extra || {}));
  }

  function rugosidad(geometria, cantidad) {
    const pos = geometria.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + (Math.random() - 0.5) * cantidad,
        pos.getY(i) + (Math.random() - 0.5) * cantidad,
        pos.getZ(i) + (Math.random() - 0.5) * cantidad
      );
    }
    geometria.computeVertexNormals();
    return geometria;
  }

  let texturaPunto = null;
  function puntoSuave() {
    if (texturaPunto) return texturaPunto;
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 64;
    const c = lienzo.getContext('2d');
    const degradado = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    degradado.addColorStop(0, 'rgba(255,255,255,1)');
    degradado.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    degradado.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = degradado;
    c.fillRect(0, 0, 64, 64);
    texturaPunto = new THREE.CanvasTexture(lienzo);
    return texturaPunto;
  }

  function lienzoTexto(ancho, alto) {
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const textura = new THREE.CanvasTexture(lienzo);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    return { lienzo, contexto: lienzo.getContext('2d'), textura };
  }

  function partirLineas(contexto, texto, anchoMaximo) {
    const palabras = texto.split(' ');
    const lineas = [];
    let linea = '';
    palabras.forEach((palabra) => {
      const prueba = linea ? linea + ' ' + palabra : palabra;
      if (contexto.measureText(prueba).width > anchoMaximo && linea) {
        lineas.push(linea);
        linea = palabra;
      } else {
        linea = prueba;
      }
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

  /* =====================================================================
   * SUPERFICIE
   * ===================================================================== */

  AFRAME.registerComponent('oceano', {
    schema: { tamano: { default: 320 }, segmentos: { default: 110 } },
    init: function () {
      const geo = new THREE.PlaneGeometry(this.data.tamano, this.data.tamano, this.data.segmentos, this.data.segmentos);
      geo.rotateX(-Math.PI / 2);
      this.posiciones = geo.attributes.position;
      this.base = Float32Array.from(this.posiciones.array);
      const mat = new THREE.MeshStandardMaterial({ color: '#0b2b44', roughness: 0.3, metalness: 0.25, flatShading: true });
      this.el.setObject3D('mesh', new THREE.Mesh(geo, mat));
    },
    tick: function (t) {
      const p = this.posiciones;
      for (let i = 0; i < p.count; i++) {
        const x = this.base[i * 3];
        const z = this.base[i * 3 + 2];
        p.array[i * 3 + 1] =
          Math.sin(x * 0.12 + t * 0.0008) * 0.28 +
          Math.sin(z * 0.19 + t * 0.0011) * 0.2 +
          Math.sin((x + z) * 0.45 + t * 0.0021) * 0.05;
      }
      p.needsUpdate = true;
    },
  });

  AFRAME.registerComponent('barco', {
    init: function () {
      const g = new THREE.Group();
      const cubierta = materialMate('#6b6f72');
      const casco = materialMate('#8c2f2a');
      const blanco = materialMate('#d8d6cf');
      const amarillo = materialMate('#f2b705', { roughness: 0.6 });

      const piso = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 16), cubierta);
      piso.position.set(0, -0.15, 5);
      g.add(piso);
      const costado = new THREE.Mesh(new THREE.BoxGeometry(9.4, 3, 16.4), casco);
      costado.position.set(0, -1.75, 5);
      g.add(costado);

      // Baranda en la popa, hacia el mar.
      for (let x = -4.4; x <= 4.41; x += 0.8) {
        const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), blanco);
        poste.position.set(x, 0.5, -2.9);
        g.add(poste);
      }
      const pasamanos = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8.8, 6), blanco);
      pasamanos.rotation.z = Math.PI / 2;
      pasamanos.position.set(0, 1, -2.9);
      g.add(pasamanos);

      // Pórtico en A del que cuelga el lander.
      [-1.9, 1.9].forEach((x) => {
        const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6.4, 8), amarillo);
        pata.position.set(x * 0.75, 2.9, -3.7);
        pata.rotation.x = 0.42;
        pata.rotation.z = x > 0 ? 0.12 : -0.12;
        g.add(pata);
      });
      const travesano = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8), amarillo);
      travesano.rotation.z = Math.PI / 2;
      travesano.position.set(0, 5.85, -5);
      g.add(travesano);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.3, 4), materialMate('#222'));
      cable.position.set(0, 4.7, -5.2);
      this.cable = cable;
      g.add(cable);

      // Puente de mando detrás de la persona, con ventanas encendidas.
      const puente = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 4), blanco);
      puente.position.set(0, 1.5, 9);
      g.add(puente);
      const ventanas = new THREE.MeshStandardMaterial({ color: '#1a1408', emissive: new THREE.Color('#ffcf80'), emissiveIntensity: 1.4 });
      for (let i = -2; i <= 2; i++) {
        const v = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), ventanas);
        v.position.set(i * 1.1, 2.2, 6.99);
        v.rotation.y = Math.PI;
        g.add(v);
      }
      this.el.setObject3D('mesh', g);
    },
    tick: function () {
      this.cable.visible = estado().caida === 0;
    },
  });

  AFRAME.registerComponent('costa', {
    init: function () {
      const g = new THREE.Group();
      const cantidad = 260;
      const pos = new Float32Array(cantidad * 3);
      for (let i = 0; i < cantidad; i++) {
        pos[i * 3] = 150 + Math.random() * 12;
        pos[i * 3 + 1] = 0.5 + Math.random() * Math.random() * 10;
        pos[i * 3 + 2] = -120 + Math.random() * 200;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffc46b', size: 0.9, fog: false })));
      const cerro = materialMate('#0d1420', { fog: false });
      for (let i = 0; i < 9; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(30 + Math.random() * 25, 30 + Math.random() * 30, 5), cerro);
        c.position.set(185 + Math.random() * 30, 10, -140 + i * 30);
        g.add(c);
      }
      this.el.setObject3D('mesh', g);
    },
  });

  AFRAME.registerComponent('cielo-estrellas', {
    schema: { cantidad: { default: 700 }, radio: { default: 260 } },
    init: function () {
      const pos = new Float32Array(this.data.cantidad * 3);
      for (let i = 0; i < this.data.cantidad; i++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * 0.45 * Math.PI + 0.06;
        pos[i * 3] = Math.cos(u) * Math.cos(v) * this.data.radio;
        pos[i * 3 + 1] = Math.sin(v) * this.data.radio;
        pos[i * 3 + 2] = Math.sin(u) * Math.cos(v) * this.data.radio;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.el.setObject3D('mesh', new THREE.Points(geo, new THREE.PointsMaterial({ color: '#dfe8ff', size: 1.1, fog: false, transparent: true, opacity: 0.85 })));
    },
  });

  /* =====================================================================
   * LANDER
   * ===================================================================== */

  AFRAME.registerComponent('lander', {
    schema: { modo: { default: 'interior' } },
    init: function () {
      const g = new THREE.Group();
      const amarillo = materialMate('#f2b705', { roughness: 0.55, metalness: 0.2 });
      const naranjo = materialMate('#ff6a1a', { roughness: 0.45 });
      const metal = materialMate('#9aa0a6', { metalness: 0.8, roughness: 0.35 });
      const radio = 0.95;

      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.35, 8), amarillo);
        poste.position.set(Math.cos(a) * radio, 1.17, Math.sin(a) * radio);
        g.add(poste);
        const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 6), metal);
        pata.position.set(Math.cos(a) * radio, -0.15, Math.sin(a) * radio);
        g.add(pata);
      }
      [0.05, 2.33].forEach((y) => {
        const anillo = new THREE.Mesh(new THREE.TorusGeometry(radio, 0.03, 8, 48), amarillo);
        anillo.rotation.x = Math.PI / 2;
        anillo.position.y = y;
        g.add(anillo);
      });
      const rejilla = new THREE.Mesh(new THREE.CircleGeometry(radio, 32), materialMate('#2b2e31', { metalness: 0.6, roughness: 0.5 }));
      rejilla.rotation.x = -Math.PI / 2;
      rejilla.position.y = 0.01;
      g.add(rejilla);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.3;
        const flotador = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), naranjo);
        flotador.position.set(Math.cos(a) * 0.5, 2.68, Math.sin(a) * 0.5);
        g.add(flotador);
      }

      // Focos y cámara al frente.
      this.focos = [];
      this.lentes = [];
      [-0.45, 0.45].forEach((x) => {
        const carcasa = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.16, 14), metal);
        carcasa.rotation.x = Math.PI / 2 - 0.5;
        carcasa.position.set(x * 1.35, 2.38, -0.9);
        g.add(carcasa);
        const lente = new THREE.MeshBasicMaterial({ color: '#2a2a22' });
        const disco = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), lente);
        disco.position.set(x * 1.35, 2.34, -0.99);
        disco.rotation.x = -0.5;
        g.add(disco);
        this.lentes.push(lente);
        if (this.data.modo === 'interior') {
          const foco = new THREE.SpotLight('#e9f4ff', 0, 22, 0.62, 0.55, 1.2);
          foco.position.set(x * 1.35, 2.33, -1);
          foco.target.position.set(x * 1.2, 0, -3.6);
          g.add(foco);
          g.add(foco.target);
          this.focos.push(foco);
        }
      });
      const camara = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12), metal);
      camara.rotation.x = Math.PI / 2;
      camara.position.set(0.82, 1.55, -0.55);
      g.add(camara);

      // Jaula de carnada.
      this.jaula = new THREE.Group();
      const malla = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: '#c9ced2', wireframe: true }));
      this.jaula.add(malla);
      const cebo = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), materialMate('#a3584a'));
      this.jaula.add(cebo);
      this.jaula.position.set(0.3, 1.0, -1.05);
      g.add(this.jaula);

      this.grupo = g;
      this.alturaBase = null;
      this.el.setObject3D('mesh', g);
    },
    tick: function (t, dt) {
      const e = estado();
      this.focos.forEach((foco) => (foco.intensity = e.focos * 7));
      this.lentes.forEach((lente) => lente.color.setRGB(0.16 + e.focos * 0.84, 0.16 + e.focos * 0.84, 0.14 + e.focos * 0.86));

      if (this.data.modo === 'colgando') {
        // Balanceo suave y caída al soltarlo.
        if (this.alturaBase === null) this.alturaBase = this.el.object3D.position.y;
        this.grupo.rotation.z = Math.sin(t * 0.0011) * 0.04;
        this.grupo.position.y = -e.caida * e.caida * 6;
        this.grupo.visible = e.caida < 0.98;
      }

      // La carnada cae desde el lander hasta el fondo.
      if (this.data.modo === 'interior') {
        if (e.carnada > 0) {
          const k = limitar(e.carnada / 2.2);
          const suave = k * k * (3 - 2 * k);
          this.jaula.position.set(0.3 + (POSICION_CARNADA.x - 0.3) * suave, 1.0 + (POSICION_CARNADA.y + 0.09 - 1.0) * suave, -1.05 + (POSICION_CARNADA.z + 1.05) * suave);
        } else {
          this.jaula.position.set(0.3, 1.0, -1.05);
        }
      }
    },
  });

  /* =====================================================================
   * PROFUNDIDAD
   * ===================================================================== */

  AFRAME.registerComponent('nieve-marina', {
    schema: { cantidad: { default: 1600 }, radio: { default: 9 } },
    init: function () {
      const r = this.data.radio;
      this.posiciones = new Float32Array(this.data.cantidad * 3);
      for (let i = 0; i < this.data.cantidad; i++) {
        this.posiciones[i * 3] = (Math.random() - 0.5) * 2 * r;
        this.posiciones[i * 3 + 1] = Math.random() * 14 - 4;
        this.posiciones[i * 3 + 2] = (Math.random() - 0.5) * 2 * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.posiciones, 3));
      this.geo = geo;
      this.material = new THREE.PointsMaterial({ color: '#dce8ef', size: 0.05, map: puntoSuave(), transparent: true, opacity: 0.75, depthWrite: false });
      this.el.setObject3D('mesh', new THREE.Points(geo, this.material));
    },
    tick: function (t, dt) {
      const e = estado();
      const s = segundos(dt);
      // Durante el descenso la nieve "sube" (el lander cae); en el fondo cae lentamente.
      const subida = e.velocidad * 7 - 0.06;
      const p = this.posiciones;
      for (let i = 0; i < p.length; i += 3) {
        p[i + 1] += subida * s;
        p[i] += Math.sin(t * 0.0004 + i) * 0.002;
        if (p[i + 1] > 10) p[i + 1] -= 14;
        if (p[i + 1] < -4) p[i + 1] += 14;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.material.opacity = 0.35 + Math.max(e.focos, e.linterna * 0.6, e.luzSol * 0.8) * 0.45;
    },
  });

  AFRAME.registerComponent('bioluminiscencia', {
    schema: { cantidad: { default: 260 } },
    init: function () {
      const n = this.data.cantidad;
      this.posiciones = new Float32Array(n * 3);
      this.colores = new Float32Array(n * 3);
      this.fases = new Float32Array(n);
      for (let i = 0; i < n; i++) this.ubicar(i, true);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(this.posiciones, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(this.colores, 3));
      this.geo = geo;
      const mat = new THREE.PointsMaterial({ size: 0.22, map: puntoSuave(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      this.el.setObject3D('mesh', new THREE.Points(geo, mat));
    },
    ubicar: function (i, alAzar) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 12;
      this.posiciones[i * 3] = Math.cos(a) * r;
      this.posiciones[i * 3 + 1] = alAzar ? Math.random() * 16 - 6 : -6;
      this.posiciones[i * 3 + 2] = Math.sin(a) * r;
      this.fases[i] = Math.random() * 100;
    },
    tick: function (t, dt) {
      const e = estado();
      const s = segundos(dt);
      const subida = e.velocidad * 7;
      for (let i = 0; i < this.fases.length; i++) {
        this.posiciones[i * 3 + 1] += subida * s;
        if (this.posiciones[i * 3 + 1] > 10) this.ubicar(i, false);
        const destello = Math.max(0, Math.sin(t * 0.0025 + this.fases[i] * 7)) ** 6;
        const v = destello * e.bio;
        this.colores[i * 3] = 0.15 * v;
        this.colores[i * 3 + 1] = 0.85 * v;
        this.colores[i * 3 + 2] = 1.0 * v;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    },
  });

  AFRAME.registerComponent('medusa', {
    schema: { color: { type: 'color', default: '#5fe0ff' } },
    init: function () {
      const g = new THREE.Group();
      this.material = new THREE.MeshBasicMaterial({ color: this.data.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const campana = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.material);
      g.add(campana);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const tentaculo = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.9, 3), this.material);
        tentaculo.position.set(Math.cos(a) * 0.16, -0.45, Math.sin(a) * 0.16);
        g.add(tentaculo);
      }
      this.cuerpo = g;
      this.semilla = Math.random() * 100;
      this.reubicar(true);
      this.el.setObject3D('mesh', g);
    },
    reubicar: function (alAzar) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 5;
      this.el.object3D.position.set(Math.cos(a) * r, alAzar ? Math.random() * 10 - 3 : -8, Math.sin(a) * r);
    },
    tick: function (t, dt) {
      const e = estado();
      const s = segundos(dt);
      const p = this.el.object3D.position;
      p.y += (e.velocidad * 7 + 0.05) * s;
      if (p.y > 9) this.reubicar(false);
      const latido = 1 + Math.sin(t * 0.004 + this.semilla) * 0.12;
      this.cuerpo.scale.set(latido, 2 - latido, latido);
      this.material.opacity = e.bio * 0.55;
      this.cuerpo.visible = e.bio > 0.01;
    },
  });

  AFRAME.registerComponent('rayos-sol', {
    init: function () {
      const g = new THREE.Group();
      this.material = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      for (let i = 0; i < 7; i++) {
        const rayo = new THREE.Mesh(new THREE.ConeGeometry(1.2 + Math.random(), 26, 12, 1, true), this.material);
        rayo.position.set((Math.random() - 0.5) * 16, 10, (Math.random() - 0.5) * 16);
        rayo.rotation.z = (Math.random() - 0.5) * 0.3;
        g.add(rayo);
      }
      this.el.setObject3D('mesh', g);
    },
    tick: function () {
      this.material.opacity = estado().luzSol * 0.07;
    },
  });

  AFRAME.registerComponent('fondo-marino', {
    init: function () {
      const g = new THREE.Group();
      const sedimento = materialMate('#36332b', { flatShading: true, roughness: 1 });
      const geo = new THREE.PlaneGeometry(70, 70, 90, 90);
      geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const lejos = Math.hypot(x, z);
        const ondulacion = Math.sin(x * 0.35) * 0.08 + Math.cos(z * 0.27) * 0.1 + (Math.random() - 0.5) * 0.05;
        const ladera = lejos > 10 ? (lejos - 10) * 0.22 : 0; // las paredes de la fosa se levantan a lo lejos
        pos.setY(i, ondulacion + ladera * ladera * 0.08);
      }
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, sedimento));

      const roca = materialMate('#36342e', { flatShading: true });
      for (let i = 0; i < 26; i++) {
        const piedra = new THREE.Mesh(rugosidad(new THREE.IcosahedronGeometry(0.12 + Math.random() * 0.4, 1), 0.08), roca);
        const a = Math.random() * Math.PI * 2;
        const r = 2.2 + Math.random() * 12;
        piedra.position.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
        piedra.scale.y = 0.5;
        g.add(piedra);
      }
      this.grupo = g;
      this.el.setObject3D('mesh', g);
    },
    tick: function () {
      const e = estado();
      this.grupo.position.y = e.alturaSuelo;
      this.grupo.visible = e.alturaSuelo > -50;
    },
  });

  AFRAME.registerComponent('anfipodos', {
    schema: { cantidad: { default: 70 } },
    init: function () {
      const geo = new THREE.SphereGeometry(1, 8, 6);
      const mat = new THREE.MeshStandardMaterial({ color: '#e9b596', emissive: new THREE.Color('#4a2c1c'), roughness: 0.45 });
      this.malla = new THREE.InstancedMesh(geo, mat, this.data.cantidad);
      this.malla.frustumCulled = false;
      this.individuos = [];
      for (let i = 0; i < this.data.cantidad; i++) {
        const a = Math.random() * Math.PI - Math.PI; // llegan desde adelante y los costados
        const r = 1.5 + Math.random() * 3;
        this.individuos.push({
          pos: new THREE.Vector3(Math.cos(a) * r, 0.05 + Math.random() * 0.5, Math.sin(a) * r + POSICION_CARNADA.z),
          desfase: Math.random() * 100,
          rapidez: 0.45 + Math.random() * 0.5,
          destino: new THREE.Vector3(),
          tamano: 0.022 + Math.random() * 0.018,
        });
      }
      this.aux = new THREE.Object3D();
      this.mira = new THREE.Vector3();
      this.el.setObject3D('mesh', this.malla);
    },
    tick: function (t, dt) {
      const e = estado();
      const s = segundos(dt);
      const activos = e.carnada > 2.5;
      this.individuos.forEach((a, i) => {
        const despierto = activos && e.carnada > 2.5 + i * 0.12;
        if (despierto) {
          a.destino.set(
            POSICION_CARNADA.x + Math.sin(t * 0.0013 * a.rapidez + a.desfase) * 0.28,
            POSICION_CARNADA.y + 0.05 + Math.abs(Math.sin(t * 0.0021 + a.desfase)) * 0.25,
            POSICION_CARNADA.z + Math.cos(t * 0.0011 * a.rapidez + a.desfase) * 0.28
          );
          this.mira.copy(a.destino).sub(a.pos);
          const distancia = this.mira.length();
          if (distancia > 0.001) a.pos.addScaledVector(this.mira.normalize(), Math.min(distancia, a.rapidez * s));
        }
        this.aux.position.copy(a.pos);
        this.aux.lookAt(a.destino.lengthSq() ? a.destino : POSICION_CARNADA);
        const visible = despierto ? 1 : 0;
        this.aux.scale.set(a.tamano * 0.45 * visible, a.tamano * 0.55 * visible, a.tamano * 1.6 * visible);
        this.aux.updateMatrix();
        this.malla.setMatrixAt(i, this.aux.matrix);
      });
      this.malla.instanceMatrix.needsUpdate = true;
    },
  });

  AFRAME.registerComponent('pez-caracol', {
    init: function () {
      const pez = new THREE.Group();
      const piel = new THREE.MeshStandardMaterial({ color: '#7f9fd6', emissive: new THREE.Color('#22345c'), transparent: true, opacity: 0.85, roughness: 0.35 });
      const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 14), piel);
      cabeza.scale.set(1, 0.85, 1.15);
      pez.add(cabeza);
      const ojo = new THREE.MeshBasicMaterial({ color: '#0a0a12' });
      [-0.035, 0.035].forEach((x) => {
        const o = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), ojo);
        o.position.set(x, 0.02, 0.055);
        pez.add(o);
        const aleta = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), piel);
        aleta.scale.set(0.15, 0.7, 1);
        aleta.position.set(x * 1.9, -0.015, -0.01);
        aleta.rotation.y = x > 0 ? 0.5 : -0.5;
        pez.add(aleta);
      });
      this.segmentos = [];
      let padre = pez;
      const radios = [0.055, 0.045, 0.034, 0.024, 0.015, 0.008];
      radios.forEach((r, i) => {
        const articulacion = new THREE.Group();
        articulacion.position.z = i === 0 ? -0.05 : -0.045;
        const trozo = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), piel);
        trozo.scale.set(0.85, 1.1, 1.3);
        trozo.position.z = -0.02;
        articulacion.add(trozo);
        padre.add(articulacion);
        padre = articulacion;
        this.segmentos.push(articulacion);
      });
      this.pez = pez;
      this.tiempo = 0;
      this.ruta = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.6, 1.0, -5.5),
        new THREE.Vector3(-2.2, 0.7, -4.2),
        new THREE.Vector3(-1.2, 0.45, -3.0),
        new THREE.Vector3(POSICION_CARNADA.x - 0.75, 0.35, POSICION_CARNADA.z),
      ]);
      this.mira = new THREE.Vector3();
      pez.visible = false;
      this.el.setObject3D('mesh', pez);
    },
    tick: function (t, dt) {
      const e = estado();
      const s = segundos(dt);
      const activo = e.carnada > 6;
      this.pez.visible = activo;
      if (!activo) {
        this.tiempo = 0;
        return;
      }
      this.tiempo += s;
      const llegada = 7;
      if (this.tiempo < llegada) {
        const k = this.tiempo / llegada;
        const suave = k * k * (3 - 2 * k);
        this.ruta.getPointAt(suave, this.pez.position);
        this.ruta.getPointAt(Math.min(1, suave + 0.02), this.mira);
      } else {
        const a = (this.tiempo - llegada) * 0.22 + Math.PI;
        this.pez.position.set(POSICION_CARNADA.x + Math.cos(a) * 0.75, 0.35 + Math.sin(this.tiempo * 0.7) * 0.05, POSICION_CARNADA.z + Math.sin(a) * 0.75);
        this.mira.set(POSICION_CARNADA.x + Math.cos(a + 0.1) * 0.75, this.pez.position.y, POSICION_CARNADA.z + Math.sin(a + 0.1) * 0.75);
      }
      this.pez.lookAt(this.mira);
      this.segmentos.forEach((seg, i) => {
        seg.rotation.y = Math.sin(this.tiempo * 3.2 - i * 0.7) * 0.12 * (i + 1) * 0.6;
      });
    },
  });

  /* =====================================================================
   * LUZ DE MANO Y FUNDIDOS
   * ===================================================================== */

  AFRAME.registerComponent('linterna', {
    schema: { intensidad: { default: 6 }, alcance: { default: 12 } },
    init: function () {
      const g = new THREE.Group();
      this.luz = new THREE.SpotLight('#fff3d6', 0, this.data.alcance, 0.38, 0.6, 1.1);
      this.luz.target.position.set(0, 0, -1);
      g.add(this.luz);
      g.add(this.luz.target);
      this.el.setObject3D('luz', g);
    },
    tick: function () {
      this.luz.intensity = estado().linterna * this.data.intensidad;
    },
  });

  AFRAME.registerComponent('telon-vr', {
    init: function () {
      this.material = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false });
      const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), this.material);
      esfera.renderOrder = 9999;
      this.esfera = esfera;
      this.el.setObject3D('telon', esfera);
    },
    tick: function () {
      this.material.opacity = estado().telon;
      this.esfera.visible = estado().telon > 0.001;
    },
  });

  /* =====================================================================
   * INTERFAZ EN VR
   * ===================================================================== */

  AFRAME.registerComponent('panel-relato', {
    schema: { ancho: { default: 1.05 }, alto: { default: 0.6 } },
    init: function () {
      const { lienzo, contexto, textura } = lienzoTexto(1024, 586);
      this.lienzo = lienzo;
      this.contexto = contexto;
      this.textura = textura;
      const mat = new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false, fog: false });
      this.malla = new THREE.Mesh(new THREE.PlaneGeometry(this.data.ancho, this.data.alto), mat);
      this.malla.renderOrder = 10;
      this.datos = { lugar: '', texto: '', indicacion: '', medidor: '' };
      this.el.setObject3D('mesh', this.malla);
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
      const { width: W, height: H } = this.lienzo;
      c.clearRect(0, 0, W, H);
      const { lugar, texto, indicacion, medidor } = this.datos;
      if (!lugar && !texto && !indicacion && !medidor) {
        this.textura.needsUpdate = true;
        return;
      }
      c.fillStyle = 'rgba(3, 8, 16, 0.82)';
      rectanguloRedondeado(c, 0, 0, W, H, 28);
      c.fill();
      c.fillStyle = '#f2b705';
      c.fillRect(0, 40, 8, H - 80);

      let y = 70;
      c.textBaseline = 'alphabetic';
      if (lugar) {
        c.font = '600 28px "IBM Plex Sans", system-ui, sans-serif';
        c.fillStyle = '#5fd4e6';
        c.fillText(lugar.toUpperCase().split('').join(' '), 48, y);
        y += 26;
      }
      if (texto) {
        c.font = '600 40px "Fraunces", Georgia, serif';
        c.fillStyle = '#eef4f8';
        partirLineas(c, texto, W - 96).forEach((linea) => {
          y += 52;
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
      this.textura.needsUpdate = true;
    },
  });

  AFRAME.registerComponent('palanca', {
    schema: { etiqueta: { default: '' } },
    init: function () {
      const g = new THREE.Group();
      const loza = materialMate('#e4e1d8', { roughness: 0.4 });
      const cobre = materialMate('#c27a3a', { metalness: 0.7, roughness: 0.35 });
      const negro = materialMate('#151515', { roughness: 0.5 });

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.22), loza);
      g.add(base);
      [-0.045, 0.045].forEach((x) => {
        const soporte = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.03), cobre);
        soporte.position.set(x, 0.035, 0);
        g.add(soporte);
      });
      this.brazo = new THREE.Group();
      this.brazo.position.y = 0.05;
      const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.012), cobre);
      hoja.position.y = 0.085;
      this.brazo.add(hoja);
      const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 12), negro);
      mango.rotation.z = Math.PI / 2;
      mango.position.y = 0.18;
      this.brazo.add(mango);
      this.punta = new THREE.Object3D();
      this.punta.position.y = 0.18;
      this.brazo.add(this.punta);
      g.add(this.brazo);

      // Etiqueta sobre la base.
      const { lienzo, contexto, textura } = lienzoTexto(512, 96);
      this.lienzoEtiqueta = lienzo;
      this.contextoEtiqueta = contexto;
      this.texturaEtiqueta = textura;
      const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.056), new THREE.MeshBasicMaterial({ map: textura, transparent: true }));
      placa.position.set(0, 0.016, 0.135);
      placa.rotation.x = -Math.PI / 2 + 0.35;
      g.add(placa);

      this.angulo = -0.9;
      this.activada = false;
      this.animando = false;
      this.local = new THREE.Vector3();
      this.mundo = new THREE.Vector3();
      this.el.setObject3D('mesh', g);
      this.dibujarEtiqueta();
    },
    update: function () {
      this.dibujarEtiqueta();
    },
    dibujarEtiqueta: function () {
      if (!this.contextoEtiqueta) return;
      const c = this.contextoEtiqueta;
      c.clearRect(0, 0, 512, 96);
      c.fillStyle = '#1b2430';
      rectanguloRedondeado(c, 4, 4, 504, 88, 14);
      c.fill();
      c.font = '700 40px "IBM Plex Sans", system-ui, sans-serif';
      c.fillStyle = '#f2b705';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(this.data.etiqueta, 256, 50);
      this.texturaEtiqueta.needsUpdate = true;
    },
    distancia: function (posicionMundo) {
      this.punta.getWorldPosition(this.mundo);
      return this.mundo.distanceTo(posicionMundo);
    },
    agarrar: function () {},
    mover: function (posicionMundo) {
      if (this.activada) return 0;
      this.local.copy(posicionMundo);
      this.el.object3D.worldToLocal(this.local);
      const nuevo = limitar(Math.atan2(this.local.z, this.local.y - 0.05), -0.9, 0.95);
      const cambio = Math.abs(nuevo - this.angulo);
      this.angulo = nuevo;
      if (this.angulo > 0.75) this.activar();
      return cambio;
    },
    soltar: function () {},
    activar: function () {
      if (this.activada) return;
      this.activada = true;
      this.animando = true;
      this.el.sceneEl.emit('palanca-activada');
    },
    reiniciar: function () {
      this.activada = false;
      this.animando = false;
      this.angulo = -0.9;
    },
    tick: function (t, dt) {
      if (this.animando) {
        this.angulo = Math.min(0.95, this.angulo + segundos(dt) * 4);
        if (this.angulo >= 0.95) this.animando = false;
      }
      this.brazo.rotation.x = this.angulo;
    },
  });

  // Agarra la palanca con el gatillo o el botón lateral de los controles del Quest.
  // Si se aprieta el gatillo lejos de la palanca, emite "continuar".
  AFRAME.registerComponent('operador-vr', {
    init: function () {
      this.agarres = new Map();
      this.posicion = new THREE.Vector3();
      this.ultimaVibracion = 0;
      this.manos = Array.from(this.el.querySelectorAll('[hand-controls]'));
      this.manos.forEach((mano) => {
        ['triggerdown', 'gripdown'].forEach((evento) => mano.addEventListener(evento, () => this.presionar(mano, evento)));
        ['triggerup', 'gripup'].forEach((evento) => mano.addEventListener(evento, () => this.soltar(mano)));
      });
    },
    visibleEnMundo: function (objeto) {
      for (let o = objeto; o; o = o.parent) if (!o.visible) return false;
      return true;
    },
    presionar: function (mano, evento) {
      if (this.agarres.has(mano)) return;
      mano.object3D.getWorldPosition(this.posicion);
      let elegido = null;
      let menor = 0.2;
      this.el.querySelectorAll('[palanca]').forEach((el) => {
        if (!this.visibleEnMundo(el.object3D)) return;
        const componente = el.components.palanca;
        const d = componente.distancia(this.posicion);
        if (d < menor) {
          menor = d;
          elegido = componente;
        }
      });
      if (elegido) {
        elegido.agarrar(this.posicion);
        this.agarres.set(mano, elegido);
        this.vibrar(mano, 0.5, 40);
      } else if (evento === 'triggerdown') {
        this.el.emit('continuar');
      }
    },
    soltar: function (mano) {
      const componente = this.agarres.get(mano);
      if (componente) componente.soltar();
      this.agarres.delete(mano);
    },
    vibrar: function (mano, fuerza, ms) {
      try {
        const controles = mano.components['tracked-controls'];
        const gamepad = controles && controles.controller && controles.controller.gamepad;
        const actuador = gamepad && gamepad.hapticActuators && gamepad.hapticActuators[0];
        if (actuador) actuador.pulse(fuerza, ms);
      } catch (error) {
        /* algunos controles no vibran */
      }
    },
    vibrarTodas: function (fuerza, ms) {
      this.manos.forEach((mano) => this.vibrar(mano, fuerza, ms));
    },
    tick: function (t) {
      this.agarres.forEach((componente, mano) => {
        mano.object3D.getWorldPosition(this.posicion);
        const cambio = componente.mover(this.posicion);
        if (cambio > 0.01 && t - this.ultimaVibracion > 50) {
          this.ultimaVibracion = t;
          this.vibrar(mano, Math.min(1, 0.2 + cambio * 6), 20);
        }
        if (componente.activada) {
          this.vibrar(mano, 1, 120);
          this.agarres.delete(mano);
        }
      });
    },
  });
})();
