"""Estuche tipo navaja suiza para la llave ajustable REDLINE de 8".

Sin pegamento ni tornillos; solo MDF cortado e impresion 3D:
  - 2 caras de MDF con la silueta de la llave + lomo + extremo (4 caras planas),
    unidas por pestanas y ranuras;
  - bandeja impresa con el vaciado de la llave, que gira hacia afuera como la
    hoja de una navaja;
  - bisagra impresa de nudillos y pasador en la esquina de la corona: una hoja
    fija apoyada en el lomo (dos nudillos) y un nudillo central en la bandeja;
  - 2 remaches impresos de un cuarto de vuelta que sujetan las caras; el de la
    corona es ademas el pasador de la bisagra;
  - 2 seguros impresos que impiden que los remaches se giren solos;
  - un fiador flexible en la punta de la bandeja que hace "clic" al cerrar.

El contorno (contorno_mm.json) viene de una foto escalada con la regla de la
mordaza (11,4 px/mm).  Ajusta los parametros y vuelve a ejecutar:
    pip install numpy shapely trimesh mapbox-earcut manifold3d
    python3 generar_navaja.py
"""
import json, os
import numpy as np
import trimesh
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import affinity

# ---- llave / vaciado ----
HOLGURA = 0.7              # mm de juego alrededor de la llave
ALTURA_HERRAMIENTA = 20.0  # mm, grosor maximo de la llave (mango). MEDIR Y AJUSTAR
BASE = 2.0                 # mm de piso bajo la llave
PARED = 4.0                # mm de pared alrededor del vaciado
PARED_LOMO = 5.5           # mm de pared hacia el lomo (deja sitio a la hoja de la bisagra)
PARED_PUNTA = 6.0          # mm de pared en la punta (aloja el fiador)
DEDO_ANCHO = 24.0          # mm, ancho de la ranura para sacar la llave
DEDO_POS = 0.60            # posicion de la ranura (0 = corona, 1 = mordaza)
# ---- MDF ----
ESPESOR_MDF = 3.0          # mm
JUEGO_Z = 0.25             # mm de juego entre bandeja y cada cara
JUEGO_LOMO = 0.5           # mm entre bandeja y lomo
JUEGO_PUNTA = 0.6          # mm entre bandeja y extremo
MARGEN = 3.0               # mm de MDF por fuera de las ranuras
PESTANA = 16.0             # mm, largo de las pestanas
# ---- remaches / eje ----
EJE_D = 10.0               # mm, diametro del cuerpo del remache (eje de giro)
CUELLO_D = 6.2             # mm, cuello que atraviesa el MDF
ALA = (11.0, 4.0, 3.0)     # mm, largo x ancho x alto de la cabeza
# ---- bisagra ----
NUDILLO_R = 8.0            # mm, radio exterior de los nudillos
HOJA = (40.0, 2.2)         # mm, largo y espesor de la hoja fija
NUDILLO_Z = (5.75, 16.25)  # mm, entre estas alturas va el nudillo de la bandeja
# ---- fiador ----
FIADOR_LARGO = 18.0        # mm, largo de la lamina flexible
FIADOR_SALIENTE = 1.3      # mm que sobresale el resalte

aqui = os.path.dirname(os.path.abspath(__file__))
herr = Polygon(np.array(json.load(open(os.path.join(aqui, "contorno_mm.json"))))).buffer(0)
vaciado = herr.buffer(0.8).buffer(-0.8).simplify(0.05).buffer(HOLGURA, resolution=16)
alto = BASE + ALTURA_HERRAMIENTA
t = ESPESOR_MDF
vx0, vy0, vx1, vy1 = vaciado.bounds

