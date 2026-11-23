"""Estuche tipo caja de fosforos para la llave ajustable REDLINE de 8".

Bandeja impresa en 3D (con el vaciado de la llave) que desliza dentro de una
funda de MDF abierta por un extremo; la tapa de MDF va pegada al frente de la
bandeja. Dos topes de MDF, encolados en ranuras de los laterales, corren por
un canal a cada lado de la bandeja e impiden que salga por completo.

El contorno (contorno_mm.json) se obtuvo de una foto, escalada con la regla
grabada en la mordaza (11,4 px/mm). Ajusta los parametros y vuelve a ejecutar:
    pip install numpy shapely trimesh mapbox-earcut manifold3d matplotlib
    python3 generar_vaciado.py
Salidas: bandeja_llave_redline.stl, prueba_ajuste.stl, bandeja_llave_redline.svg,
caja_mdf.svg (plano de corte 1:1) y vista_previa.png.
"""
import json, os
import numpy as np
import trimesh
from shapely.geometry import Polygon, Point, box

# ---- herramienta / vaciado ----
HOLGURA = 0.7              # mm de juego alrededor de la llave
ALTURA_HERRAMIENTA = 20.0  # mm, grosor maximo de la llave (mango). MEDIR Y AJUSTAR
PROFUNDIDAD = ALTURA_HERRAMIENTA  # mm de profundidad del vaciado
BASE = 2.0                 # mm de piso bajo la llave
PARED_LATERAL = 5.0        # mm de pared minima a los lados (aloja el canal del tope)
PARED_EXTREMO = 4.0        # mm de pared minima en los extremos
RADIO_ESQUINA = 2.0        # mm, esquinas exteriores de la bandeja
DEDO_ANCHO = 24.0          # mm, ancho de la ranura para sacar la llave (0 = sin ranura)
DEDO_POS = 0.60            # posicion de la ranura a lo largo (0 = corona, 1 = mordaza)
# ---- funda de MDF ----
ESPESOR_MDF = 3.0          # mm
JUEGO_CAJA = 0.25          # mm de juego entre bandeja y funda (por lado)
RADIO_MUESCA = 10.0        # mm, muescas de la funda para tomar la bandeja
# ---- topes laterales ----
TOPE_LARGO = 8.0           # mm, largo del tope (a lo largo de la caja)
TOPE_SALIENTE = 2.0        # mm que el tope entra en el canal de la bandeja
TOPE_A_BOCA = 4.0          # mm entre el tope y la boca de la funda
CANAL_PROF = 2.5           # mm de profundidad del canal en la bandeja
CANAL_INICIO = 8.0         # mm de pared que queda al fondo del canal (hace de tope)
CANAL_JUEGO = 0.5          # mm de juego vertical del tope en el canal

aqui = os.path.dirname(os.path.abspath(__file__))
pts = np.array(json.load(open(os.path.join(aqui, "contorno_mm.json"))))
herramienta = Polygon(pts).buffer(0)
# suaviza el ruido del trazado y agrega la holgura
vaciado = herramienta.buffer(0.8).buffer(-0.8).simplify(0.05).buffer(HOLGURA, resolution=16)

x0, y0, x1, y1 = vaciado.bounds
exterior = box(x0 - PARED_EXTREMO, y0 - PARED_LATERAL, x1 + PARED_EXTREMO, y1 + PARED_LATERAL)
exterior = exterior.buffer(-RADIO_ESQUINA).buffer(RADIO_ESQUINA, resolution=16)
ex0, ey0, ex1, ey1 = exterior.bounds
w, h = ex1 - ex0, ey1 - ey0
alto = BASE + PROFUNDIDAD

corte = vaciado
if DEDO_ANCHO > 0:
    xd = x0 + DEDO_POS * (x1 - x0)
    r = DEDO_ANCHO / 2
    local = vaciado.intersection(box(xd - r, y0 - 50, xd + r, y1 + 50)).bounds
    ranura = box(xd - r, local[1] - 4, xd + r, local[3] + 4).union(
        Point(xd, local[1] - 4).buffer(r, resolution=16)).union(
        Point(xd, local[3] + 4).buffer(r, resolution=16))
    # deja 2 mm de pared entre la ranura y el canal del tope
    ranura = ranura.intersection(box(ex0, ey0 + CANAL_PROF + 2, ex1, ey1 - CANAL_PROF - 2))
    corte = vaciado.union(ranura)

def extruir(poly, z0, z1):
    m = trimesh.creation.extrude_polygon(poly, z1 - z0)
    m.apply_translation([0, 0, z0])
    return m

# canal lateral: abierto hacia el frente, cerrado al fondo, techo a 45 grados para imprimir sin soportes
cz0 = alto / 2 - (ESPESOR_MDF + CANAL_JUEGO) / 2
cz1 = cz0 + ESPESOR_MDF + CANAL_JUEGO
def canal(y_cara, sentido):
    v = []
    for x in (ex0 + CANAL_INICIO, ex1 + 1):
        v += [[x, y_cara - sentido, cz0], [x, y_cara + sentido * CANAL_PROF, cz0],
              [x, y_cara + sentido * CANAL_PROF, cz1], [x, y_cara - sentido, cz1 + CANAL_PROF + 1]]
    return trimesh.Trimesh(vertices=v).convex_hull

