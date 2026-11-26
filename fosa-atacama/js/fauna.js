/*
 * Fauna del fondo de la fosa: anfípodos (crustáceos carroñeros que llegan en enjambre a la carnada)
 * y peces caracol, de cuerpo gelatinoso y translúcido. Son representaciones a partir de las
 * descripciones e imágenes publicadas, no modelos anatómicos exactos.
 */
(function () {
  const B = window.FOSA_BASE;
  const { THREE, V3, U, estado, Lote, segundos, limitar, POSICION_CARNADA, ALTURA_FONDO } = B;

  /* ---------- Anfípodos ---------- */
  function geometriaAnfipodo() {
    const lote = new Lote();
    const m = new THREE.MeshStandardMaterial();
    const esfera = new THREE.SphereGeometry(1, 10, 7);
    // Cuerpo curvado en forma de C, hecho de segmentos; mide 1 de largo.
    const segmentos = 9;
    const radioArco = 0.42;
    for (let i = 0; i < segmentos; i++) {
      const t = i / (segmentos - 1);
      const a = -1.15 + t * 2.3;
      const grosor = 0.085 + Math.sin(t * Math.PI) * 0.075;
      lote.agregar(esfera, m, [0, Math.cos(a) * radioArco - radioArco, Math.sin(a) * radioArco], [-a, 0, 0], [grosor * 0.62, grosor, 0.12]);
    }
    const zCabeza = Math.sin(1.15) * radioArco;
    const yCabeza = Math.cos(1.15) * radioArco - radioArco;
    // Antenas.
    [-1, 1].forEach((lado) => {
      lote.agregar(new THREE.ConeGeometry(0.012, 0.42, 4), m, [lado * 0.035, yCabeza - 0.06, zCabeza + 0.2], [1.9, 0, lado * 0.25]);
      lote.agregar(new THREE.ConeGeometry(0.01, 0.26, 4), m, [lado * 0.03, yCabeza - 0.13, zCabeza + 0.1], [2.3, 0, lado * 0.2]);
    });
    // Patas.
    for (let i = 1; i < 8; i++) {
      const t = i / (segmentos - 1);
      const a = -1.15 + t * 2.3;
      const largo = 0.2 + Math.sin(t * Math.PI) * 0.12;
      [-1, 1].forEach((lado) => {
        lote.agregar(new THREE.ConeGeometry(0.014, largo, 4), m, [lado * 0.05, Math.cos(a) * radioArco - radioArco - 0.13, Math.sin(a) * radioArco], [Math.PI + a * 0.4, 0, lado * 0.35]);
      });
    }
    // Urópodos de la cola.
    [-1, 1].forEach((lado) => lote.agregar(new THREE.ConeGeometry(0.014, 0.18, 4), m, [lado * 0.03, Math.cos(-1.15) * radioArco - radioArco - 0.04, Math.sin(-1.15) * radioArco - 0.1], [-1.8, 0, 0]));
    return lote.construir().children[0].geometry;
  }

  AFRAME.registerComponent('anfipodos', {
    schema: { cantidad: { default: 110 }, cazadores: { default: 4 } },
    init: function () {
      const total = this.data.cantidad + this.data.cazadores;
      const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.0 });
      this.malla = new THREE.InstancedMesh(geometriaAnfipodo(), mat, total);
      this.malla.frustumCulled = false;
      this.individuos = [];
      const color = new THREE.Color();
      const suelo = ALTURA_FONDO;
      for (let i = 0; i < total; i++) {
        const cazador = i >= this.data.cantidad;
        // Llegan desde la oscuridad, por delante y por los costados.
        const a = -Math.PI * (0.08 + Math.random() * 0.84);
        const r = 3.5 + Math.random() * 3;
        this.individuos.push({
          cazador: cazador,
          pos: new V3(Math.cos(a) * r, suelo + 0.1 + Math.random() * 1.1, Math.sin(a) * r + POSICION_CARNADA.z),
          vel: new V3(),
          destino: new V3(),
          fase: Math.random() * 100,
          rapidez: cazador ? 1.1 + Math.random() * 0.4 : 0.55 + Math.random() * 0.6,
          tamano: cazador ? 0.045 : 0.035 + Math.pow(Math.random(), 2) * 0.045,
          llegada: 2.6 + (cazador ? 8 + Math.random() * 5 : Math.pow(Math.random(), 1.6) * 10),
          orbita: cazador ? 0.4 + Math.random() * 0.4 : 0.06 + Math.pow(Math.random(), 1.5) * 0.38,
          giro: Math.random() * 6.28,
        });
        // Anaranjados pálidos los carroñeros; casi blancos los cazadores.
        if (cazador) color.setRGB(0.95, 0.93, 0.9);
        else color.setHSL(0.045 + Math.random() * 0.03, 0.55 + Math.random() * 0.25, 0.62 + Math.random() * 0.14);
        this.malla.setColorAt(i, color);
      }
      this.malla.instanceColor.needsUpdate = true;
      this.aux = new THREE.Object3D();
      this.dir = new V3();
      this.el.setObject3D('mesh', this.malla);
    },
    tick: function (t, dt) {
      const s = segundos(dt);
      const activos = estado.carnada > 2.4;
      this.malla.visible = activos;
      if (!activos) return;
      const ahora = U.uTiempo.value;
      const carnada = POSICION_CARNADA;
      this.individuos.forEach((a, i) => {
        const presente = estado.carnada > a.llegada;
        if (presente) {
          // Cada uno ronda la carnada con su propia órbita irregular.
          const w = ahora * (a.cazador ? 0.9 : 1.6) * a.rapidez + a.fase;
          a.destino.set(
            carnada.x + Math.sin(w) * a.orbita + Math.sin(w * 2.3 + a.fase) * 0.03,
            carnada.y + 0.02 + Math.abs(Math.sin(w * 0.7 + a.fase)) * a.orbita * 0.7,
            carnada.z + 0.18 + Math.cos(w * 1.1) * a.orbita * 1.4
          );
          this.dir.copy(a.destino).sub(a.pos);
          const distancia = this.dir.length();
          if (distancia > 0.0001) {
            // Nadan a tirones: aceleran y se dejan llevar.
            const tiron = 0.55 + 0.45 * Math.max(0, Math.sin(ahora * 7 + a.fase * 9));
            const paso = Math.min(distancia, a.rapidez * tiron * (distancia > 1 ? 1 : 0.5) * s);
            a.vel.copy(this.dir).multiplyScalar(1 / distancia);
            a.pos.addScaledVector(a.vel, paso);
          }
          if (a.pos.y < ALTURA_FONDO + 0.02) a.pos.y = ALTURA_FONDO + 0.02;
        }
        this.aux.position.copy(a.pos);
        this.dir.copy(a.pos).add(a.vel);
        this.aux.lookAt(this.dir);
        this.aux.rotateZ(a.giro + Math.sin(ahora * 5 + a.fase) * 0.5);
        const e = presente ? a.tamano : 0;
        this.aux.scale.set(e, e, e);
        this.aux.updateMatrix();
        this.malla.setMatrixAt(i, this.aux.matrix);
      });
      this.malla.instanceMatrix.needsUpdate = true;
    },
  });

  /* ---------- Pez caracol ---------- */
  const anchoPez = (t) => (t < 0.18 ? 0.048 * Math.sqrt(Math.sin((t / 0.18) * Math.PI * 0.5)) : 0.048 * Math.pow(Math.max(0, 1 - (t - 0.18) / 0.82), 1.25) + 0.0012);
  const altoPez = (t) => (t < 0.2 ? 0.043 * Math.sqrt(Math.sin((t / 0.2) * Math.PI * 0.5)) : 0.043 * Math.pow(Math.max(0, 1 - (t - 0.2) / 0.8), 0.9) + 0.004);
  const Z_NARIZ = 0.085;
  const LARGO_PEZ = 0.33;

  function geometriaCuerpo() {
    const anillos = 34;
    const lados = 16;
    const posiciones = [];
    const indices = [];
    for (let i = 0; i <= anillos; i++) {
      const t = i / anillos;
      const w = anchoPez(t);
      const h = altoPez(t);
      for (let j = 0; j <= lados; j++) {
        const a = (j / lados) * Math.PI * 2;
        // Vientre algo más plano que el lomo.
        const y = Math.sin(a) * h * (Math.sin(a) < 0 ? 0.82 : 1);
        posiciones.push(Math.cos(a) * w, y, Z_NARIZ - t * LARGO_PEZ);
      }
    }
    for (let i = 0; i < anillos; i++) {
      for (let j = 0; j < lados; j++) {
        const a = i * (lados + 1) + j;
        const b = a + lados + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // Aletas dorsal y anal: una membrana continua que rodea la cola.
  function geometriaAletas() {
    const pasos = 26;
    const posiciones = [];
    const indices = [];
    [1, -1].forEach((signo, k) => {
      const base = k * (pasos + 1) * 2;
      for (let i = 0; i <= pasos; i++) {
        const t = 0.26 + (i / pasos) * 0.74;
        const h = altoPez(t) * (signo < 0 ? 0.82 : 1);
        const aleta = 0.006 + 0.02 * Math.pow(Math.max(0, Math.sin(((t - 0.26) / 0.74) * Math.PI * 0.92)), 0.6);
        const z = Z_NARIZ - t * LARGO_PEZ - (i === pasos ? 0.012 : 0);
        posiciones.push(0, signo * h * 0.7, z, 0, signo * (h + aleta), z);
        if (i < pasos) indices.push(base + i * 2, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 3, base + i * 2 + 2);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  let geoCuerpo = null;
  let geoAletas = null;

  // Pez de cuerpo alargado (cabeza grande y cola que se afina), hecho con la misma malla del
  // pez caracol y otras proporciones. Sirve para granaderos y congrios de profundidad.
  function crearPez(opciones) {
    geoCuerpo = geoCuerpo || geometriaCuerpo();
    geoAletas = geoAletas || geometriaAletas();
    const ritmo = { value: 0 };
    const fase = { value: Math.random() * 10 };
    const ondular = (mat) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uRitmo = ritmo;
        shader.uniforms.uFase = fase;
        shader.vertexShader = 'uniform float uRitmo;\nuniform float uFase;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float cola = smoothstep(0.03, -0.24, position.z);
           transformed.x += sin(uRitmo + position.z * 15.0 + uFase) * 0.034 * cola * cola;`
        );
      };
      return mat;
    };
    const piel = ondular(new THREE.MeshStandardMaterial({ color: opciones.color, roughness: 0.42, metalness: 0.05, emissive: new THREE.Color(opciones.color), emissiveIntensity: 0.05 }));
    const aleta = ondular(new THREE.MeshStandardMaterial({ color: opciones.colorAleta || opciones.color, transparent: true, opacity: 0.6, roughness: 0.4, side: THREE.DoubleSide, depthWrite: false }));
    const ojo = new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.06, metalness: 0.3 });
    const brillo = new THREE.MeshStandardMaterial({ color: '#9fb4c2', roughness: 0.1, metalness: 0.6 });
    const pez = new THREE.Group();
    pez.add(new THREE.Mesh(geoCuerpo, piel));
    pez.add(new THREE.Mesh(geoAletas, aleta));
    [-1, 1].forEach((lado) => {
      const anillo = new THREE.Mesh(new THREE.SphereGeometry(opciones.ojo * 1.15, 12, 8), brillo);
      anillo.position.set(lado * 0.03, 0.014, 0.05);
      pez.add(anillo);
      const o = new THREE.Mesh(new THREE.SphereGeometry(opciones.ojo, 12, 8), ojo);
      o.position.set(lado * 0.034, 0.014, 0.052);
      pez.add(o);
    });
    pez.scale.fromArray(opciones.escala);
    pez.traverse((o) => (o.frustumCulled = false));
    return { pez: pez, ritmo: ritmo };
  }

  const TIPOS_PEZ = {
    // Granaderos ("colas de ratón"): los carroñeros que las cámaras registraron entre 4.000 y 5.500 m.
    granadero: { desde: 4000, hasta: 5450, color: '#6e7479', colorAleta: '#4d5257', ojo: 0.011, escala: [1.7, 2.0, 2.7] },
    // Congrios de profundidad (Bassozetus): dominan la transición hacia la zona hadal, cerca de los 6.000 m.
    congrio: { desde: 5950, hasta: 6650, color: '#c8a79c', colorAleta: '#b08c82', ojo: 0.005, escala: [1.1, 1.2, 2.6] },
  };

  AFRAME.registerComponent('peces-ladera', {
    schema: { tipo: { default: 'granadero' }, cantidad: { default: 5 } },
    init: function () {
      const tipo = TIPOS_PEZ[this.data.tipo];
      this.tipo = tipo;
      this.grupo = new THREE.Group();
      this.peces = [];
      for (let i = 0; i < this.data.cantidad; i++) {
        const { pez, ritmo } = crearPez(tipo);
        this.grupo.add(pez);
        this.peces.push({
          objeto: pez, ritmo: ritmo, fase: i / this.data.cantidad, susto: 0,
          x: 2.2 + Math.random() * 2.6, z: -6.5 + Math.random() * 5, sentido: Math.random() < 0.5 ? -1 : 1,
          tamano: 0.8 + Math.random() * 0.5,
        });
      }
      this.grupo.visible = false;
      this.mundo = new V3();
      this.mira = new V3();
      this.el.setObject3D('mesh', this.grupo);
    },
    tick: function (t, dt) {
      const p = estado.profundidad;
      const tipo = this.tipo;
      const dentro = !estado.enSuperficie && estado.desdeFondo === 0 && p > tipo.desde && p < tipo.hasta;
      this.grupo.visible = dentro;
      if (!dentro) return;
      const s = segundos(dt);
      const ahora = U.uTiempo.value;
      const borde = B.suave(tipo.desde, tipo.desde + 150, p) * (1 - B.suave(tipo.hasta - 150, tipo.hasta, p));
      this.peces.forEach((pez) => {
        // Se van quedando arriba a medida que se baja; cada uno vuelve a aparecer desde abajo.
        const ciclo = (ahora * 0.11 + pez.fase) % 1;
        const y = -5 + ciclo * 12;
        const nado = Math.sin(ahora * 0.35 + pez.fase * 20) * 1.2;
        pez.objeto.getWorldPosition(this.mundo);
        const luz = B.iluminado(this.mundo);
        pez.susto += (luz - pez.susto) * Math.min(1, s * (luz > pez.susto ? 5 : 0.6));
        // Si los alumbran, se alejan hacia la roca.
        const x = pez.x + pez.susto * 2.4;
        const z = pez.z + nado * pez.sentido;
        pez.objeto.position.set(x, y, z);
        this.mira.set(x + pez.susto * 2, y + 0.25, z + Math.cos(ahora * 0.35 + pez.fase * 20) * pez.sentido * 1.5);
        pez.objeto.lookAt(this.mira);
        pez.objeto.scale.fromArray(tipo.escala).multiplyScalar(pez.tamano * (ciclo < 0.08 ? ciclo / 0.08 : ciclo > 0.92 ? (1 - ciclo) / 0.08 : 1) * borde + 0.0001);
        pez.ritmo.value += s * (2.4 + pez.susto * 9);
      });
    },
  });

  /* ---------- Isópodos munnópsidos: del tamaño de una mano, con patas larguísimas ---------- */
  AFRAME.registerComponent('isopodos', {
    schema: { cantidad: { default: 3 } },
    init: function () {
      const mCuerpo = new THREE.MeshStandardMaterial({ color: '#e6d9cf', roughness: 0.45 });
      const mPata = new THREE.MeshStandardMaterial({ color: '#d9c9bd', roughness: 0.5 });
      this.grupo = new THREE.Group();
      this.animales = [];
      const inicios = [[-2.6, -4.4], [2.4, -4.9], [1.9, -1.2]];
      for (let i = 0; i < this.data.cantidad; i++) {
        const animal = new THREE.Group();
        const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mCuerpo);
        cuerpo.scale.set(0.018, 0.012, 0.034);
        cuerpo.position.y = 0.05;
        animal.add(cuerpo);
        const patas = [];
        for (let k = 0; k < 8; k++) {
          const lado = k % 2 ? 1 : -1;
          const fila = Math.floor(k / 2);
          const pivote = new THREE.Group();
          pivote.position.set(lado * 0.012, 0.05, 0.022 - fila * 0.014);
          // Cada pata sube, se quiebra en la "rodilla" y baja hasta el sedimento.
          const muslo = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.06, 5), mPata);
          muslo.position.set(lado * 0.026, 0.014, 0);
          muslo.rotation.z = -lado * 1.1;
          const canilla = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0008, 0.085, 5), mPata);
          canilla.position.set(lado * 0.068, -0.012, 0);
          canilla.rotation.z = lado * 0.5;
          pivote.add(muslo);
          pivote.add(canilla);
          animal.add(pivote);
          patas.push({ pivote: pivote, fila: fila, lado: lado });
        }
        // Antenas largas hacia adelante.
        [-1, 1].forEach((lado) => {
          const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0005, 0.09, 4), mPata);
          antena.position.set(lado * 0.016, 0.055, 0.075);
          antena.rotation.set(Math.PI / 2, 0, -lado * 0.25);
          animal.add(antena);
        });
        animal.scale.setScalar(1.5 + i * 0.25);
        animal.position.set(inicios[i % 3][0], ALTURA_FONDO, inicios[i % 3][1]);
        this.grupo.add(animal);
        this.animales.push({ objeto: animal, patas: patas, fase: i * 2.1, destino: new V3(POSICION_CARNADA.x + (i - 1) * 0.5, ALTURA_FONDO, POSICION_CARNADA.z + 0.55 - i * 0.35) });
      }
      this.grupo.visible = false;
      this.dir = new V3();
      this.el.setObject3D('mesh', this.grupo);
    },
    tick: function (t, dt) {
      const activo = estado.carnada > 4;
      this.grupo.visible = activo;
      if (!activo) return;
      const s = segundos(dt);
      const ahora = U.uTiempo.value;
      this.animales.forEach((a) => {
        this.dir.copy(a.destino).sub(a.objeto.position);
        this.dir.y = 0;
        const distancia = this.dir.length();
        const camina = distancia > 0.05;
        if (camina) {
          a.objeto.position.addScaledVector(this.dir.normalize(), Math.min(distancia, 0.11 * s));
          a.objeto.rotation.y = Math.atan2(this.dir.x, this.dir.z);
        }
        // Caminan de a pasos: las patas de un lado se alternan con las del otro.
        a.patas.forEach((pata) => {
          const paso = camina ? Math.sin(ahora * 4 + a.fase + pata.fila * 1.6 + (pata.lado > 0 ? Math.PI : 0)) : Math.sin(ahora * 0.8 + pata.fila) * 0.2;
          pata.pivote.rotation.y = paso * 0.3;
          pata.pivote.rotation.z = pata.lado * Math.max(0, paso) * 0.12;
        });
      });
    },
  });

  AFRAME.registerComponent('pez-caracol', {
    schema: { retraso: { default: 6 }, tamano: { default: 1 }, radio: { default: 0.7 }, altura: { default: 0.3 }, angulo: { default: 200 }, sentido: { default: 1 } },
    init: function () {
      geoCuerpo = geoCuerpo || geometriaCuerpo();
      geoAletas = geoAletas || geometriaAletas();
      const fase = { value: Math.random() * 10 };
      this.ritmo = { value: 0 };
      // El cuerpo ondula de la mitad hacia la cola, como un renacuajo.
      const ondular = (mat) => {
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uRitmo = this.ritmo;
          shader.uniforms.uFase = fase;
          shader.vertexShader = 'uniform float uRitmo;\nuniform float uFase;\n' + shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             float cola = smoothstep(0.03, -0.24, position.z);
             transformed.x += sin(uRitmo + position.z * 17.0 + uFase) * 0.03 * cola * cola;`
          );
        };
        return mat;
      };
      const mPiel = ondular(new THREE.MeshStandardMaterial({ color: '#8fb0de', transparent: true, opacity: 0.8, roughness: 0.22, metalness: 0.0, emissive: new THREE.Color('#0a1830'), emissiveIntensity: 0.35 }));
      const mAleta = ondular(new THREE.MeshStandardMaterial({ color: '#a9c4ea', transparent: true, opacity: 0.38, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }));
      const mOrgano = new THREE.MeshStandardMaterial({ color: '#5b2c26', roughness: 0.6 });
      const mOjo = new THREE.MeshStandardMaterial({ color: '#05060a', roughness: 0.08, metalness: 0.2 });

      const pez = new THREE.Group();
      // Órganos visibles a través de la piel gelatinosa.
      const organo = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mOrgano);
      organo.scale.set(0.02, 0.018, 0.04);
      organo.position.set(0, -0.006, 0.005);
      pez.add(organo);
      const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.0015, 0.15, 6), new THREE.MeshStandardMaterial({ color: '#d7dfee', roughness: 0.5 }));
      columna.rotation.x = Math.PI / 2;
      columna.position.set(0, 0.006, -0.06);
      pez.add(columna);

      const cuerpo = new THREE.Mesh(geoCuerpo, mPiel);
      cuerpo.renderOrder = 2;
      pez.add(cuerpo);
      const aletas = new THREE.Mesh(geoAletas, mAleta);
      aletas.renderOrder = 3;
      pez.add(aletas);

      this.pectorales = [];
      [-1, 1].forEach((lado) => {
        const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 8), mOjo);
        ojo.position.set(lado * 0.031, 0.015, 0.052);
        pez.add(ojo);
        const pivote = new THREE.Group();
        pivote.position.set(lado * 0.043, -0.008, 0.022);
        const aleta = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mAleta);
        aleta.scale.set(0.004, 0.03, 0.036);
        aleta.position.set(lado * 0.004, -0.012, -0.03);
        pivote.add(aleta);
        pez.add(pivote);
        this.pectorales.push({ pivote: pivote, lado: lado });
      });

      pez.scale.setScalar(this.data.tamano);
      pez.traverse((o) => (o.frustumCulled = false));
      pez.visible = false;
      this.pez = pez;
      this.tiempo = 0;
      this.mira = new V3();
      this.anterior = new V3();
      this.fase = fase.value;

      const d = this.data;
      const a0 = (d.angulo * Math.PI) / 180;
      const centro = POSICION_CARNADA;
      const lejos = new V3(centro.x + Math.cos(a0) * 7, ALTURA_FONDO + 1.3, centro.z + Math.sin(a0) * 7 - 2);
      const medio = new V3(centro.x + Math.cos(a0) * 3, ALTURA_FONDO + 0.7, centro.z + Math.sin(a0) * 3 - 0.5);
      const entrada = new V3(centro.x + Math.cos(a0) * d.radio, ALTURA_FONDO + d.altura, centro.z + Math.sin(a0) * d.radio);
      this.ruta = new THREE.CatmullRomCurve3([lejos, medio, entrada]);
      this.anguloInicial = a0;
      this.el.setObject3D('mesh', pez);
    },
    tick: function (t, dt) {
      const d = this.data;
      const s = segundos(dt);
      const activo = estado.carnada > d.retraso;
      this.pez.visible = activo;
      if (!activo) {
        this.tiempo = 0;
        return;
      }
      this.tiempo += s;
      const llegada = 9;
      const centro = POSICION_CARNADA;
      this.anterior.copy(this.pez.position);
      if (this.tiempo < llegada) {
        const k = this.tiempo / llegada;
        const suave = k * k * (3 - 2 * k);
        this.ruta.getPointAt(suave, this.pez.position);
        this.ruta.getPointAt(Math.min(1, suave + 0.03), this.mira);
      } else {
        // Ronda la carnada lentamente, subiendo y bajando.
        const giro = (this.tiempo - llegada) * 0.16 * d.sentido;
        const a = this.anguloInicial + giro;
        const r = d.radio + Math.sin(this.tiempo * 0.23 + this.fase) * 0.12;
        const y = ALTURA_FONDO + d.altura + Math.sin(this.tiempo * 0.4 + this.fase) * 0.06;
        this.pez.position.set(centro.x + Math.cos(a) * r, y, centro.z + Math.sin(a) * r);
        const a2 = a + 0.12 * d.sentido;
        this.mira.set(centro.x + Math.cos(a2) * r, y, centro.z + Math.sin(a2) * r);
      }
      this.pez.lookAt(this.mira);
      const rapidez = this.pez.position.distanceTo(this.anterior) / Math.max(s, 0.001);
      this.ritmo.value += s * (2.2 + rapidez * 5);
      this.pectorales.forEach((p) => (p.pivote.rotation.y = p.lado * (0.35 + Math.sin(this.ritmo.value * 0.6) * 0.3)));
    },
  });
})();