# ---------------- contorno de la bandeja (2D) ----------------
T0 = vaciado.buffer(PARED, resolution=16)
yb = vy0 - PARED_LOMO                                  # borde recto de la bandeja (lado del lomo)
ur = vx1 + PARED_PUNTA                            # cara plana de la punta
rho = NUDILLO_R                                   # radio del nudillo alrededor del eje
y_lomo = yb - JUEGO_LOMO                          # cara interior del lomo
for up in np.arange(15, -30, -0.25):              # eje lo mas cerca posible de la corona
    P = np.array([up, y_lomo + HOJA[1] + 0.4 + rho])
    if vaciado.distance(Point(P)) >= rho + 0.4 + 1.3:
        break
def envolvente(u):
    g = T0.intersection(LineString([(u, -100), (u, 200)]))
    return g.bounds[3] if not g.is_empty else yb
uc = vx1 - 2
v_plano = envolvente(uc)
us = np.arange(P[0], uc, 0.25)
cuerpo = Polygon([(P[0], yb)] + [(u, envolvente(u)) for u in us] + [(ur, v_plano), (ur, yb)])
talon = Point(P).buffer(rho, resolution=32)
silueta = unary_union([cuerpo, T0.intersection(box(-50, -50, P[0] + 1, 200)), talon])
silueta = silueta.buffer(1).buffer(-3).buffer(2)   # cierra rendijas y redondea esquinas

C2 = np.array([ur + JUEGO_PUNTA - EJE_D / 2 - 0.2, yb - JUEGO_LOMO + EJE_D / 2 + 0.2])   # remache de la esquina
rn = EJE_D / 2 + 0.7
muesca = unary_union([Point(C2).buffer(rn, resolution=32), box(C2[0] - rn, yb - 2, ur + 2, C2[1]),
                      box(C2[0], yb - 2, ur + 2, C2[1] + rn)])
vs0 = C2[1] + rn - 0.5                             # lamina del fiador: libre abajo, empotrada arriba
vs1 = vs0 + FIADOR_LARGO
ranura_fiador = box(ur - 2.8, vs0, ur - 1.6, vs1)
v_res = vs0 + 3.0                                  # altura (en v) del resalte del fiador
assert v_plano > vs1 + 3 and vaciado.distance(muesca) > 2 and vaciado.distance(ranura_fiador) > 1.5
bandeja2d = silueta.difference(unary_union([Point(P).buffer(EJE_D / 2 + 0.25, resolution=32), muesca, ranura_fiador]))

ud = vx0 + DEDO_POS * (vx1 - vx0); r = DEDO_ANCHO / 2
loc = vaciado.intersection(box(ud - r, -100, ud + r, 200)).bounds
dedo = unary_union([box(ud - r, loc[1] - 4, ud + r, 200), Point(ud, loc[1] - 4).buffer(r, resolution=16)])
dedo = dedo.intersection(box(-100, yb + 3, 500, 200))
corte = vaciado.union(dedo)

def extruir(poly, z0, z1):
    m = trimesh.creation.extrude_polygon(poly, z1 - z0); m.apply_translation([0, 0, z0]); return m
def B(xa, xb, ya, yb_, za, zb):
    m = trimesh.creation.box([xb - xa, yb_ - ya, zb - za])
    m.apply_translation([(xa + xb) / 2, (ya + yb_) / 2, (za + zb) / 2]); return m
def U(*ms): return trimesh.boolean.union(list(ms), engine="manifold")
def D(a, *ms): return trimesh.boolean.difference([a, U(*ms) if len(ms) > 1 else ms[0]], engine="manifold")
def cil(x, y, r_, za, zb):
    m = trimesh.creation.cylinder(radius=r_, height=zb - za, sections=48); m.apply_translation([x, y, (za + zb) / 2]); return m

resalte = cil(ur, v_res, FIADOR_SALIENTE, 0, 16)
bandeja = U(D(extruir(bandeja2d, 0, alto), extruir(corte, BASE, alto + 1)), D(resalte, B(ur - 5, ur - 0.5, v_res - 3, v_res + 3, -1, 17)))

# ---------------- MDF: caras, lomo y extremo ----------------
zi0, zi1 = -JUEGO_Z, alto + JUEGO_Z               # caras interiores de las dos tapas
x_ext = ur + JUEGO_PUNTA                          # cara interior del extremo
def abre(ang, poly=None):
    return affinity.rotate(silueta if poly is None else poly, ang, origin=tuple(P))
