# Estuche para llave ajustable REDLINE 8" — estado del proyecto

Resumen para continuar el trabajo en una conversación nueva. Escrito al cerrar la sesión en la nube.

## Qué es
Estuche tipo navaja para una llave ajustable REDLINE de 8": dos caras de acrílico azul de 3 mm con una silueta
curva, lomo y extremo de acrílico, y una bandeja impresa en 3D (gris) que gira hacia afuera sobre un pasador
y lleva el vaciado de la llave. Restricción del encargo: **sin pegamento ni tornillos**; solo piezas cortadas
o impresas. Carpeta de trabajo: `vaciado-llave-redline/version-navaja/`.

## Lo que NO se puede cambiar
**El acrílico ya está cortado.** No tocar nada que altere `caja_corte_navaja.svg` ni las hojas `hoja_*_600x600`.
En `generar_navaja.py` eso significa no cambiar: `LARGO_ESTIMADO`, `ANCHO_ESTIMADO`, `MARGEN_CAJA`, `ALTURA_MAX`,
`ESPESOR_MDF`, `RANURA_EXTRA` (0.1, 0.0), `CERRADURA_CORTE`, `PARED*`, `NUDILLO_R`, `RADIO_ESTETICO`,
`RADIO_ESQUINA`, ni la posición de la muesca del fiador. Después de cada cambio, comprobar con `git status`
que no aparezcan modificados los `.svg` ni los `.pdf`.

## Cómo se genera todo
```
pip install numpy shapely trimesh mapbox-earcut manifold3d scipy opencv-python-headless cadquery rhino3dm
cd vaciado-llave-redline/version-navaja
python3 generar_navaja.py      # STL de impresión, pruebas, planos de corte
python3 exportar_fusion.py     # STEP para Fusion (DESACTUALIZADO respecto del diseño actual)
python3 exportar_rhino.py      # .3dm (DESACTUALIZADO)
```
Todos los parámetros están al inicio de `generar_navaja.py`. Al final el script revisa cada STL y, con
`ESPEJO = True`, los refleja para que la bandeja abra con la mano derecha.

## Estado probado físicamente
- Ranuras del acrílico: 3,1 mm de ancho calzan con la plancha de 3 mm.
- Pasador: calzó el de 2 anillos (cuello 6,25 mm de diámetro y 3,1 mm de largo, cuerpo 10,0 mm). Es el definitivo.
- Bisagra y pestaña de cierre (diente en cuña de 3 mm): probadas con el esqueleto; la caja cierra y suena el clic.
- Vaciado: la cabeza de la llave calza casi perfecta en la bandeja anterior. El mango y la corona quedaban sueltos.

## Diseño actual, sin probar
- Vaciado corregido por zonas con las medidas del usuario: C=33 (mango), D=26,4 (corona), E=22 (cuello),
  F=30 (corona al inicio de la goma). Largo A=203,5 **estimado de una foto**. La cabeza no se tocó, solo +0,15 mm.
  La medida B=58 no se usa (agrandaba la cabeza un 20 %).
- Holgura 0,2 mm por lado más forro de TPU de 2 mm (`forro_tpu.stl`).
- Bandeja de 26,15 mm de alto en un hueco de 26,5; agujero del pasador de 10,24 mm.
- Marcos estéticos con seguros integrados (`marco_con_seguros_*.stl`), a presión, sin pestañas.
- Todo en espejo (mano derecha). El acrílico se arma dado vuelta; no se recorta.

## Pendiente
1. Imprimir `pruebas/1_calce_llave.stl` para confirmar el vaciado nuevo antes de la bandeja.
2. Medidas que faltan: largo total A, grosor del mango T1 (se supone 20 mm; define la profundidad del vaciado),
   grosor de cabeza y corona.
3. Tamaño de la cama de impresión del usuario: la bandeja mide 237 mm y los marcos 246 mm.
4. Regenerar Fusion y Rhino cuando el diseño quede probado (el usuario los pidió "al final").
   El script de Fusion con historial (`fusion/EstucheNavajaHistorial/`) nunca se probó en Fusion.
5. Traba al abrir: propuesta, no hecha.

## Modelo del fierro (carpeta `fierro/`)
Primer sólido de la llave sin la goma, por intersección de un calco superior y uno lateral a lo largo de la
línea negra que el usuario marcó en la cabeza (`modelar_fierro.py` → `llave_fierro.step`). Grosores estimados.
El usuario quiere calcar él mismo en Rhino: `poner_fotos_en_rhino.py` coloca las dos fotos a escala con
`RunPythonScript`. **Sin confirmar que funcione**: en el `.3dm` las fotos no se veían.

## Otras carpetas
- `calcado/`: foto original, calcado, diagrama de medidas (`medidas_a_tomar.png`).
- `version-deslizante/`: versión anterior descartada (funda con tapa de bisagra).

## Preferencias del usuario
- Responder en español y en corto.
- Probar con piezas chicas antes de imprimir la bandeja completa.
- Varias piezas en un solo STL cuando van juntas.
- Planos de corte: negro = corte, rojo = score, página de 600 × 600 mm en PDF.
- Fusion: solo cuerpos, sin componentes.
