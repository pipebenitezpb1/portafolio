"""Estuche para la llave ajustable REDLINE de 8", sin pegamento ni tornillos.

Solo piezas impresas en 3D y MDF cortado:
  - bandeja impresa con el vaciado de la llave, que desliza hacia afuera;
  - tubo de 4 paneles de MDF unidos por pestanas y ranuras;
  - tapa trasera y marco frontal impresos, que abrazan el tubo y traban con
    dientes flexibles en agujeros del MDF;
  - topes laterales integrados al marco frontal (corren por los canales de la bandeja);
  - tapa frontal con bisagra (pasador impreso) y cierre a presion.

El contorno (contorno_mm.json) se obtuvo de una foto, escalada con la regla
grabada en la mordaza (11,4 px/mm). Ajusta los parametros y vuelve a ejecutar:
    pip install numpy shapely trimesh mapbox-earcut manifold3d
    python3 generar_vaciado.py
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
# ---- funda de MDF (sin pegamento: encajes y trabas) ----
ESPESOR_MDF = 3.0          # mm
JUEGO_CAJA = 0.25          # mm de juego entre bandeja y funda (por lado)
MARGEN_RANURA = 3.0        # mm de MDF que queda por fuera de las ranuras de las pestanas
PESTANA = 20.0             # mm, largo de cada pestana de los laterales
# ---- piezas impresas de los extremos ----
PARED_IMP = 2.0            # mm, pared de los marcos impresos
JUEGO_MDF = 0.15           # mm de juego entre MDF y marcos impresos
FALDA = 26.0               # mm que cada marco abraza al tubo de MDF
TRABA_ALTO = 1.0           # mm, altura del diente que traba en el MDF
VENTANA = (24.0, 14.0)     # mm, ventana para empujar la bandeja con los dedos
# ---- topes laterales (integrados al marco frontal) ----
TOPE_LARGO = 10.0          # mm
TOPE_SALIENTE = 2.0        # mm que el tope entra en el canal de la bandeja
CANAL_PROF = 2.5           # mm de profundidad del canal en la bandeja
CANAL_INICIO = 8.0         # mm de pared que queda al fondo del canal (hace de tope)
CANAL_JUEGO = 0.5          # mm de juego vertical del tope en el canal
# ---- bisagra ----
BISAGRA_R = 3.5            # mm, radio exterior de los nudillos
PASADOR_D = 3.0            # mm, diametro del pasador impreso

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
cz0 = alto / 2 - (3.0 + CANAL_JUEGO) / 2
cz1 = cz0 + 3.0 + CANAL_JUEGO
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


# =====================================================================
#  FUNDA: tubo de MDF + extremos impresos.  Ejes: x = largo (0 = fondo),
#  y = ancho (bandeja de 0 a h), z = alto (bandeja de 0 a alto)
# =====================================================================
t, j, e, S, c = ESPESOR_MDF, JUEGO_CAJA, MARGEN_RANURA, PARED_IMP, JUEGO_MDF
Wi, Hi = h + 2 * j, alto + j
L = w - S + 0.3                       # largo de los paneles de MDF
xf = L + S                            # cara frontal del marco
ys0, ys1 = -j - t, h + j + t          # caras exteriores de los laterales
Y0, Y1, Z0, Z1 = ys0 - e, ys1 + e, -t, Hi + t     # exterior del tubo
Yo0, Yo1, Zb, Zt = Y0 - c - S, Y1 + c + S, Z0 - c - S, Z1 + c + S  # exterior de los marcos
yc, zm = h / 2, alto / 2

def B(xa, xb, ya, yb, za, zb):
    m = trimesh.creation.box([xb - xa, yb - ya, zb - za])
    m.apply_translation([(xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2]); return m
def U(*ms): return trimesh.boolean.union(list(ms), engine="manifold")
def D(a_, *ms): return trimesh.boolean.difference([a_, U(*ms) if len(ms) > 1 else ms[0]], engine="manifold")
def casco(*ms): return trimesh.Trimesh(vertices=np.vstack([m.vertices for m in ms])).convex_hull
def cil(eje, p, r, a_, b_):
    m = trimesh.creation.cylinder(radius=r, height=b_ - a_, sections=48)
    if eje == "y":
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
        m.apply_translation([p[0], (a_ + b_) / 2, p[1]])
    else:
        m.apply_translation([p[0], p[1], (a_ + b_) / 2])
    return m

def cavidad(xa, xb):   # hueco en "I" que recibe los cuatro paneles
    return U(B(xa, xb, Y0 - c, Y1 + c, Hi - c, Z1 + c), B(xa, xb, Y0 - c, Y1 + c, Z0 - c, c),
             B(xa, xb, ys0 - c, ys1 + c, 0, Hi))

TR_Y = [yc - 22, yc + 22]             # centros de las trabas (arriba y abajo)
def trabas(raiz, libre, cara, d):     # d = +1 la lengueta apunta a +x, -1 a -x
    cortes, dientes = [], []
    xa, xb = sorted([raiz, libre + d * 0.8])
    for yt in TR_Y:
        for zi, sg, za, zb in [(Z1 + c, -1, Z1 + c - 0.1, Zt + 1), (Z0 - c, 1, Zb - 1, Z0 - c + 0.1)]:
            cortes += [B(xa, xb, yt - 4.8, yt - 4, za, zb), B(xa, xb, yt + 4, yt + 4.8, za, zb),
                       B(*sorted([libre, libre + d * 0.8]), yt - 4.8, yt + 4.8, za, zb)]
            perfil = [(cara, zi - sg * 0.3), (cara, zi + sg * TRABA_ALTO), (cara + d * 0.8, zi + sg * TRABA_ALTO),
                      (cara + d * 3.5, zi), (cara + d * 3.5, zi - sg * 0.3)]
            dientes.append(trimesh.Trimesh(vertices=[[x, y, z] for x, z in perfil for y in (yt - 4, yt + 4)]).convex_hull)
    return cortes, dientes

# ---- tapa trasera ----
cortes, dientes = trabas(6, 23, 18, +1)
trasera = U(D(B(-2.5, FALDA, Yo0, Yo1, Zb, Zt), cavidad(0, FALDA + 1), *cortes), *dientes)

# ---- marco frontal con topes y nudillos de bisagra ----
xa_, za_ = xf - BISAGRA_R, Zt + 0.3 + BISAGRA_R       # eje de la bisagra
R = BISAGRA_R
ancho = Yo1 - Yo0
nf = 11.0                                              # nudillos del marco (3)
nl = (ancho - 3 * nf - 4 * 0.3) / 2                    # nudillos de la tapa (2)
ny = [Yo0, Yo0 + nf, Yo0 + nf + 0.3, Yo0 + nf + 0.3 + nl, Yo0 + nf + 0.6 + nl, Yo0 + 2 * nf + 0.6 + nl,
      Yo0 + 2 * nf + 0.9 + nl, Yo0 + 2 * nf + 0.9 + 2 * nl, Yo0 + 2 * nf + 1.2 + 2 * nl, Yo1]
n_marco, n_tapa = [(ny[0], ny[1]), (ny[4], ny[5]), (ny[8], ny[9])], [(ny[2], ny[3]), (ny[6], ny[7])]
cortes, dientes = trabas(L - 6, L - 23, L - 18, -1)
vx0, vx1 = L - 9 - VENTANA[1], L - 9
ventanas = B(vx0, vx1, yc - VENTANA[0] / 2, yc + VENTANA[0] / 2, Zb - 1, Zt + 1)
zl0, zl1 = Zb + 4, Zb + 14                             # altura de las pestanas de cierre
cierre_x = xf - 13
ranuras_cierre = [cil("z", (cierre_x, yy), 0.8, zl0 - 2, zl1 + 2) for yy in (Yo0 - 0.1, Yo1 + 0.1)]
una = B(xf - 5, xf + 1, yc - 9, yc + 9, Zb - 1, Z0 - c)   # muesca para abrir la tapa con la una
marco = D(B(L - FALDA, xf, Yo0, Yo1, Zb, Zt), cavidad(L - FALDA - 1, L), B(L - 1, xf + 1, -j, h + j, 0, Hi),
          ventanas, una, *cortes, *ranuras_cierre)
topes = [B(L - TOPE_LARGO, L + 0.1, ys0 - c - 0.1, -j + TOPE_SALIENTE, zm - 1.5, zm + 1.5),
         B(L - TOPE_LARGO, L + 0.1, h + j - TOPE_SALIENTE, ys1 + c + 0.1, zm - 1.5, zm + 1.5)]
nud = [U(casco(cil("y", (xa_, za_), R, a_, b_), B(xf - 2 * R, xf, a_, b_, Zt - 0.5, Zt + 0.5)),
         B(xa_, xf, a_, b_, Zt, za_ + R)) for a_, b_ in n_marco]
marco = D(U(marco, *topes, *dientes, *nud), cil("y", (xa_, za_), PASADOR_D / 2 + 0.2, Yo0 - 1, Yo1 + 1))

# ---- tapa frontal con bisagra y cierre a presion ----
g, tl = 0.2, 3.0
tapa = B(xf + g, xf + g + tl, Yo0 - 1.8, Yo1 + 1.8, Zb, Zt)
brazos = [U(cil("y", (xa_, za_), R, a_, b_), B(xa_, xf + g + tl, a_, b_, za_ - R, za_ + R),
            B(xf + g, xf + g + tl, a_, b_, Zt - 1, za_ + R)) for a_, b_ in n_tapa]
pest = []
for yi, sg in [(Yo0 - g, -1), (Yo1 + g, 1)]:
    pest += [B(xf - 16, xf + g + 0.1, *sorted([yi, yi + sg * 1.6]), zl0, zl1), cil("z", (cierre_x, yi + sg * 0.2), 0.8, zl0, zl1)]
tapa = D(U(tapa, *brazos, *pest), cil("y", (xa_, za_), PASADOR_D / 2 + 0.25, Yo0 - 1, Yo1 + 1))

# ---- pasador (se imprime acostado; cara plana abajo, cabeza y tramo conico a presion) ----
r = PASADOR_D / 2
pas = U(cil("y", (xa_, za_), r, Yo0, Yo1), cil("y", (xa_, za_), r + 1.0, Yo0 - 1.5, Yo0),
        casco(cil("y", (xa_, za_), r + 0.3, Yo0, Yo0 + 0.5), cil("y", (xa_, za_), r, Yo0 + 5, Yo0 + 5.5)))
pasador = D(pas, B(xa_ - 5, xa_ + 5, Yo0 - 3, Yo1 + 1, za_ - 5, za_ - r + 0.35))

# ---- paneles de MDF ----
tabs = [(L * f - PESTANA / 2, L * f + PESTANA / 2) for f in (0.17, 0.5, 0.8)]
p_tapa = box(0, Y0, L, Y1)
for a_, b_ in tabs:
    p_tapa = p_tapa.difference(box(a_, ys0, b_, -j)).difference(box(a_, h + j, b_, ys1))
for yt in TR_Y:
    p_tapa = p_tapa.difference(box(17.85, yt - 4.4, 22, yt + 4.4)).difference(box(L - 22, yt - 4.4, L - 17.85, yt + 4.4))
p_tapa = p_tapa.difference(box(vx0, yc - VENTANA[0] / 2, vx1, yc + VENTANA[0] / 2))
p_lat = box(0, 0, L, Hi)                               # coordenadas (x, z)
for a_, b_ in tabs:
    p_lat = p_lat.union(box(a_, -t, b_, 0.01)).union(box(a_, Hi - 0.01, b_, Hi + t))
p_lat = p_lat.difference(box(L - TOPE_LARGO - 0.5, zm - 1.7, L + 1, zm + 1.7)).buffer(0)

def m_tapa(z):
    return extruir(p_tapa, z, z + t)
def m_lat(y):
    m = trimesh.creation.extrude_polygon(p_lat, t)     # (x, z, espesor) -> (x, y, z)
    m.apply_transform(np.array([[1, 0, 0, 0], [0, 0, 1, y], [0, 1, 0, 0], [0, 0, 0, 1.0]])); m.fix_normals(); return m
mdf = [m_tapa(Z0), m_tapa(Hi), m_lat(ys0), m_lat(h + j)]

# ---- exporta STL en posicion de impresion ----
def girar(m, ang, eje, quitar_min=True):
    m = m.copy(); m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(ang), eje))
    m.apply_translation(-m.bounds[0]); return m
girar(trasera, 90, [0, 1, 0]).export(os.path.join(aqui, "tapa_trasera.stl"))      # placa sobre la cama
girar(marco, -90, [0, 1, 0]).export(os.path.join(aqui, "marco_frontal.stl"))       # cara frontal sobre la cama
girar(tapa, -90, [0, 1, 0]).export(os.path.join(aqui, "tapa_bisagra.stl"))         # cara exterior sobre la cama
girar(pasador, 0, [0, 0, 1]).export(os.path.join(aqui, "pasador.stl"))

# ---- plano de corte del MDF (1:1, mm) ----
def ruta_p(poly, ox, oy):
    d = ""
    for anillo in [poly.exterior] + list(poly.interiors):
        d += "M" + " L".join(f"{x + ox:.2f},{y + oy:.2f}" for x, y in anillo.coords) + " Z "
    return d
el, yy = [], 5.0
for nombre, poly, n in [("Tapa superior / base", p_tapa, 2), ("Lateral", p_lat, 2)]:
    bx0, by0, bx1, by1 = poly.bounds
    for i in range(n):
        el.append(f'<path d="{ruta_p(poly, 5 - bx0, yy - by0)}" stroke="red"/>')
        el.append(f'<text x="30" y="{yy + (by1 - by0) / 2 + 1.5:.2f}" font-size="4" fill="blue" stroke="none">'
                  f'{nombre} {bx1 - bx0:.1f} x {by1 - by0:.1f}</text>')
        yy += by1 - by0 + 5
    print(f"MDF {t:g} mm | {n} x {nombre}: {bx1 - bx0:.2f} x {by1 - by0:.2f} mm")
open(os.path.join(aqui, "caja_mdf.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{L + 10:.2f}mm" height="{yy:.2f}mm" '
    f'viewBox="0 0 {L + 10:.2f} {yy:.2f}" fill="none" stroke-width="0.2" font-family="sans-serif">' + "".join(el) + "</svg>")

recorrido = (L - TOPE_LARGO) - CANAL_INICIO
print(f"caja armada: {xf + g + tl + 2.5:.1f} x {Yo1 - Yo0 + 3.6:.1f} x {za_ + R - Zb:.1f} mm | la bandeja sale {recorrido:.0f} mm de {w:.0f}")
for n_, m in [("tapa trasera", trasera), ("marco frontal", marco), ("tapa con bisagra", tapa), ("pasador", pasador)]:
    print(f"{n_}: {' x '.join(f'{v:.1f}' for v in m.extents)} mm | estanca: {m.is_watertight}")
