"""Estuche tipo navaja suiza para la llave ajustable REDLINE de 8".

Sin pegamento ni tornillos; solo MDF cortado e impresion 3D:
  - 2 caras de MDF con la silueta de la llave + lomo + extremo (4 caras planas),
    unidas por pestanas y ranuras;
  - bandeja impresa con el vaciado de la llave, que gira hacia afuera como la
    hoja de una navaja;
  - la bandeja gira sobre el pasador de la esquina de la corona (opcional: hoja fija
    impresa con dos nudillos, CON_BISAGRA_FIJA = True);
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
LARGO_MEDIDO = None        # mm, largo total real de la llave (None = usar LARGO_ESTIMADO)
ANCHO_MEDIDO = None        # mm, ancho maximo real, en la mordaza (None = usar ANCHO_ESTIMADO)
CON_VACIADO = False        # False = bandeja maciza (el vaciado se hace despues, con la llave bien medida); True = con vaciado
HOLGURA = 1.0              # mm de juego alrededor de la llave (ajuste fino, solo afecta a la bandeja impresa)
ALTURA_HERRAMIENTA = 20.0  # mm, grosor maximo de la llave (ajuste fino: fija la profundidad del vaciado)
# ---- caja de corte: estas medidas NO deben cambiar despues de cortar ----
LARGO_ESTIMADO = 207.0     # mm: el calcado de la foto (200,0) quedo unos 5 mm corto, mas holgura
ANCHO_ESTIMADO = 53.0      # mm: el calcado (49,9) quedo unos 3 mm angosto
MARGEN_CAJA = 4.0          # mm de margen alrededor del calcado de la foto con que se dimensiona la caja
ALTURA_MAX = 24.0          # mm, grosor maximo de llave que admite la caja (fija el alto de lomo y extremo)
BASE = 2.0                 # mm de piso minimo bajo la llave
PARED = 4.0                # mm de pared alrededor del vaciado
PARED_LOMO = 5.5           # mm de pared hacia el lomo (deja sitio a la hoja de la bisagra)
PARED_PUNTA = 6.0          # mm de pared en la punta (aloja el fiador)
DEDO_ANCHO = 24.0          # mm, ancho de la ranura para sacar la llave
DEDO_POS = 0.60            # posicion de la ranura (0 = corona, 1 = mordaza)
# ---- forma de la tapa y labio para abrir ----
RADIO_ESTETICO = 250.0     # mm: las entradas del contorno se rellenan con arcos de este radio (curva limpia)
RADIO_ESQUINA = 7.0        # mm: redondeo de las esquinas de la tapa
LABIO = (5.0, 55.0, 0.62)  # mm que asoma la bandeja sobre la tapa, largo del labio y posicion (0 = corona, 1 = mordaza)
UNERO = (1.8, 1.5)         # mm, ancho y profundidad de la ranura del labio (por las dos caras)
# ---- material de corte (MDF o acrilico) ----
ESPESOR_MDF = 3.0          # mm, espesor de la plancha
JUEGO_Z = 0.25             # mm de juego entre bandeja y cada cara
JUEGO_LOMO = 0.5           # mm entre bandeja y lomo
JUEGO_PUNTA = 0.6          # mm entre bandeja y extremo
MARGEN = 3.0               # mm de MDF por fuera de las ranuras
PESTANA = 16.0             # mm, largo de las pestanas
RANURA_EXTRA = (0.1, 0.0)  # mm que se agregan al ancho y al largo de las ranuras (segun la prueba de ranuras)
CERRADURA_EXTRA = 0.0      # mm por lado que se agregan a los agujeros de los pasadores
# ---- remaches / eje ----
EJE_D = 10.0               # mm, diametro del cuerpo del remache (eje de giro)
CUELLO_D = 6.2             # mm, cuello que atraviesa el MDF
ALA = (11.0, 4.0, 3.0)     # mm, largo x ancho x alto de la cabeza
# ---- bisagra ----
CON_BISAGRA_FIJA = False   # True = agrega la hoja fija impresa con dos nudillos; False = la bandeja gira solo sobre el pasador
NUDILLO_R = 8.0            # mm, radio exterior de los nudillos
HOJA = (40.0, 2.2)         # mm, largo y espesor de la hoja fija
NUDILLO_FRAC = (0.26, 0.74) # el nudillo de la bandeja ocupa esta fraccion de la altura
# ---- fiador ----
FIADOR_LARGO = 18.0        # mm, largo de la lamina flexible
FIADOR_SALIENTE = 1.3      # mm que sobresale el resalte

aqui = os.path.dirname(os.path.abspath(__file__))
herr_foto = Polygon(np.array(json.load(open(os.path.join(aqui, "contorno_mm.json"))))).buffer(0)   # calcado de la foto
hb = herr_foto.bounds
def a_medida(largo, ancho):                        # el calcado estirado a un largo y ancho dados, desde su centro
    return affinity.scale(herr_foto, largo / hb[2], ancho / hb[3], origin=(hb[2] / 2, hb[3] / 2))
herr = a_medida(LARGO_MEDIDO or LARGO_ESTIMADO, ANCHO_MEDIDO or ANCHO_ESTIMADO)     # la llave (ajuste fino)
suave = lambda p: p.buffer(0.8).buffer(-0.8).simplify(0.05)
vaciado = suave(herr).buffer(HOLGURA, resolution=16)             # vaciado real de la bandeja (ajuste fino)
caja_ref = suave(a_medida(LARGO_ESTIMADO, ANCHO_ESTIMADO)).buffer(MARGEN_CAJA, resolution=16)   # contorno con margen que dimensiona la caja (fijo)
alto = BASE + ALTURA_MAX                          # espesor de la bandeja = hueco entre las dos caras
PISO = alto - ALTURA_HERRAMIENTA                  # altura del piso del vaciado (la llave queda a ras por arriba)
assert PISO >= BASE - 1e-9, "La llave es mas gruesa que ALTURA_MAX: no cabe en la caja."
NUDILLO_Z = (round(alto * NUDILLO_FRAC[0], 2), round(alto * NUDILLO_FRAC[1], 2))
t = ESPESOR_MDF
vx0, vy0, vx1, vy1 = caja_ref.bounds

# ---------------- contorno de la bandeja (2D) ----------------
T0 = caja_ref.buffer(PARED, resolution=16)
yb = vy0 - (PARED_LOMO if CON_BISAGRA_FIJA else PARED)                                  # borde recto de la bandeja (lado del lomo)
ur = vx1 + PARED_PUNTA                            # cara plana de la punta
rho = NUDILLO_R                                   # radio del nudillo alrededor del eje
y_lomo = yb - JUEGO_LOMO                          # cara interior del lomo
for up in np.arange(15, -30, -0.25):              # eje lo mas cerca posible de la corona
    P = np.array([up, y_lomo + (HOJA[1] + 0.4 if CON_BISAGRA_FIJA else JUEGO_LOMO) + rho])
    if caja_ref.distance(Point(P)) >= rho + 0.4 + 1.3:
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
# forma estetica: en vez de seguir el calcado, las entradas se rellenan con arcos amplios y se redondean las esquinas
silueta_func = silueta
silueta_cara = silueta_func.buffer(RADIO_ESTETICO, resolution=64).buffer(-RADIO_ESTETICO, resolution=64)
silueta_cara = silueta_cara.buffer(-RADIO_ESQUINA).buffer(RADIO_ESQUINA, resolution=32).simplify(0.02)
# labio de la bandeja: asoma sobre la tapa para abrirla con los dedos, con una ranura (unero) por cada cara
ua = vx0 + LABIO[2] * (vx1 - vx0) - LABIO[1] / 2; ub = ua + LABIO[1]
zona_labio = box(ua, yb + 15, ub, 400)
labio = silueta_cara.buffer(LABIO[0], resolution=32).intersection(zona_labio)
silueta = unary_union([silueta_cara, labio]).buffer(4).buffer(-8).buffer(4, resolution=32).simplify(0.02)
def borde_cara(u):                                 # altura del borde de la tapa en la abscisa u
    return silueta_cara.intersection(LineString([(u, -100), (u, 400)])).bounds[3]
e0, e1 = np.array([ua + 13, borde_cara(ua + 13)]), np.array([ub - 13, borde_cara(ub - 13)])
nrm = np.array([-(e1 - e0)[1], (e1 - e0)[0]]) / np.hypot(*(e1 - e0))
unero2d = LineString([e0 + nrm * LABIO[0] * 0.5, e1 + nrm * LABIO[0] * 0.5]).buffer(UNERO[0] / 2, resolution=16)   # ranura recta de extremos redondos

C2 = np.array([ur + JUEGO_PUNTA - EJE_D / 2 - 0.2, yb - JUEGO_LOMO + EJE_D / 2 + 0.2])   # remache de la esquina
rn = EJE_D / 2 + 0.7
muesca = unary_union([Point(C2).buffer(rn, resolution=32), box(C2[0] - rn, yb - 2, ur + 2, C2[1]),
                      box(C2[0], yb - 2, ur + 2, C2[1] + rn)])
vs0 = C2[1] + rn - 0.5                             # lamina del fiador: libre abajo, empotrada arriba
vs1 = vs0 + FIADOR_LARGO
ranura_fiador = box(ur - 2.8, vs0, ur - 1.6, vs1)
v_res = vs0 + 3.0                                  # altura (en v) del resalte del fiador
assert v_plano > vs1 + 3 and caja_ref.distance(muesca) > 2 and caja_ref.distance(ranura_fiador) > 1.5
bandeja2d = silueta.difference(unary_union([Point(P).buffer(EJE_D / 2 + 0.25, resolution=32), muesca, ranura_fiador]))

ud = vx0 + DEDO_POS * (vx1 - vx0); r = DEDO_ANCHO / 2
loc = vaciado.intersection(box(ud - r, -100, ud + r, 200)).bounds
dedo = unary_union([box(ud - r, loc[1] - 4, ud + r, 200), Point(ud, loc[1] - 4).buffer(r, resolution=16)])
dedo = dedo.intersection(box(-100, yb + 3, 500, 200)).intersection(silueta_cara.buffer(-3.5))   # no rompe la pared exterior
corte = vaciado.union(dedo)
sobra = vaciado.difference(silueta.buffer(-2.0)).area
assert sobra < 0.01 or not CON_VACIADO, "La llave medida no cabe en la caja ya cortada con 2 mm de pared: revisa las medidas o aumenta MARGEN_CAJA."

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
bandeja = D(extruir(bandeja2d, 0, alto), *([extruir(corte, PISO, alto + 1)] if CON_VACIADO else []), extruir(unero2d, -1, UNERO[1]), extruir(unero2d, alto - UNERO[1], alto + 1))

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
    if not CON_BISAGRA_FIJA: return silueta, silueta
    hoja, ref = bisagra2d(u_ini)
    centro = silueta.difference(hoja.buffer(0.4, join_style=2))
    return centro, centro.difference(ref.buffer(0.4))
def choca(u_ini, ang):
    hoja, ref = bisagra2d(u_ini); centro, extremos = bandejas2d(u_ini)
    if not CON_BISAGRA_FIJA: return abre(ang, silueta).intersection(lomo_desde(u_ini)).area > 0.02
    fijo = unary_union([lomo_desde(u_ini), hoja])
    return abre(ang, centro).intersection(fijo).area + abre(ang, extremos).intersection(fijo.union(ref)).area > 0.02
# el lomo y la hoja empiezan donde dejan abrir la bandeja al menos 170 grados
u_lomo = P[0] + 1
while choca(u_lomo, 170):
    u_lomo += 0.5
lomo2d = lomo_desde(u_lomo)
hoja2d, ref2d = bisagra2d(u_lomo)
b_centro, b_extremos = bandejas2d(u_lomo)
assert (not CON_BISAGRA_FIJA or caja_ref.distance(ref2d) > 1.2) and not choca(u_lomo, 0)
ang_max = next(a for a in np.arange(150, 360, 0.5) if choca(u_lomo, a))
zc0, zc1 = NUDILLO_Z
if CON_BISAGRA_FIJA:
    bandeja = D(bandeja, D(extruir(silueta.buffer(1), -1, alto + 1), U(extruir(b_centro, zc0 + 0.15, zc1 - 0.15),
                extruir(b_extremos, -2, zc0 + 0.15), extruir(b_extremos, zc1 - 0.15, alto + 2))))
bandeja = U(bandeja, D(resalte, B(ur - 5, ur - 0.5, v_res - 3, v_res + 3, -1, 17)))   # resalte del fiador
assert len(bandeja.split()) == 1
agujero = cil(P[0], P[1], EJE_D / 2 + 0.15, zi0 - 1, zi1 + 1)
tab_h = (u_lomo + 3, u_lomo + 13)                  # pestanas de la hoja hacia las caras
bisagra = D(U(extruir(hoja2d, zi0, zi1), extruir(ref2d, zi0, zc0 - 0.15), extruir(ref2d, zc1 + 0.15, zi1),
              B(*tab_h, y_lomo, y_lomo + HOJA[1], zi0 - t, zi1 + t)), agujero) if CON_BISAGRA_FIJA else None

cara = unary_union([silueta_cara, Point(P).buffer(rho + 2.5, resolution=32),
                    box(u_lomo - MARGEN, y_lomo - t - MARGEN, x_ext + t + MARGEN, yb + 3),
                    box(ur - 3, y_lomo - t - MARGEN, x_ext + t + MARGEN, v_plano + MARGEN)])
cara = cara.buffer(RADIO_ESTETICO, resolution=64).buffer(-RADIO_ESTETICO, resolution=64).buffer(-6).buffer(6, resolution=32).simplify(0.02)
def cerradura(c, a_lo_largo_de_u):                 # agujero redondo con dos orejas para el remache
    o = box(-ALA[0] / 2 - 0.3, -ALA[1] / 2 - 0.2, ALA[0] / 2 + 0.3, ALA[1] / 2 + 0.2)
    if not a_lo_largo_de_u: o = affinity.rotate(o, 90, origin=(0, 0))
    return affinity.translate(Point(0, 0).buffer(CUELLO_D / 2 + 0.1, resolution=32).union(o), *c)
largo_l = C2[0] - 9 - u_lomo
tabs_l = [(u_lomo + f * largo_l - PESTANA / 2, u_lomo + f * largo_l + PESTANA / 2) for f in (0.12, 0.5, 0.88)]
vt = (v_res + 4 + v_plano) / 2
tabs_e = [(vt - 6, vt + 6)]
assert tabs_e[0][0] > v_res + 3
pulgar = Point(75, envolvente(75) + 3).buffer(10, resolution=32)   # rebaje para empujar la bandeja
cara = cara.difference(unary_union(
    [cerradura(P, True).buffer(CERRADURA_EXTRA, join_style=2), cerradura(C2, False).buffer(CERRADURA_EXTRA, join_style=2)] +
    [box(a - RANURA_EXTRA[1] / 2, y_lomo - t - RANURA_EXTRA[0] / 2, b + RANURA_EXTRA[1] / 2, y_lomo + RANURA_EXTRA[0] / 2) for a, b in tabs_l] + ([box(tab_h[0] - 0.1, y_lomo, tab_h[1] + 0.1, y_lomo + HOJA[1] + 0.15)] if CON_BISAGRA_FIJA else []) + [box(x_ext - RANURA_EXTRA[0] / 2, a - RANURA_EXTRA[1] / 2, x_ext + t + RANURA_EXTRA[0] / 2, b + RANURA_EXTRA[1] / 2) for a, b in tabs_e]))

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
def remache(c, alas_en_u, extra=0.2, marcas=0):   # extra = holgura del cuello sobre el espesor del MDF
    ln = t + extra
    partes = [cil(0, 0, EJE_D / 2, zi0, zi1), cil(0, 0, CUELLO_D / 2, zi0 - ln - ALA[2], zi1 + ln + ALA[2])]
    for za in (zi0 - ln - ALA[2], zi1 + ln):
        partes.append(B(-ALA[0] / 2, ALA[0] / 2, -ALA[1] / 2, ALA[1] / 2, za, za + ALA[2]))
    cortes = [B(-20, 20, -20, -ALA[1] / 2, zi0 - 20, zi1 + 20)]              # cara plana para imprimir acostado
    for i in range(marcas):                                                  # anillos que identifican la variante
        z = alto / 2 - 3 + 2.4 * i
        cortes.append(D(cil(0, 0, EJE_D / 2 + 1, z, z + 0.8), cil(0, 0, EJE_D / 2 - 0.5, z - 1, z + 2)))
    m = D(U(*partes), *cortes)
    if not alas_en_u: m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1]))
    m.apply_translation([c[0], c[1], 0]); return m
def seguro(c, alas_en_u, pata=4.4, marcas=0):                          # tapa con patas: entra en las orejas y bloquea el giro
    z0 = zi1 + t
    disco = D(cil(0, 0, 7.5, z0 + 0.2, z0 + 0.2 + ALA[2]),
              B(-ALA[0] / 2 - 0.2, ALA[0] / 2 + 0.2, -ALA[1] / 2 - 0.2, ALA[1] / 2 + 0.2, z0, z0 + 5), cil(0, 0, CUELLO_D / 2 + 0.2, z0, z0 + 5))
    patas = [B(-2.2, 2.2, sg * (CUELLO_D / 2 + 0.25), sg * (ALA[0] / 2 + 0.2), z0 - t, z0 + 0.3) for sg in (1, -1)]
    patas = [B(-pata / 2, pata / 2, *sorted([sg * (CUELLO_D / 2 + 0.25), sg * (ALA[0] / 2 + 0.2)]), z0 - t, z0 + 0.3) for sg in (1, -1)]
    m = U(disco, *patas)
    if marcas:                                                               # muescas en el borde que identifican la variante
        m = D(m, *[cil(7.5 * np.cos(a_), 7.5 * np.sin(a_), 0.9, z0, z0 + 6) for a_ in np.radians(25 + 22 * np.arange(marcas))])
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
if CON_BISAGRA_FIJA: girar(bisagra, 90, [1, 0, 0]).export(os.path.join(aqui, "bisagra_fija.stl"))   # acostada sobre el dorso de la hoja
girar(remache((0, 0), True), 90, [1, 0, 0]).export(os.path.join(aqui, "remache_x2.stl"))
girar(seguro((0, 0), True), 180, [1, 0, 0]).export(os.path.join(aqui, "seguro_x2.stl"))

# diseno para grabar (score) sobre la tapa superior: la llave que va dentro, en su posicion real,
# con sus detalles tomados de la foto (corona, mango de goma, agujeros hexagonales y ventana del tornillo)
def _foto(geom): return affinity.scale(geom, LARGO_ESTIMADO / hb[2], ANCHO_ESTIMADO / hb[3], origin=(hb[2] / 2, hb[3] / 2))
def _hex(c, r): return Polygon([(c[0] + r * np.cos(a_), c[1] + r * np.sin(a_)) for a_ in np.radians(np.arange(0, 360, 60))])
_llave = suave(herr_foto)
_mango = _llave.intersection(box(23, -10, 109, 80))
DISENO = [_foto(x_) for x_ in [_llave, Point(12.6, 16.6).buffer(7.4, resolution=24), 
                               _mango.buffer(-1.2), _mango.buffer(-5.0), _hex((119.2, 21.8), 3.9), _hex((133.4, 22.6), 3.4),
                               Polygon([(144.5, 24.5), (158.5, 28.5), (160.5, 16.5), (147.5, 13.5)]).buffer(-0.01)]]
DISENO = [x_ for x_ in DISENO if not x_.is_empty and x_.geom_type == "Polygon"]
def ruta(poly, ox, oy, sy=1):
    d = ""
    for an in [poly.exterior] + list(poly.interiors):
        d += "M" + " L".join(f"{x + ox:.2f},{sy * y + oy:.2f}" for x, y in an.coords) + " Z "
    return d
el, yy, wmax = [], 5.0, 0
for nombre, poly, n in [("Cara (silueta)", cara, 2), ("Lomo", p_lomo, 1), ("Extremo", p_ext, 1)]:
    bx0, by0, bx1, by1 = poly.bounds
    for i in range(n):
        el.append(f'<path d="{ruta(poly, 5 - bx0, yy + by1, -1)}" stroke="black"/>')
        if poly is cara and i == 0:            # la tapa superior lleva el diseno grabado
            el += [f'<path d="{ruta(x_, 5 - bx0, yy + by1, -1)}" stroke="red"/>' for x_ in DISENO]
        yy += by1 - by0 + 5
    wmax = max(wmax, bx1 - bx0 + 10)
    print(f"Corte {t:g} mm | {n} x {nombre}: {bx1 - bx0:.1f} x {by1 - by0:.1f} mm")
open(os.path.join(aqui, "caja_corte_navaja.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{wmax:.2f}mm" height="{yy:.2f}mm" viewBox="0 0 {wmax:.2f} {yy:.2f}" '
    f'fill="none" stroke-width="0.1">' + "".join(el) + "</svg>")
cb = cara.bounds
print(f"llave: {herr.bounds[2] - herr.bounds[0]:.1f} x {herr.bounds[3] - herr.bounds[1]:.1f} x {ALTURA_HERRAMIENTA:g} mm | la caja admite hasta {ALTURA_MAX:g} mm de grosor")
print(f"estuche cerrado: {cb[2] - cb[0]:.1f} x {cb[3] - cb[1]:.1f} x {alto + 2 * JUEGO_Z + 2 * t:.1f} mm (+ cabezas de remache)")
print(f"bandeja: {' x '.join(f'{v:.1f}' for v in bandeja.extents)} mm | estanca: {bandeja.is_watertight} | {bandeja.volume / 1000:.0f} cm3")
if CON_BISAGRA_FIJA: print(f"bisagra fija: {' x '.join(f'{v:.1f}' for v in bisagra.extents)} mm | estanca: {bisagra.is_watertight}")
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
recorte(bandeja, Point(P).buffer(17, resolution=32)).export(os.path.join(pr, "2_bisagra_trozo_bandeja.stl"))
# 3) fiador: punta de la bandeja con la lamina flexible (se prueba contra el Extremo de MDF)
recorte(bandeja, box(ur - 14, yb - 1, ur + 3, vs1 + 7)).export(os.path.join(pr, "3_fiador_punta_bandeja.stl"))

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
# 9) set de pruebas de ranuras para la plancha de corte (acrilico): cada ranura con una medida distinta,
#    y una tira con pestanas reales para probarlas.  Lo que calce mejor se copia a RANURA_EXTRA y CERRADURA_EXTRA.
VAR_ANCHO = (-0.2, -0.1, 0.0, 0.1, 0.2, 0.3)     # se suma al ancho de la ranura (espesor de la plancha)
VAR_LARGO = (-0.2, -0.1, 0.0, 0.1, 0.2, 0.3)     # se suma al largo de la ranura (largo de la pestana)
VAR_CERR = (-0.1, 0.0, 0.1, 0.2)                 # por lado, en el agujero del pasador
paso_x = 25.0
placa9 = box(0, 0, 12 + paso_x * 6, 74); rot9 = []
for i, dv in enumerate(VAR_ANCHO):
    x_ = 8 + paso_x * i; placa9 = placa9.difference(box(x_, 58 - dv / 2, x_ + PESTANA, 58 + t + dv / 2)); rot9.append((x_ + 8, 67, f"ancho {t + dv:.1f}"))
for i, dv in enumerate(VAR_LARGO):
    x_ = 8 + paso_x * i; placa9 = placa9.difference(box(x_ - dv / 2, 38, x_ + PESTANA + dv / 2, 38 + t)); rot9.append((x_ + 8, 47, f"largo {PESTANA + dv:.1f}"))
for i, dv in enumerate(VAR_CERR):
    x_ = 20 + 38 * i; placa9 = placa9.difference(affinity.translate(cerradura((0, 0), True).buffer(dv, join_style=2), x_, 14)); rot9.append((x_, 26, f"pasador {dv:+.1f}"))
tira9 = box(0, 0, 60, 18).union(box(8, 17.99, 8 + PESTANA, 18 + t)).union(box(36, -t, 36 + PESTANA, 0.01)).buffer(0)
el9 = [f'<path d="{ruta(placa9, 5, 79, -1)}" stroke="black"/>', f'<path d="{ruta(tira9, 5, 79 + 8 + 18 + t, -1)}" stroke="black"/>',
       f'<path d="{ruta(tira9, 75, 79 + 8 + 18 + t, -1)}" stroke="black"/>']
el9 += [f'<text x="{5 + x_:.1f}" y="{79 - y_:.1f}" font-size="3" fill="none" stroke="red" stroke-width="0.12" text-anchor="middle">{txt}</text>' for x_, y_, txt in rot9]
el9.append(f'<text x="35" y="{79 + 8 + 10:.1f}" font-size="3" fill="none" stroke="red" stroke-width="0.12" text-anchor="middle">tira de prueba</text>')
open(os.path.join(pr, "9_pruebas_ranuras_acrilico.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{placa9.bounds[2] + 10:.2f}mm" height="118mm" viewBox="0 0 {placa9.bounds[2] + 10:.2f} 118" '
    f'fill="none" stroke-width="0.1" font-family="sans-serif">' + "".join(el9) + "</svg>")

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
    el.append(f'<path d="{ruta(poly, 5 - bx0, yy + by1, -1)}" stroke="black"/>')
    el.append(f'<text x="{bx1 - bx0 + 9:.1f}" y="{yy + 6:.1f}" font-size="3.5" fill="none" stroke="red" stroke-width="0.12">{etiqueta}</text>')
    for mx, my, txt in marcas:
        el.append(f'<text x="{5 + mx:.1f}" y="{yy + by1 - my:.1f}" font-size="3" fill="none" stroke="red" stroke-width="0.12" text-anchor="middle">{txt}</text>')
    yy += by1 - by0 + 5
pon(mini, "esquina de la bisagra (x2)"); pon(mini, "")
pon(mini_lomo, "lomo corto")
pon(cal, "calibre de holguras (mm por lado)", [(17 + 33 * i, 16, f"{dx:+.1f}") for i, dx in enumerate(dxs)])
pon(p_ext, "extremo real (prueba del fiador)")
open(os.path.join(pr, "4_pruebas_mdf.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="170mm" height="{yy:.2f}mm" viewBox="0 0 170 {yy:.2f}" '
    f'fill="none" stroke-width="0.1" font-family="sans-serif">' + "".join(el) + "</svg>")
print("piezas de prueba en pruebas/")

# 6) todas las pruebas impresas en una sola placa
fs = ["pruebas/1_calce_llave.stl", "pruebas/5_calibre_remache_impreso.stl", "pruebas/2_bisagra_trozo_bandeja.stl",
      "pruebas/3_fiador_punta_bandeja.stl"] + (["bisagra_fija.stl"] if CON_BISAGRA_FIJA else []) + ["remache_x2.stl", "seguro_x2.stl"]
x = y = fila = 0.0; ms = []
for f in fs:
    m = trimesh.load(os.path.join(aqui, f)); m.apply_translation(-m.bounds[0]); ex = m.extents
    if x > 0 and x + ex[0] > 206.5: x, y, fila = 0.0, y + fila + 6, 0.0
    m.apply_translation([x, y, 0]); ms.append(m); x += ex[0] + 6; fila = max(fila, ex[1])
placa = trimesh.util.concatenate(ms); placa.export(os.path.join(pr, "todas_las_pruebas.stl"))
print(f"placa de pruebas: {' x '.join(f'{v:.1f}' for v in placa.extents)} mm, {len(placa.split())} piezas")

# 7) pasadores (remaches) y broches (seguros y fiador) con varias holguras, en una placa.
#    El numero de marcas identifica cada variante; las marcadas con * son las del diseno actual.
VAR_REMACHE = (0.0, 0.2, 0.4)        # holgura del cuello sobre los 3 mm del MDF  -> 1, 2*, 3 anillos
VAR_SEGURO = (4.2, 4.4, 4.6, 4.8)    # ancho de las patas del seguro              -> 1, 2*, 3, 4 muescas
VAR_FIADOR = (1.0, 1.3, 1.6)         # saliente del resalte del clic              -> 1, 2*, 3 muescas
ms7 = [girar(remache((0, 0), True, e_, i + 1), 90, [1, 0, 0]) for i, e_ in enumerate(VAR_REMACHE)]
ms7 += [girar(seguro((0, 0), True, p_, i + 1), 180, [1, 0, 0]) for i, p_ in enumerate(VAR_SEGURO)]
sin_resalte = D(bandeja, B(ur + 0.001, ur + 4, v_res - 4, v_res + 4, -1, 18))
for i, sal in enumerate(VAR_FIADOR):
    b_ = U(sin_resalte, D(cil(ur, v_res, sal, 0, 16), B(ur - 5, ur - 0.5, v_res - 4, v_res + 4, -1, 17)))
    b_ = D(b_, *[B(ur - 12.5 + 2.6 * k, ur - 11.3 + 2.6 * k, vs1 + 3, vs1 + 8, alto - 1, alto + 1) for k in range(i + 1)])
    ms7.append(recorte(b_, box(ur - 14, yb - 1, ur + 3, vs1 + 7)))
x = y = fila = 0.0
for m in ms7:
    ex = m.extents
    if x > 0 and x + ex[0] > 120: x, y, fila = 0.0, y + fila + 6, 0.0
    m.apply_translation([x, y, 0]); x += ex[0] + 6; fila = max(fila, ex[1])
placa7 = trimesh.util.concatenate(ms7); placa7.export(os.path.join(pr, "7_pasadores_y_broches.stl"))
print(f"placa de pasadores y broches: {' x '.join(f'{v:.1f}' for v in placa7.extents)} mm, {len(placa7.split())} piezas, {sum(m.volume for m in ms7) / 1000:.0f} cm3")

# 8) bandeja (vaciado de la llave) + bisagra completa en una sola placa: todas las piezas impresas definitivas
x = y = fila = 0.0; ms8 = []
for f in ["bandeja_navaja.stl"] + (["bisagra_fija.stl"] if CON_BISAGRA_FIJA else []) + ["remache_x2.stl", "remache_x2.stl", "seguro_x2.stl", "seguro_x2.stl"]:
    m = trimesh.load(os.path.join(aqui, f)); m.apply_translation(-m.bounds[0]); ex = m.extents
    if x > 0 and x + ex[0] > 224.5: x, y, fila = 0.0, y + fila + 6, 0.0
    m.apply_translation([x, y, 0]); ms8.append(m); x += ex[0] + 6; fila = max(fila, ex[1])
placa8 = trimesh.util.concatenate(ms8); placa8.export(os.path.join(aqui, "piezas_impresas.stl"))
print(f"piezas impresas: {' x '.join(f'{v:.1f}' for v in placa8.extents)} mm, {len(placa8.split())} piezas")

# 10) hoja de corte de 600 x 600 mm: caja completa + pruebas de ranuras + pruebas de la esquina del pasador.
#     Negro = corte, rojo = score.  La pagina mide 600 x 600; no lleva marco para que el laser no lo corte.
HOJA = 600.0
h10 = []
def poner(poly, x_, y_, grabado=(), textos=(), nombre=None):
    b_ = poly.bounds; ox, oy = x_ - b_[0], y_ + b_[3]
    h10.append(f'<path d="{ruta(poly, ox, oy, -1)}" stroke="black"/>')
    h10.extend(f'<path d="{ruta(q_, ox, oy, -1)}" stroke="red"/>' for q_ in grabado)
    for tx, ty, txt in list(textos) + ([((b_[0] + b_[2]) / 2, (b_[1] + b_[3]) / 2, nombre)] if nombre else []):
        h10.append(f'<text x="{ox + tx:.1f}" y="{oy - ty + 1:.1f}" font-size="3" fill="none" stroke="red" stroke-width="0.12" text-anchor="middle">{txt}</text>')
    assert x_ + b_[2] - b_[0] <= HOJA - 5 and y_ + b_[3] - b_[1] <= HOJA - 5, "no cabe en la hoja"
    return b_[2] - b_[0], b_[3] - b_[1]
yy = 10.0
wc, hc = poner(cara, 10, yy, grabado=DISENO); yy += hc + 6
poner(cara, 10, yy); yy += hc + 6
wl, hl = poner(p_lomo, 10, yy); poner(p_ext, 10 + wl + 8, yy); yy += hl + 6
x2 = 10 + wc + 12                                  # columna derecha: pruebas
w9, h9 = poner(placa9, x2, 10, textos=rot9)
wt, ht = poner(tira9, x2, 10 + h9 + 6, nombre="tira de prueba"); poner(tira9, x2 + wt + 6, 10 + h9 + 6)
y2 = 10 + h9 + 6 + ht + 8
wm, hm = poner(mini, x2, y2, nombre="esquina del pasador"); poner(mini, x2 + wm + 6, y2); poner(mini_lomo, x2 + 2 * (wm + 6), y2)
open(os.path.join(aqui, "hoja_corte_600x600.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{HOJA:g}mm" height="{HOJA:g}mm" viewBox="0 0 {HOJA:g} {HOJA:g}" '
    f'fill="none" stroke-width="0.1" font-family="sans-serif">' + "".join(h10) + "</svg>")
print(f"hoja de corte 600 x 600: ocupa hasta x = {max(10 + wc, x2 + w9):.0f} mm, y = {max(yy, y2 + hm):.0f} mm")

# 11) hoja de 600 x 600 mm solo con las piezas de prueba
h10 = []
w9, h9 = poner(placa9, 10, 10, textos=rot9)
wt, ht = poner(tira9, 10, 10 + h9 + 6, nombre="tira de prueba"); poner(tira9, 10 + wt + 6, 10 + h9 + 6)
y2 = 10 + h9 + 6 + ht + 8
wm, hm = poner(mini, 10, y2, nombre="esquina del pasador"); poner(mini, 10 + wm + 6, y2); poner(mini_lomo, 10 + 2 * (wm + 6), y2)
open(os.path.join(aqui, "hoja_pruebas_600x600.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{HOJA:g}mm" height="{HOJA:g}mm" viewBox="0 0 {HOJA:g} {HOJA:g}" '
    f'fill="none" stroke-width="0.1" font-family="sans-serif">' + "".join(h10) + "</svg>")
print(f"hoja de pruebas 600 x 600: ocupa hasta x = {10 + w9:.0f} mm, y = {y2 + hm:.0f} mm")

# 12) hoja de 600 x 600 mm solo con la caja (sin pruebas)
h10 = []; yy = 10.0
wc, hc = poner(cara, 10, yy, grabado=DISENO); yy += hc + 6
poner(cara, 10, yy); yy += hc + 6
wl, hl = poner(p_lomo, 10, yy); poner(p_ext, 10 + wl + 8, yy); yy += hl
open(os.path.join(aqui, "hoja_caja_600x600.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{HOJA:g}mm" height="{HOJA:g}mm" viewBox="0 0 {HOJA:g} {HOJA:g}" '
    f'fill="none" stroke-width="0.1" font-family="sans-serif">' + "".join(h10) + "</svg>")
print(f"hoja de la caja 600 x 600: ocupa hasta x = {10 + wl + 8 + p_ext.bounds[2] - p_ext.bounds[0]:.0f} mm, y = {yy:.0f} mm")

# 13) la misma hoja de la caja, sin el diseno grabado (solo corte)
h10 = []; yy = 10.0
wc, hc = poner(cara, 10, yy); yy += hc + 6
poner(cara, 10, yy); yy += hc + 6
wl, hl = poner(p_lomo, 10, yy); poner(p_ext, 10 + wl + 8, yy)
open(os.path.join(aqui, "hoja_caja_sin_diseno_600x600.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{HOJA:g}mm" height="{HOJA:g}mm" viewBox="0 0 {HOJA:g} {HOJA:g}" '
    f'fill="none" stroke-width="0.1" font-family="sans-serif">' + "".join(h10) + "</svg>")

# 14) PRUEBA DE IMPRESION contra el acrilico ya cortado, en una sola placa:
#     anillo de calce de la llave + trozo de bandeja con el agujero del pasador + variantes de pasador, seguro y fiador
ms14 = [trimesh.load(os.path.join(pr, "1_calce_llave.stl")), trimesh.load(os.path.join(pr, "2_bisagra_trozo_bandeja.stl"))] + [m.copy() for m in ms7]
x = y = fila = 0.0
for m in ms14:
    m.apply_translation(-m.bounds[0]); ex = m.extents
    if x > 0 and x + ex[0] > ms14[0].extents[0] + 0.5: x, y, fila = 0.0, y + fila + 5, 0.0
    m.apply_translation([x, y, 0]); x += ex[0] + 5; fila = max(fila, ex[1])
placa14 = trimesh.util.concatenate(ms14); placa14.export(os.path.join(pr, "prueba_impresion.stl"))
print(f"prueba de impresion: {' x '.join(f'{v:.1f}' for v in placa14.extents)} mm, {len(placa14.split())} piezas, {sum(m.volume for m in ms14) / 1000:.0f} cm3")
for m in ms14: print("   ", " x ".join(f"{v:.1f}" for v in m.extents), "en", " ".join(f"{v:.0f}" for v in m.bounds[0][:2]), "| estanca", m.is_watertight)
