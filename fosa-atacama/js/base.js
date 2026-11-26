/*
 * Base compartida de "Fosa de Atacama": estado, uniformes de luz y agua para los shaders,
 * ruido, texturas generadas por código y utilidades para construir modelos.
 *
 * Estado (window.FOSA), actualizado por js/principal.js:
 *   profundidad   metros bajo la superficie
 *   velocidad     0..1  rapidez del descenso
 *   luzSol        0..1  luz que llega desde la superficie
 *   bio           0..1  bioluminiscencia visible
 *   focos         0..1  focos del lander
 *   linterna      0..1  linterna de mano
 *   alturaSuelo   altura (m) del fondo marino respecto de la plataforma del lander
 *   caida         0..1  caída del lander al agua, en la superficie
 *   chapuzon      segundos desde que el lander tocó el agua (0 = aún no)
 *   desdeFondo    segundos desde que el lander tocó el fondo (0 = aún no)
 *   carnada       segundos desde que se bajó el brazo con la carnada (0 = aún no)
 *   telon         0..1  fundido a negro en VR
 *   enSuperficie  true mientras la persona está en el barco
 */
(function () {
  const THREE = AFRAME.THREE;
  const V3 = THREE.Vector3;

  const estado = (window.FOSA = {
    profundidad: 0,
    velocidad: 0,
    luzSol: 1,
    bio: 0,
    focos: 0,
    linterna: 0,
    alturaSuelo: -60,
    caida: 0,
    chapuzon: 0,
    desdeFondo: 0,
    carnada: 0,
    telon: 0,
    enSuperficie: true,
  });

  // Uniformes compartidos por todos los shaders (se pasan por referencia).
  const U = {
    uTiempo: { value: 0 },
    uColorAgua: { value: new THREE.Color('#0f4f73') },
    uDensidad: { value: 0.05 },
    uLuzSol: { value: 1 },
    uProfundidad: { value: 0 },
    uDesplazamiento: { value: 0 },
    uFocos: { value: 0 },
    uFocoPos: { value: [new V3(-0.75, 2.35, -1.0), new V3(0.75, 2.35, -1.0)] },
    uFocoDir: { value: [new V3(-0.1, -0.62, -0.78).normalize(), new V3(0.1, -0.62, -0.78).normalize()] },
    uLinterna: { value: 0 },
    uLinternaPos: { value: new V3(0, 1.4, 0) },
    uLinternaDir: { value: new V3(0, 0, -1) },
    uEscalaPuntos: { value: 600 },
    uSol: { value: new V3(0.78, 0.045, -0.6).normalize() },
    uCielo: { value: null },
  };

  // Posición de la carnada cuando el brazo está abajo (coordenadas del lander).
  const POSICION_CARNADA = new V3(0, -0.2, -2.55);
  const ALTURA_FONDO = -0.35; // el fondo queda bajo la plataforma, a la altura de las patas

  const segundos = (dt) => Math.min(dt || 16, 50) / 1000;
  const limitar = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const suave = (a, b, x) => {
    const t = limitar((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  /* ---------------- Ruido ---------------- */
  function azar2(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  // Ruido de valor periódico: se repite cada "periodo" unidades, para texturas sin costuras.
  function ruidoP(x, y, periodo) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const m = (n) => ((n % periodo) + periodo) % periodo;
    const a = azar2(m(xi), m(yi));
    const b = azar2(m(xi + 1), m(yi));
    const c = azar2(m(xi), m(yi + 1));
    const d = azar2(m(xi + 1), m(yi + 1));
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbmP(x, y, periodo, octavas) {
    let suma = 0;
    let amplitud = 0.5;
    let total = 0;
    for (let i = 0; i < (octavas || 5); i++) {
      suma += ruidoP(x, y, periodo) * amplitud;
      total += amplitud;
      x *= 2;
      y *= 2;
      periodo *= 2;
      amplitud *= 0.5;
    }
    return suma / total;
  }
  const fbm = (x, y, octavas) => fbmP(x, y, 4096, octavas);

  /* ---------------- Texturas generadas ---------------- */
  function configurar(textura, repetir, color) {
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
    if (repetir) textura.repeat.set(repetir[0], repetir[1]);
    if (color) textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 4;
    textura.needsUpdate = true;
    return textura;
  }

  // fn(u, v) devuelve [r, g, b] o [r, g, b, a] entre 0 y 1.
  function texturaColor(tamano, fn, repetir) {
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = tamano;
    const c = lienzo.getContext('2d');
    const imagen = c.createImageData(tamano, tamano);
    for (let y = 0; y < tamano; y++) {
      for (let x = 0; x < tamano; x++) {
        const px = fn(x / tamano, y / tamano);
        const i = (y * tamano + x) * 4;
        imagen.data[i] = px[0] * 255;
        imagen.data[i + 1] = px[1] * 255;
        imagen.data[i + 2] = px[2] * 255;
        imagen.data[i + 3] = (px[3] === undefined ? 1 : px[3]) * 255;
      }
    }
    c.putImageData(imagen, 0, 0);
    return configurar(new THREE.CanvasTexture(lienzo), repetir, true);
  }

  // Mapa de normales a partir de una función de altura periódica.
  function texturaNormal(tamano, alturaFn, fuerza, repetir) {
    const alturas = new Float32Array(tamano * tamano);
    for (let y = 0; y < tamano; y++) for (let x = 0; x < tamano; x++) alturas[y * tamano + x] = alturaFn(x / tamano, y / tamano);
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = tamano;
    const c = lienzo.getContext('2d');
    const imagen = c.createImageData(tamano, tamano);
    const h = (x, y) => alturas[((y + tamano) % tamano) * tamano + ((x + tamano) % tamano)];
    for (let y = 0; y < tamano; y++) {
      for (let x = 0; x < tamano; x++) {
        const dx = (h(x + 1, y) - h(x - 1, y)) * fuerza;
        const dy = (h(x, y + 1) - h(x, y - 1)) * fuerza;
        const largo = Math.sqrt(dx * dx + dy * dy + 1);
        const i = (y * tamano + x) * 4;
        imagen.data[i] = (-dx / largo * 0.5 + 0.5) * 255;
        imagen.data[i + 1] = (dy / largo * 0.5 + 0.5) * 255;
        imagen.data[i + 2] = (1 / largo * 0.5 + 0.5) * 255;
        imagen.data[i + 3] = 255;
      }
    }
    c.putImageData(imagen, 0, 0);
    return configurar(new THREE.CanvasTexture(lienzo), repetir, false);
  }

  // Texturas fotográficas (Poly Haven, licencia CC0) guardadas en assets/.
  const cargador = new THREE.TextureLoader();
  function texArchivo(nombre, repetir, esColor) {
    const textura = cargador.load('assets/' + nombre);
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
    if (repetir) textura.repeat.set(repetir[0], repetir[1]);
    if (esColor) textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = 8;
    return textura;
  }
  // Juego PBR: color, normales y un mapa con oclusión, rugosidad y metal (o solo rugosidad).
  function texPBR(base, repetir, mapaRugosidad) {
    return {
      map: texArchivo(base + '_diff_1k.jpg', repetir, true),
      normalMap: texArchivo(base + '_nor_gl_1k.jpg', repetir, false),
      extra: mapaRugosidad ? texArchivo(base + '_' + mapaRugosidad + '_1k.jpg', repetir, false) : null,
    };
  }

  const cache = {};
  const unaVez = (nombre, crear) => () => cache[nombre] || (cache[nombre] = crear());

  // Sedimento fino del fondo hadal: limo beige grisáceo con motas, hoyos y rastros.
  const alturaSedimento = (u, v) => {
    const base = fbmP(u * 6, v * 6, 6, 5);
    const grano = fbmP(u * 48, v * 48, 48, 2) * 0.12;
    const hoyos = Math.pow(Math.max(0, fbmP(u * 14 + 3, v * 14 + 7, 14, 2) - 0.62), 1.5) * 2.2;
    return base + grano - hoyos;
  };
  const texSedimento = unaVez('sedimento', () => ({
    map: texturaColor(512, (u, v) => {
      const h = alturaSedimento(u, v);
      const mancha = fbmP(u * 3 + 9, v * 3 + 2, 3, 4);
      const t = limitar(h * 1.15 + (mancha - 0.5) * 0.35);
      return [0.34 + t * 0.3, 0.31 + t * 0.27, 0.25 + t * 0.21];
    }),
    normalMap: texturaNormal(512, alturaSedimento, 5.5),
  }));

  // Desgaste genérico: rayas y manchas para la rugosidad de metales y pintura.
  const texDesgaste = unaVez('desgaste', () => ({
    roughnessMap: texturaColor(256, (u, v) => {
      const rayas = fbmP(u * 4, v * 64, 4, 3);
      const manchas = fbmP(u * 6 + 5, v * 6, 6, 4);
      const r = limitar(0.45 + (rayas - 0.5) * 0.5 + (manchas - 0.5) * 0.6);
      return [r, r, r];
    }),
    normalMap: texturaNormal(256, (u, v) => fbmP(u * 4, v * 64, 4, 3) * 0.4 + fbmP(u * 24, v * 24, 24, 2) * 0.25, 1.6),
  }));

  // Cubierta de acero con pintura antideslizante.
  const texCubierta = unaVez('cubierta', () => {
    const altura = (u, v) => fbmP(u * 96, v * 96, 96, 2) * 0.7 + fbmP(u * 8, v * 8, 8, 3) * 0.3;
    return {
      map: texturaColor(512, (u, v) => {
        const sucio = fbmP(u * 5, v * 5, 5, 5);
        const grano = fbmP(u * 96, v * 96, 96, 2);
        const oxido = Math.pow(Math.max(0, fbmP(u * 7 + 3, v * 7 + 1, 7, 4) - 0.6), 1.2) * 2.4;
        const t = 0.75 + (sucio - 0.5) * 0.5 + (grano - 0.5) * 0.25;
        return [0.13 * t + oxido * 0.28, 0.21 * t + oxido * 0.1, 0.19 * t + oxido * 0.03];
      }),
      normalMap: texturaNormal(512, altura, 3.2),
    };
  });

  // Rejilla metálica de la plataforma del lander (con transparencia).
  const texRejilla = unaVez('rejilla', () => {
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 256;
    const c = lienzo.getContext('2d');
    c.clearRect(0, 0, 256, 256);
    c.strokeStyle = '#8f969c';
    c.lineWidth = 7;
    for (let i = 0; i <= 256; i += 32) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 256);
      c.moveTo(0, i);
      c.lineTo(256, i);
      c.stroke();
    }
    return configurar(new THREE.CanvasTexture(lienzo), [14, 14], true);
  });

  // Punto suave para partículas.
  const texPunto = unaVez('punto', () => {
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 64;
    const c = lienzo.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(lienzo);
  });

  /* ---------------- Materiales ---------------- */
  function material(color, opciones) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.8, metalness: 0 }, opciones || {}));
  }
  function metal(color, rugosidad, opciones) {
    const d = texDesgaste();
    return new THREE.MeshStandardMaterial(
      Object.assign(
        { color: color, metalness: 0.9, roughness: rugosidad === undefined ? 0.55 : rugosidad, roughnessMap: d.roughnessMap, normalMap: d.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) },
        opciones || {}
      )
    );
  }
  function pintura(color, opciones) {
    const d = texDesgaste();
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, metalness: 0.1, roughness: 0.6, roughnessMap: d.roughnessMap }, opciones || {}));
  }

  /* ---------------- Construcción de modelos ---------------- */
  // Junta muchas piezas en una sola malla por material, para dibujar rápido en el visor.
  function Lote() {
    this.porMaterial = new Map();
  }
  Lote.prototype.agregarM = function (geometria, mat, matriz) {
    const g = geometria.index ? geometria.toNonIndexed() : geometria.clone();
    if (matriz) g.applyMatrix4(matriz);
    if (!this.porMaterial.has(mat)) this.porMaterial.set(mat, []);
    this.porMaterial.get(mat).push(g);
    return this;
  };
  Lote.prototype.agregar = function (geometria, mat, posicion, rotacion, escala) {
    const e = escala === undefined ? [1, 1, 1] : typeof escala === 'number' ? [escala, escala, escala] : escala;
    const matriz = new THREE.Matrix4().compose(
      new V3().fromArray(posicion || [0, 0, 0]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler().fromArray(rotacion || [0, 0, 0])),
      new V3().fromArray(e)
    );
    return this.agregarM(geometria, mat, matriz);
  };
  // Tubo o viga entre dos puntos. lados = 4 da una viga de sección cuadrada.
  Lote.prototype.tubo = function (mat, desde, hasta, radio, lados) {
    const a = new V3().fromArray(desde);
    const b = new V3().fromArray(hasta);
    const direccion = b.clone().sub(a);
    const largo = direccion.length();
    const geometria = new THREE.CylinderGeometry(radio, radio, largo, lados || 10);
    if (lados === 4) geometria.rotateY(Math.PI / 4);
    const matriz = new THREE.Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), direccion.normalize()),
      new V3(1, 1, 1)
    );
    return this.agregarM(geometria, mat, matriz);
  };
  Lote.prototype.construir = function () {
    const grupo = new THREE.Group();
    this.porMaterial.forEach((geometrias, mat) => {
      grupo.add(new THREE.Mesh(fusionar(geometrias), mat));
    });
    return grupo;
  };

  function fusionar(geometrias) {
    let total = 0;
    geometrias.forEach((g) => (total += g.attributes.position.count));
    const posiciones = new Float32Array(total * 3);
    const normales = new Float32Array(total * 3);
    const uvs = new Float32Array(total * 2);
    let i = 0;
    geometrias.forEach((g) => {
      const n = g.attributes.position.count;
      posiciones.set(g.attributes.position.array, i * 3);
      if (g.attributes.normal) normales.set(g.attributes.normal.array, i * 3);
      if (g.attributes.uv) uvs.set(g.attributes.uv.array, i * 2);
      i += n;
    });
    const fusion = new THREE.BufferGeometry();
    fusion.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    fusion.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
    fusion.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return fusion;
  }

  // Deforma una geometría con ruido para que parezca roca.
  function deformar(geometria, cantidad, frecuencia) {
    const pos = geometria.attributes.position;
    const semilla = Math.random() * 100;
    const v = new V3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = fbm(v.x * frecuencia + semilla, v.y * frecuencia + v.z * frecuencia * 1.3 + semilla, 3) - 0.5;
      v.multiplyScalar(1 + n * cantidad);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geometria.computeVertexNormals();
    return geometria;
  }

  /* ---------------- GLSL compartido ---------------- */
  const GLSL_RUIDO = `
    float azar(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float ruido(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(azar(i), azar(i + vec2(1.0, 0.0)), u.x), mix(azar(i + vec2(0.0, 1.0)), azar(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p){
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { s += ruido(p) * a; p = p * 2.03 + 11.7; a *= 0.5; }
      return s;
    }
  `;

  // Luz de los focos del lander y de la linterna sobre un punto del mundo.
  const GLSL_HACES = `
    uniform float uFocos;
    uniform vec3 uFocoPos[2];
    uniform vec3 uFocoDir[2];
    uniform float uLinterna;
    uniform vec3 uLinternaPos;
    uniform vec3 uLinternaDir;
    float cono(vec3 p, vec3 origen, vec3 dir, float cosBorde, float alcance){
      vec3 v = p - origen;
      float d = length(v);
      float c = dot(v / max(d, 0.0001), dir);
      float borde = smoothstep(cosBorde, mix(cosBorde, 1.0, 0.45), c);
      float atenuacion = smoothstep(alcance, alcance * 0.3, d) / (1.0 + d * d * 0.06);
      return borde * atenuacion;
    }
    float luzHaces(vec3 p){
      float l = uFocos * (cono(p, uFocoPos[0], uFocoDir[0], 0.80, 20.0) + cono(p, uFocoPos[1], uFocoDir[1], 0.80, 20.0));
      l += uLinterna * cono(p, uLinternaPos, uLinternaDir, 0.93, 13.0) * 0.8;
      return l;
    }
  `;

  const GLSL_NIEBLA = `
    uniform vec3 uColorAgua;
    uniform float uDensidad;
    float factorNiebla(float d){ return 1.0 - exp(-d * d * uDensidad * uDensidad); }
  `;

  const GLSL_SALIDA = `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  `;

  // Color del cielo para una dirección dada, tomado de una fotografía panorámica de un amanecer
  // sobre el mar (lo usan el cielo y el reflejo del océano). Solo se usa la mitad superior de la
  // foto; la franja con tierra cerca del horizonte se evita comprimiendo un poco el cielo.
  const GLSL_CIELO = `
    uniform vec3 uSol;
    uniform sampler2D uCielo;
    vec3 colorCielo(vec3 d){
      float azimut = atan(d.z, d.x) - atan(uSol.z, uSol.x);
      float u = fract(azimut / 6.2831853 + 0.598);
      float haciaMar = smoothstep(0.45, 0.51, u) * (1.0 - smoothstep(0.86, 0.92, u));
      float minimo = mix(0.25, 0.022, haciaMar);
      float elevacion = asin(clamp(d.y, 0.0, 1.0));
      float e = minimo + (1.0 - minimo / 1.5708) * elevacion;
      // Las derivadas se calculan sin el salto de "fract" para que no aparezca una costura.
      vec2 uv = vec2(u, 0.5 + e / 1.5708 * 0.5);
      vec2 uvContinuo = vec2(azimut / 6.2831853, uv.y);
      return textureGrad(uCielo, uv, dFdx(uvContinuo), dFdy(uvContinuo)).rgb;
    }
  `;

  // Carga la foto del cielo y arma con ella el mapa de entorno (reflejos en los metales).
  AFRAME.registerComponent('entorno-fosa', {
    init: function () {
      const cielo = cargador.load('assets/cielo_amanecer.jpg', (textura) => {
        const crear = () => {
          const renderer = this.el.renderer;
          const lienzo = document.createElement('canvas');
          lienzo.width = 1024;
          lienzo.height = 512;
          const c = lienzo.getContext('2d');
          // La foto tiene el sol en u = 0,598; se desplaza para que coincida con el sol de la escena.
          const azimut = Math.atan2(U.uSol.value.z, U.uSol.value.x);
          const uSol = ((azimut / (Math.PI * 2) + 0.5) % 1 + 1) % 1;
          const dx = (uSol - 0.598) * 1024;
          const imagen = textura.image;
          [dx - 1024, dx, dx + 1024].forEach((x) => c.drawImage(imagen, 0, 0, imagen.width, imagen.height / 2, x, 0, 1024, 256));
          const mar = c.createLinearGradient(0, 256, 0, 512);
          mar.addColorStop(0, '#5d6f86');
          mar.addColorStop(0.15, '#1a2c3c');
          mar.addColorStop(1, '#06121b');
          c.fillStyle = mar;
          c.fillRect(0, 256, 1024, 256);
          const equirect = new THREE.CanvasTexture(lienzo);
          equirect.mapping = THREE.EquirectangularReflectionMapping;
          equirect.colorSpace = THREE.SRGBColorSpace;
          const generador = new THREE.PMREMGenerator(renderer);
          this.el.object3D.environment = generador.fromEquirectangular(equirect).texture;
          equirect.dispose();
          generador.dispose();
        };
        if (this.el.renderer) crear();
        else this.el.addEventListener('renderstart', crear, { once: true });
      });
      cielo.colorSpace = THREE.SRGBColorSpace;
      cielo.wrapS = THREE.RepeatWrapping;
      cielo.anisotropy = 8;
      U.uCielo.value = cielo;
    },
  });

  // Cuánto ilumina la linterna un punto del mundo (0 a 1). Lo usan los animales para reaccionar.
  const _haciaPunto = new V3();
  function iluminado(punto) {
    if (U.uLinterna.value < 0.05) return 0;
    _haciaPunto.copy(punto).sub(U.uLinternaPos.value);
    const distancia = _haciaPunto.length();
    if (distancia > 13) return 0;
    const coseno = _haciaPunto.dot(U.uLinternaDir.value) / Math.max(distancia, 0.0001);
    return suave(0.9, 0.97, coseno) * (1 - suave(8, 13, distancia));
  }

  window.FOSA_BASE = {
    THREE, V3, U, estado, POSICION_CARNADA, ALTURA_FONDO,
    segundos, limitar, suave, iluminado, azar2, fbm, fbmP,
    texturaColor, texturaNormal, texArchivo, texPBR, texSedimento, texDesgaste, texCubierta, texRejilla, texPunto,
    material, metal, pintura, Lote, fusionar, deformar,
    GLSL_RUIDO, GLSL_HACES, GLSL_NIEBLA, GLSL_SALIDA, GLSL_CIELO,
  };
})();