def lomo_desde(u_ini): return box(u_ini, y_lomo - t, x_ext + t, y_lomo)
extremo2d = box(x_ext, y_lomo, x_ext + t, v_plano)
# bisagra: hoja fija contra el lomo, con dos nudillos (arriba y abajo) unidos por un refuerzo
def bisagra2d(u_ini):
    hoja = box(u_ini, y_lomo, u_ini + HOJA[0], y_lomo + HOJA[1])
    ref = unary_union([Point(P).buffer(rho, resolution=32), box(u_ini, y_lomo, u_ini + 12, y_lomo + HOJA[1])]).convex_hull
    ref = unary_union([ref.intersection(box(u_ini, -100, 500, 200)), Point(P).buffer(rho, resolution=32)])
    return hoja, ref
def bandejas2d(u_ini):                             # contorno de la bandeja en el tramo central y en los extremos
    hoja, ref = bisagra2d(u_ini)
    centro = silueta.difference(hoja.buffer(0.4, join_style=2))
    return centro, centro.difference(ref.buffer(0.4))
def choca(u_ini, ang):
    hoja, ref = bisagra2d(u_ini); centro, extremos = bandejas2d(u_ini)
    fijo = unary_union([lomo_desde(u_ini), hoja])
    return abre(ang, centro).intersection(fijo).area + abre(ang, extremos).intersection(fijo.union(ref)).area > 0.02
# el lomo y la hoja empiezan donde dejan abrir la bandeja al menos 170 grados
u_lomo = P[0] + 1
while choca(u_lomo, 170):
    u_lomo += 0.5
lomo2d = lomo_desde(u_lomo)
hoja2d, ref2d = bisagra2d(u_lomo)
b_centro, b_extremos = bandejas2d(u_lomo)
assert vaciado.distance(ref2d) > 1.2 and not choca(u_lomo, 0)
ang_max = next(a for a in np.arange(150, 360, 0.5) if choca(u_lomo, a))
zc0, zc1 = NUDILLO_Z
bandeja = D(bandeja, D(extruir(silueta.buffer(1), -1, alto + 1), U(extruir(b_centro, zc0 + 0.15, zc1 - 0.15),
            extruir(b_extremos, -2, zc0 + 0.15), extruir(b_extremos, zc1 - 0.15, alto + 2))))
agujero = cil(P[0], P[1], EJE_D / 2 + 0.15, zi0 - 1, zi1 + 1)
tab_h = (u_lomo + 3, u_lomo + 13)                  # pestanas de la hoja hacia las caras
bisagra = D(U(extruir(hoja2d, zi0, zi1), extruir(ref2d, zi0, zc0 - 0.15), extruir(ref2d, zc1 + 0.15, zi1),
              B(*tab_h, y_lomo, y_lomo + HOJA[1], zi0 - t, zi1 + t)), agujero)

cara = unary_union([silueta, Point(P).buffer(rho + 2.5, resolution=32),
                    box(u_lomo - MARGEN, y_lomo - t - MARGEN, x_ext + t + MARGEN, yb + 3),
                    box(ur - 3, y_lomo - t - MARGEN, x_ext + t + MARGEN, v_plano + MARGEN)])
cara = cara.buffer(2).buffer(-4).buffer(2)
def cerradura(c, a_lo_largo_de_u):                 # agujero redondo con dos orejas para el remache
    o = box(-ALA[0] / 2 - 0.3, -ALA[1] / 2 - 0.2, ALA[0] / 2 + 0.3, ALA[1] / 2 + 0.2)
    if not a_lo_largo_de_u: o = affinity.rotate(o, 90, origin=(0, 0))
    return affinity.translate(Point(0, 0).buffer(CUELLO_D / 2 + 0.1, resolution=32).union(o), *c)
