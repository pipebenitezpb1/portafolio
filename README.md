# Portafolio — Luis-Felipe Benitez

Portafolio personal y académico. Sitio estático (HTML/CSS/JS, sin build), estilo retro-industrial, tema claro fijo.

🔗 **En vivo:** https://portafolio.insta3d.cl

## Estructura

Cada encargo tiene su propia URL: `portafolio.insta3d.cl/<encargo>/`.

```
index.html                 Portada: Taller de Interfaces (por unidad), otros proyectos, contacto
taller/ficha.css           Estilos compartidos de las fichas
taller/proyectos.js        Repositorio, demo y video de cada proyecto (aquí se pegan los IDs de YouTube)
fonts/                     Fuentes auto-alojadas (Barlow, Barlow Condensed, Space Mono)
analisis-interfaces/       U1 · E1 Lámina de interfaces del microondas
aves-de-chile/             U1 · E2 App de aves por su canto
sintetizador/              U1 · E3 Sintetizador en Max/MSP
sonificacion/              U1 · E4 Sonificación (datos/ e imagen/)
voz-formas/                U1 · Ejercicio de visualización de voz
cofre-sonoro/              U1 · Proyecto de la unidad (grupal)
pulsar/                    U2 · E1 Controlador PULSAR
robotface/                 U2 · RobotFace
guantazo/                  U3 · Módulo MediaPipe (¡Guantazo!)
mediapipe-sonoro/          U3 · Módulo MediaPipe: Cuerpo Sonoro, DJ y Dibujo Sonoro (app/ = experiencias)
ar-avion/                  U3 · Módulo realidad aumentada: B-24D (app/ = experiencia)
sala-de-guerra/            U3 · Módulo WebXR
chivilingo/                U3 · Prototipo Chile Re-Descubre
fosa-atacama/              U3 · Experiencia VR (proyecto final)
fosa-atacama-proyecto/     U3 · Ficha del proyecto final
pulsar-mejora/             Propuesta de mejora PULSAR 2.0
universidad/               Redirecciones desde las rutas antiguas (también en _redirects)
```

## Repositorios del Taller de Diseño de Interfaces (UAI 2026)

| Proyecto | Repositorio |
|---|---|
| Análisis de interfaces | https://github.com/pipebenitezpb1/lamina-interfaces-microondas |
| Aves de Chile | https://github.com/pipebenitezpb1/Aves-de-Chile |
| Mi Primer Sintetizador | https://github.com/pipebenitezpb1/mi-primer-sintetizador |
| Sonificación de datos | https://github.com/pipebenitezpb1/sonificacion-datos |
| Sonificación de imagen | https://github.com/pipebenitezpb1/sonificador-imagenes |
| Voz + Forma | https://github.com/pipebenitezpb1/voz-formas |
| Cofre Sonoro Minecraft | https://github.com/pipebenitezpb1/Cofre-Sonoro-Minecraft |
| PULSAR | https://github.com/pipebenitezpb1/PULSAR |
| RobotFace | https://github.com/pipebenitezpb1/RobotFace |
| ¡Guantazo! | https://github.com/pipebenitezpb1/guantazo-vr |
| Cuerpo, manos y sonido | https://github.com/pipebenitezpb1/mediapipe-sonoro |
| Avión en AR · B-24D | https://github.com/pipebenitezpb1/ar-avion |
| Sala de Guerra | https://github.com/pipebenitezpb1/sala-de-guerra |
| Chivilingo | https://github.com/pipebenitezpb1/chivilingo |
| Fosa de Atacama | https://github.com/pipebenitezpb1/fosa-atacama |

## Tecnología

HTML + CSS + JavaScript puro. Audio con la **Web Audio API** (sin librerías para la síntesis). Fuentes auto-alojadas (sin Google Fonts).

## Despliegue

Sitio principal en https://portafolio.insta3d.cl, servido desde un servidor propio detrás de Cloudflare Tunnel. Copia espejo en GitHub Pages: https://pipebenitezpb1.github.io/portafolio/ (todas las rutas son relativas, así que funciona en ambos).
