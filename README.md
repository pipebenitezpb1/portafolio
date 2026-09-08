# Portafolio — Luis-Felipe Benítez

Portafolio personal y académico. Sitio estático (HTML/CSS/JS, sin build), estilo retro-industrial, tema claro fijo.

🔗 **En vivo:** https://portafolio.insta3d.cl

## Estructura

```
index.html                          Página principal (Proyectos + Universidad)
fonts/                              Fuentes auto-alojadas (Barlow Condensed, Barlow, Space Mono)
universidad/
  entrega-1.html                   Entrega 1 — lámina interactiva de interfaces
  lamina-microondas.svg            Entrega 1 — versión imagen (vectorial)
  entrega-4.html                   Entrega 4 — hub de sonificación
  entrega4/imagen.html             Entrega 4.2 — sonificación de imagen
  entrega4/datos.html              Entrega 4.1 — sonificación de datos
```

## Taller de Interfaces (UAI 2026 · Prof. Jorge Forero)

### Entrega 1 — Lámina de análisis de interfaces
Análisis de las interfaces de entrada/salida de un horno de microondas, clasificadas en **física**, **visual** y **acústica**. Versión interactiva (`entrega-1.html`) + versión imagen vectorial (`lamina-microondas.svg`).

### Entrega 2 — Aves de Chile (app educativa de audio)
App para aprender a reconocer aves chilenas por su canto; el sonido es el eje de la interacción. Publicada aparte: https://bigkokoz.github.io/Aves-de-Chile/

### Entrega 4 — Sonificación de datos e imágenes
Dos módulos interactivos:

**4.1 · Sonificación de datos** (`entrega4/datos.html`): un dataset se convierte en melodía.

| Variable | Tipo | Parámetro sonoro |
|---|---|---|
| Orden de filas | secuencia | Tiempo (avance de la melodía) |
| Variable numérica | numérica | Altura de la nota (cuantizada a escala) |
| Variable categórica | categórica | Timbre / instrumento |

**4.2 · Sonificación de imagen** (`entrega4/imagen.html`): barrido de píxeles.

| Dimensión de la imagen | Parámetro sonoro |
|---|---|
| Posición X | Tiempo |
| Posición Y | Voces (polifonía) |
| Color (luminancia/matiz/RGB) | Altura de la nota |
| Brillo | Volumen (oscuro = silencio) |

## Tecnología

HTML + CSS + JavaScript puro. Audio con la **Web Audio API** (sin librerías para la síntesis). Fuentes auto-alojadas (sin Google Fonts).

## Despliegue

Servido desde un servidor propio detrás de Cloudflare Tunnel. La copia local se sincroniza al servidor con un script de despliegue no incluido en el repositorio.