largo_l = C2[0] - 9 - u_lomo
tabs_l = [(u_lomo + f * largo_l - PESTANA / 2, u_lomo + f * largo_l + PESTANA / 2) for f in (0.12, 0.5, 0.88)]
vt = (v_res + 4 + v_plano) / 2
tabs_e = [(vt - 6, vt + 6)]
assert tabs_e[0][0] > v_res + 3
pulgar = Point(145, envolvente(145) + 3).buffer(10, resolution=32)   # rebaje para empujar la bandeja
cara = cara.difference(unary_union(
    [cerradura(P, True), cerradura(C2, False), pulgar] +
    [box(a, y_lomo - t, b, y_lomo) for a, b in tabs_l] + [box(tab_h[0] - 0.1, y_lomo, tab_h[1] + 0.1, y_lomo + HOJA[1] + 0.15)] + [box(x_ext, a, x_ext + t, b) for a, b in tabs_e]))

def tira(largo, tabs, o, muescas=()):              # tira con pestanas arriba y abajo, coords (s, z)
    p = box(0, zi0, largo, zi1)
    for a, b in tabs:
        p = p.union(box(a - o, zi0 - t, b - o, zi0 + 0.01)).union(box(a - o, zi1 - 0.01, b - o, zi1 + t))
    for a, b, z in muescas:
        p = p.difference(box(a - o, zi0 - 1, b - o, z))
    return p.buffer(0)
p_lomo = tira(x_ext + t - u_lomo, tabs_l, u_lomo)
p_ext = tira(v_plano - y_lomo, tabs_e, y_lomo, [(v_res - 1.4, v_res + 1.4, 17.0)])
def a3d(p, M):
    m = trimesh.creation.extrude_polygon(p, t); m.apply_transform(np.array(M, float)); m.fix_normals(); return m
m_lomo = a3d(p_lomo, [[1, 0, 0, u_lomo], [0, 0, 1, y_lomo - t], [0, 1, 0, 0], [0, 0, 0, 1]])
m_ext = a3d(p_ext, [[0, 0, 1, x_ext], [1, 0, 0, y_lomo], [0, 1, 0, 0], [0, 0, 0, 1]])
m_caras = [extruir(cara, zi0 - t, zi0), extruir(cara, zi1, zi1 + t)]

# ---------------- remache de 1/4 de vuelta y seguro ----------------
def remache(c, alas_en_u):
    ln = t + 0.2
    partes = [cil(0, 0, EJE_D / 2, zi0, zi1), cil(0, 0, CUELLO_D / 2, zi0 - ln - ALA[2], zi1 + ln + ALA[2])]
    for za in (zi0 - ln - ALA[2], zi1 + ln):
        partes.append(B(-ALA[0] / 2, ALA[0] / 2, -ALA[1] / 2, ALA[1] / 2, za, za + ALA[2]))
    m = D(U(*partes), B(-20, 20, -20, -ALA[1] / 2, zi0 - 20, zi1 + 20))   # cara plana para imprimir acostado
    if not alas_en_u: m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1]))
    m.apply_translation([c[0], c[1], 0]); return m
def seguro(c, alas_en_u):                          # tapa con patas: entra en las orejas y bloquea el giro
    z0 = zi1 + t
    disco = D(cil(0, 0, 7.5, z0 + 0.2, z0 + 0.2 + ALA[2]),
              B(-ALA[0] / 2 - 0.2, ALA[0] / 2 + 0.2, -ALA[1] / 2 - 0.2, ALA[1] / 2 + 0.2, z0, z0 + 5), cil(0, 0, CUELLO_D / 2 + 0.2, z0, z0 + 5))
    patas = [B(-2.2, 2.2, sg * (CUELLO_D / 2 + 0.25), sg * (ALA[0] / 2 + 0.2), z0 - t, z0 + 0.3) for sg in (1, -1)]
    patas = [B(-2.2, 2.2, *sorted([sg * (CUELLO_D / 2 + 0.25), sg * (ALA[0] / 2 + 0.2)]), z0 - t, z0 + 0.3) for sg in (1, -1)]
    m = U(disco, *patas)
    if not alas_en_u: m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1]))
    m.apply_translation([c[0], c[1], 0]); return m
