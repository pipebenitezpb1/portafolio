/*
  Datos de los proyectos del Taller de Diseño de Interfaces (UAI 2026).
  Para agregar un video: pega el ID de YouTube en "video" (lo que va después de "v=" o de "youtu.be/").
  Si "video" está vacío, la sección de video de la ficha no se muestra.
  "repoListo: false" oculta el botón del repositorio hasta que exista en GitHub.
*/
const GITHUB = 'https://github.com/pipebenitezpb1/';
const PAGES = 'https://pipebenitezpb1.github.io/';

window.PROYECTOS = {
  'lamina-microondas':   { repo: GITHUB + 'lamina-interfaces-microondas', repoListo: true, demo: '', video: '' },
  'aves-de-chile':       { repo: GITHUB + 'Aves-de-Chile', repoListo: true, demo: PAGES + 'Aves-de-Chile/', video: '' },
  'sintetizador':        { repo: GITHUB + 'mi-primer-sintetizador', repoListo: true, demo: '', video: '' },
  'sonificacion':        { repo: GITHUB + 'sonificacion-datos', repoListo: true, demo: '', video: '',
                           extra: [{ texto: 'Repo sonificación de imagen', url: GITHUB + 'sonificador-imagenes' },
                                   { texto: 'Sonificador de imágenes en línea', url: PAGES + 'sonificador-imagenes/' }] },
  'voz-formas':          { repo: GITHUB + 'voz-formas', repoListo: true, demo: PAGES + 'voz-formas/', video: '' },
  'cofre-sonoro':        { repo: GITHUB + 'Cofre-Sonoro-Minecraft', repoListo: true, demo: PAGES + 'Cofre-Sonoro-Minecraft/', video: 'gqNnVetmCBw' },
  'pulsar':              { repo: GITHUB + 'PULSAR', repoListo: true, demo: 'https://sintetizador.insta3d.cl', video: '' },
  'robotface':           { repo: GITHUB + 'RobotFace', repoListo: true, demo: PAGES + 'RobotFace/', video: '' },
  'guantazo':            { repo: GITHUB + 'guantazo-vr', repoListo: true, demo: PAGES + 'guantazo-vr/', video: '' },
  'mediapipe-sonoro':    { repo: GITHUB + 'mediapipe-sonoro', repoListo: true, demo: 'https://portafolio.insta3d.cl/mediapipe-sonoro/app/', video: '' },
  'ar-avion':            { repo: GITHUB + 'ar-avion', repoListo: true, demo: 'https://portafolio.insta3d.cl/ar-avion/app/', video: '' },
  'sala-de-guerra':      { repo: GITHUB + 'sala-de-guerra', repoListo: true, demo: PAGES + 'sala-de-guerra/', video: '' },
  'chivilingo':          { repo: GITHUB + 'chivilingo', repoListo: false, demo: '', video: '' },
  'fosa-atacama':        { repo: GITHUB + 'fosa-atacama', repoListo: true, demo: 'https://portafolio.insta3d.cl/fosa-atacama/', video: '' },
};

(function () {
  function crearEnlace(texto, url, clase) {
    const enlace = document.createElement('a');
    enlace.className = clase;
    enlace.href = url;
    enlace.target = '_blank';
    enlace.rel = 'noopener';
    enlace.textContent = texto;
    return enlace;
  }

  function llenarEnlaces() {
    document.querySelectorAll('[data-enlaces]').forEach(function (contenedor) {
      const proyecto = window.PROYECTOS[contenedor.dataset.enlaces];
      if (!proyecto) return;
      const clase = contenedor.dataset.clase || 'cta alt';
      if (proyecto.demo) contenedor.appendChild(crearEnlace('Abrir en línea ↗', proyecto.demo, clase));
      if (proyecto.repo && proyecto.repoListo) contenedor.appendChild(crearEnlace('Repositorio GitHub ↗', proyecto.repo, clase));
      (proyecto.extra || []).forEach(function (e) { contenedor.appendChild(crearEnlace(e.texto + ' ↗', e.url, clase)); });
      if (!contenedor.children.length) contenedor.hidden = true;
    });
  }

  function llenarVideos() {
    document.querySelectorAll('[data-video]').forEach(function (seccion) {
      const proyecto = window.PROYECTOS[seccion.dataset.video];
      if (!proyecto || !proyecto.video) { seccion.hidden = true; return; }
      const marco = seccion.querySelector('.yt');
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + proyecto.video;
      iframe.title = 'Video demostrativo';
      iframe.loading = 'lazy';
      iframe.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      marco.appendChild(iframe);
    });
  }

  // Estilos mínimos para las fichas antiguas que no cargan ficha.css
  function agregarEstilos() {
    const estilo = document.createElement('style');
    estilo.textContent =
      '.enlaces-taller{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 8px;}' +
      '.enlace-taller{display:inline-block;font-family:var(--mono);font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink);background:var(--cream);text-decoration:none;padding:10px 16px;border:2px solid var(--ink);box-shadow:3px 3px 0 var(--ink);}' +
      '.enlace-taller:hover{background:var(--accent);border-color:var(--accent);color:#fff;}' +
      '.yt{position:relative;padding-bottom:56.25%;height:0;border:2px solid var(--ink);box-shadow:6px 6px 0 var(--ink);background:#000;}' +
      '.yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0;}';
    document.head.appendChild(estilo);
  }

  document.addEventListener('DOMContentLoaded', function () { agregarEstilos(); llenarEnlaces(); llenarVideos(); });
})();