cortadores = [extruir(corte, BASE, alto + 1), canal(ey0, 1), canal(ey1, -1)]
pieza = trimesh.boolean.difference([extruir(exterior, 0, alto)] + cortadores, engine="manifold")
pieza.apply_translation([-ex0, -ey0, 0])
pieza.export(os.path.join(aqui, "bandeja_llave_redline.stl"))

# pieza de prueba: solo el contorno, 3 mm de alto, para comprobar el calce antes de imprimir todo
prueba = trimesh.boolean.difference(
    [extruir(vaciado.buffer(2.5), 0, 3.0), extruir(vaciado, 0.6, 4.0)], engine="manifold")
prueba.apply_translation([-ex0, -ey0, 0])
prueba.export(os.path.join(aqui, "prueba_ajuste.stl"))

# plano 1:1 de la bandeja en SVG (unidades en mm)
def ruta(poly):
    c = np.array(poly.exterior.coords)
    return "M" + " L".join(f"{x - ex0:.2f},{ey1 - y:.2f}" for x, y in c) + " Z"
open(os.path.join(aqui, "bandeja_llave_redline.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.2f}mm" height="{h:.2f}mm" '
    f'viewBox="0 0 {w:.2f} {h:.2f}" fill="none" stroke-width="0.2">'
    f'<path d="{ruta(exterior)}" stroke="black"/><path d="{ruta(corte)}" stroke="red"/>'
    f'<path d="{ruta(herramienta)}" stroke="blue" stroke-dasharray="1 1"/></svg>')

hx0, hy0, hx1, hy1 = herramienta.bounds
print(f"llave: {hx1 - hx0:.1f} x {hy1 - hy0:.1f} mm")
print(f"bandeja: {w:.1f} x {h:.1f} x {alto:.1f} mm | estanca: {pieza.is_watertight} | volumen: {pieza.volume / 1000:.1f} cm3")

# ---------- funda de MDF (uniones a tope, encoladas) ----------
t, j = ESPESOR_MDF, JUEGO_CAJA
Li, Wi, Hi = w + j, h + 2 * j, alto + j          # interior de la funda
La = Li + t                                      # largo de los paneles
tope_x = La - TOPE_A_BOCA - TOPE_LARGO           # inicio del tope, medido desde el extremo cerrado
tope_z = (cz0 + cz1) / 2 - t / 2                 # altura del tope sobre el piso interior
recorrido = (tope_x - t) - CANAL_INICIO          # cuanto sale la bandeja
piezas = [  # nombre, largo, ancho, cantidad, tipo
    ("Tapa superior / base", La, Wi + 2 * t, 2, "muesca"),
    ("Lateral", La, Hi, 2, "ranura"),
    ("Fondo (extremo cerrado)", Wi, Hi, 1, ""),
    ("Tapa frontal (pegar a la bandeja)", Wi + 2 * t, Hi + 2 * t, 1, ""),
    ("Tope", TOPE_LARGO, t + TOPE_SALIENTE, 2, ""),
]
el, y, ancho_hoja = [], 5.0, 0.0
for nombre, a, b, n, tipo in piezas:
    for i in range(n):
        if tipo == "muesca":  # semicirculo en la boca para tomar la bandeja
            r = RADIO_MUESCA
            d = (f"M5,{y:.2f} H{5 + a:.2f} V{y + b / 2 - r:.2f} "
                 f"A{r},{r} 0 0 0 {5 + a:.2f},{y + b / 2 + r:.2f} V{y + b:.2f} H5 Z")
            el.append(f'<path d="{d}" stroke="red"/>')
        else:
            el.append(f'<rect x="5" y="{y:.2f}" width="{a:.2f}" height="{b:.2f}" stroke="red"/>')
        if tipo == "ranura":  # ranura donde se encola el tope
            el.append(f'<rect x="{5 + tope_x:.2f}" y="{y + b - tope_z - t:.2f}" '
                      f'width="{TOPE_LARGO:.2f}" height="{t:.2f}" stroke="red"/>')
        if a > 60:
            el.append(f'<text x="8" y="{y + min(b, 14) / 2 + 1.5:.2f}" font-size="4" fill="blue" stroke="none">'
                      f'{nombre} {a:.1f} x {b:.1f}</text>')
        y += b + 5
        ancho_hoja = max(ancho_hoja, a + 10)
    print(f"MDF {t:g} mm | {n} x {nombre}: {a:.2f} x {b:.2f} mm")
open(os.path.join(aqui, "caja_mdf.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{ancho_hoja:.2f}mm" height="{y:.2f}mm" '
    f'viewBox="0 0 {ancho_hoja:.2f} {y:.2f}" fill="none" stroke-width="0.2" font-family="sans-serif">'
    + "".join(el) + "</svg>")
print(f"ranura del tope en cada lateral: {TOPE_LARGO:g} x {t:g} mm, a {tope_x:.1f} mm del extremo cerrado y {tope_z:.2f} mm del borde inferior")
print(f"funda exterior: {La:.1f} x {Wi + 2 * t:.1f} x {Hi + 2 * t:.1f} mm | la bandeja sale {recorrido:.0f} mm de {w:.0f}")

# ---------- vista previa ----------
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    def caja(x, y_, z, dx, dy, dz):
        m = trimesh.creation.box([dx, dy, dz]); m.apply_translation([x + dx / 2, y_ + dy / 2, z + dz / 2]); return m
    sal = recorrido
    funda = [caja(-t, -j - t, -t, La, Wi + 2 * t, t), caja(-t, -j - t, 0, La, t, Hi),
             caja(-t, h + j, 0, La, t, Hi), caja(-t, -j, 0, t, Wi, Hi)]
    topes = [caja(tope_x - t, -j - t, tope_z, TOPE_LARGO, t + TOPE_SALIENTE, t),
             caja(tope_x - t, h + j - TOPE_SALIENTE, tope_z, TOPE_LARGO, t + TOPE_SALIENTE, t)]
    band = pieza.copy(); band.apply_translation([sal, 0, 0])
    tapa = caja(w + sal, -j - t, -t, t, Wi + 2 * t, Hi + 2 * t)
    fig = plt.figure(figsize=(14, 7)); ax = fig.add_subplot(projection="3d")
    luz = np.array([0.3, -0.5, 0.8]); luz /= np.linalg.norm(luz)
    for m, col in [(trimesh.util.concatenate(funda), (0.78, 0.62, 0.44)), (band, (0.85, 0.2, 0.15)),
                   (tapa, (0.78, 0.62, 0.44)), (trimesh.util.concatenate(topes), (0.2, 0.2, 0.2))]:
        sh = 0.4 + 0.6 * np.clip(m.face_normals @ luz, 0, 1)
        ax.add_collection3d(Poly3DCollection(m.vertices[m.faces], facecolors=np.outer(sh, col), edgecolors="none"))
    ax.set_xlim(-5, w + sal + 5); ax.set_ylim(-170, 230); ax.set_zlim(-90, 110)
    ax.set_box_aspect((w + sal + 10, 400, 200)); ax.view_init(40, -60); ax.set_axis_off()
    ax.set_title("Funda sin la tapa superior, bandeja abierta hasta los topes", fontsize=10)
    fig.savefig(os.path.join(aqui, "vista_previa.png"), dpi=130, bbox_inches="tight")
except ImportError:
    pass

# ---------- vista superior acotada ----------
try:
    fig, ax = plt.subplots(figsize=(13, 4.6))
    def dib(poly, **k):
        c = np.array(poly.exterior.coords); ax.fill(c[:, 0] - ex0, c[:, 1] - ey0, **k)
    dib(box(ex0 - t, ey0 - j - t, ex0 + Li, ey1 + j + t), fc="#c9a26f", ec="k", lw=0.6)
    dib(exterior, fc="#d9382b", ec="k", lw=0.6)
    for g in getattr(corte, "geoms", [corte]):
        dib(g, fc="#7c1810", ec="k", lw=0.6)
    dib(herramienta, fc="#b9bec6", ec="k", lw=0.5)
    for yy in (-j - t, h + j - TOPE_SALIENTE):
        ax.add_patch(plt.Rectangle((tope_x - t, yy), TOPE_LARGO, t + TOPE_SALIENTE, fc="k"))
    for yy in (0, h - CANAL_PROF):
        ax.add_patch(plt.Rectangle((CANAL_INICIO, yy), w - CANAL_INICIO, CANAL_PROF, fc="none", ec="w", ls=":", lw=0.8))
    ax.add_patch(plt.Rectangle((w, -j - t), t, Wi + 2 * t, fc="#a67c46", ec="k", lw=0.6))
    ax.annotate("tope", (tope_x - t + 4, h + j + t), (tope_x - 30, h + 14), arrowprops=dict(arrowstyle="->"))
    ax.annotate("canal del tope (cerrado al fondo)", (60, h - 1.2), (40, h + 14), arrowprops=dict(arrowstyle="->"))
    ax.annotate("tapa frontal", (w + t, h / 2), (w + 10, h / 2), arrowprops=dict(arrowstyle="->"), va="center")
    ax.set_title(f"Vista superior, cerrada (mm) - bandeja {w:.1f} x {h:.1f} x {alto:.0f}, "
                 f"funda {La:.1f} x {Wi + 2 * t:.1f} x {Hi + 2 * t:.1f}", fontsize=10)
    ax.set_aspect("equal"); ax.set_xlim(-8, w + 45); ax.set_ylim(-10, h + 20); ax.grid(alpha=0.3)
    fig.savefig(os.path.join(aqui, "vista_superior.png"), dpi=130, bbox_inches="tight")
except NameError:
    pass