# orejas del MDF a lo largo de u en el eje y de v en la esquina; las alas quedan cruzadas (trabadas)
rem = [remache(P, False), remache(C2, True)]
seg = [seguro(P, False), seguro(C2, True)]

# ---------------- exportacion ----------------
def girar(m, ang, eje):
    m = m.copy(); m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(ang), eje))
    m.apply_translation(-m.bounds[0]); return m
girar(bandeja, 0, [0, 0, 1]).export(os.path.join(aqui, "bandeja_navaja.stl"))
girar(bisagra, 90, [1, 0, 0]).export(os.path.join(aqui, "bisagra_fija.stl"))   # acostada sobre el dorso de la hoja
girar(remache((0, 0), True), 90, [1, 0, 0]).export(os.path.join(aqui, "remache_x2.stl"))
girar(seguro((0, 0), True), 180, [1, 0, 0]).export(os.path.join(aqui, "seguro_x2.stl"))

def ruta(poly, ox, oy, sy=1):
    d = ""
    for an in [poly.exterior] + list(poly.interiors):
        d += "M" + " L".join(f"{x + ox:.2f},{sy * y + oy:.2f}" for x, y in an.coords) + " Z "
    return d
el, yy, wmax = [], 5.0, 0
for nombre, poly, n in [("Cara (silueta)", cara, 2), ("Lomo", p_lomo, 1), ("Extremo", p_ext, 1)]:
    bx0, by0, bx1, by1 = poly.bounds
    for i in range(n):
        el.append(f'<path d="{ruta(poly, 5 - bx0, yy + by1, -1)}" stroke="red"/>')
        yy += by1 - by0 + 5
    wmax = max(wmax, bx1 - bx0 + 10)
    print(f"MDF {t:g} mm | {n} x {nombre}: {bx1 - bx0:.1f} x {by1 - by0:.1f} mm")
open(os.path.join(aqui, "caja_mdf_navaja.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{wmax:.2f}mm" height="{yy:.2f}mm" viewBox="0 0 {wmax:.2f} {yy:.2f}" '
    f'fill="none" stroke-width="0.2">' + "".join(el) + "</svg>")
cb = cara.bounds
print(f"llave: {herr.bounds[2]:.1f} x {herr.bounds[3]:.1f} mm")
print(f"estuche cerrado: {cb[2] - cb[0]:.1f} x {cb[3] - cb[1]:.1f} x {alto + 2 * JUEGO_Z + 2 * t:.1f} mm (+ cabezas de remache)")
print(f"bandeja: {' x '.join(f'{v:.1f}' for v in bandeja.extents)} mm | estanca: {bandeja.is_watertight} | {bandeja.volume / 1000:.0f} cm3")
print(f"bisagra fija: {' x '.join(f'{v:.1f}' for v in bisagra.extents)} mm | estanca: {bisagra.is_watertight}")
print(f"remache estanco: {rem[0].is_watertight} | seguro estanco: {seg[0].is_watertight} | apertura maxima: {ang_max:.0f} grados")

# =====================================================================
#  PIEZAS DE PRUEBA (carpeta pruebas/): rapidas de imprimir y cortar,
#  para ajustar holguras antes de fabricar el estuche completo
# =====================================================================
pr = os.path.join(aqui, "pruebas"); os.makedirs(pr, exist_ok=True)
def recorte(m, poly, z0=-5, z1=alto + 5):
    r_ = trimesh.boolean.intersection([m, extruir(poly, z0, z1)], engine="manifold"); r_.apply_translation(-r_.bounds[0]); return r_
# 1) calce de la llave: solo el contorno del vaciado, 3 mm de alto
p1 = D(extruir(vaciado.buffer(2.5), 0, 3.0), extruir(vaciado, 0.6, 4.0)); p1.apply_translation(-p1.bounds[0])
p1.export(os.path.join(pr, "1_calce_llave.stl"))
# 2) bisagra: trozo de la bandeja alrededor del eje (se prueba con bisagra_fija + remache)
recorte(bandeja, Point(P).buffer(26, resolution=32)).export(os.path.join(pr, "2_bisagra_trozo_bandeja.stl"))
# 3) fiador: punta de la bandeja con la lamina flexible (se prueba contra el Extremo de MDF)
recorte(bandeja, box(ur - 30, yb - 1, ur + 3, vs1 + 7)).export(os.path.join(pr, "3_fiador_punta_bandeja.stl"))

# 4) MDF: mini estuche (2 caras + lomo corto) para probar remache, seguro, pestanas y hoja de bisagra,
#    recortado de la esquina real de la bisagra, y un calibre con tres holguras de cada encaje
def cerr(dx, c): return affinity.translate(cerradura((0, 0), True).buffer(dx, join_style=2), *c)
u_fin = max(tabs_l[0][1] + 6, P[0] + 34)             # esquina real de la bisagra, recortada
mini = cara.intersection(box(P[0] - 20, y_lomo - t - MARGEN - 5, u_fin, P[1] + 24))
mini_lomo = tira(u_fin - u_lomo, [tabs_l[0]], u_lomo)
dxs = (-0.1, 0.0, 0.1)
cal = box(0, 0, 100, 40)
for i, dx in enumerate(dxs):
    cal = cal.difference(cerr(dx, (17 + 33 * i, 27)))
    cal = cal.difference(box(8.5 + 33 * i - dx, 6 - dx, 8.5 + 33 * i + PESTANA + dx, 6 + t + dx))
# 5) calibre impreso (placa de 3 mm que imita al MDF): para probar remache y seguro sin cortar MDF,
#    y tres diametros de agujero para el cuerpo del remache (el eje de la bisagra)
cal5 = cal
for i, dd in enumerate((0.1, 0.15, 0.25)):
    cal5 = cal5.difference(Point(17 + 33 * i, 12).buffer(EJE_D / 2 + dd, resolution=48))
m5 = extruir(cal5.difference(unary_union([box(8.5 + 33 * i - 0.2, 5.8, 8.5 + 33 * i + PESTANA + 0.2, 6.2 + t) for i in range(3)])), 0, t)
marcas = [B(6 + 33 * i, 6 + 33 * i + 1.2 * (i + 1), 37, 41, t - 0.6, t + 1) for i in range(3)]   # 1, 2 y 3 muescas = -0,1 / 0 / +0,1
D(m5, *marcas).export(os.path.join(pr, "5_calibre_remache_impreso.stl"))
el, yy = [], 5.0
def pon(poly, etiqueta, marcas=()):
    global yy
    bx0, by0, bx1, by1 = poly.bounds
    el.append(f'<path d="{ruta(poly, 5 - bx0, yy + by1, -1)}" stroke="red"/>')
    el.append(f'<text x="{bx1 - bx0 + 9:.1f}" y="{yy + 6:.1f}" font-size="3.5" fill="blue" stroke="none">{etiqueta}</text>')
    for mx, my, txt in marcas:
        el.append(f'<text x="{5 + mx:.1f}" y="{yy + by1 - my:.1f}" font-size="3" fill="blue" stroke="none" text-anchor="middle">{txt}</text>')
    yy += by1 - by0 + 5
pon(mini, "esquina de la bisagra (x2)"); pon(mini, "")
pon(mini_lomo, "lomo corto")
pon(cal, "calibre de holguras (mm por lado)", [(17 + 33 * i, 16, f"{dx:+.1f}") for i, dx in enumerate(dxs)])
pon(p_ext, "extremo real (prueba del fiador)")
open(os.path.join(pr, "4_pruebas_mdf.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="170mm" height="{yy:.2f}mm" viewBox="0 0 170 {yy:.2f}" '
    f'fill="none" stroke-width="0.2" font-family="sans-serif">' + "".join(el) + "</svg>")
print("piezas de prueba en pruebas/")
