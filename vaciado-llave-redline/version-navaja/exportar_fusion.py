"""Exporta el estuche tipo navaja como SOLIDOS (STEP) para Fusion 360.

    pip install cadquery
    python3 exportar_fusion.py

Cada pieza se construye como lo haria una persona, con operaciones simples:
perfil (rectas, arcos y curvas suaves) -> extrusion -> cilindros y cajas que se
suman o se restan.  Salidas:
    estuche_navaja.step   estuche armado: solo cuerpos (sin componentes), en el orden que imprime este script
    pruebas_navaja.step   piezas de prueba para imprimir, acostadas sobre el plano XY
En Fusion: Archivo > Abrir > (desde mi equipo) y elegir el .step.
"""
import os
import numpy as np
import cadquery as cq
from cadquery import Vector, Edge, Wire, Face, Solid
from shapely.geometry import Point, box
from shapely.ops import unary_union
import generar_navaja as g

# ---------- de un poligono a un perfil de rectas, arcos y curvas ----------
def _circulo(p):
    A = np.c_[2 * p[:, 0], 2 * p[:, 1], np.ones(len(p))]
    c = np.linalg.lstsq(A, (p ** 2).sum(1), rcond=None)[0]
    r = np.sqrt(max(c[2] + c[0] ** 2 + c[1] ** 2, 0))
    return c[0], c[1], r, np.abs(np.hypot(p[:, 0] - c[0], p[:, 1] - c[1]) - r).max()
def _recta(p):
    d = p[-1] - p[0]; L = np.hypot(*d)
    return L > 1e-9 and np.abs(d[0] * (p[:, 1] - p[0, 1]) - d[1] * (p[:, 0] - p[0, 0])).max() / L < 0.004
def _V(p): return Vector(float(p[0]), float(p[1]), 0.0)

def aristas(coords):
    p = np.array(coords, float)
    if np.allclose(p[0], p[-1]): p = p[:-1]
    p = p[np.r_[True, np.hypot(*(p[1:] - p[:-1]).T) > 1e-6]]
    n = len(p)
    a, b = p - np.roll(p, 1, 0), np.roll(p, -1, 0) - p
    giro = np.abs(np.degrees(np.arctan2(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0], (a * b).sum(1))))
    p = np.roll(p, -int(np.argmax(giro)), 0); giro = np.roll(giro, -int(np.argmax(giro)))
    q = np.vstack([p, p[:1]]); esq = np.r_[giro > 12, True]; esq[0] = True
    es, libre, i = [], [0], 0
    def suelta():                                   # tramo libre -> curva suave por pocos puntos
        if len(libre) > 1:
            pts = q[libre]
            if len(pts) == 2 or _recta(pts): es.append(Edge.makeLine(_V(pts[0]), _V(pts[-1])))
            else:
                s = np.r_[0, np.cumsum(np.hypot(*(pts[1:] - pts[:-1]).T))]
                k = max(2, int(s[-1] / 1.5)); ids = sorted(set(np.searchsorted(s, np.linspace(0, s[-1], k + 1)).clip(0, len(pts) - 1)))
                es.append(Edge.makeSpline([_V(pts[m]) for m in ids]))
    while i < n:
        lim = i + 1
        while lim < n and not esq[lim]: lim += 1    # ningun tramo cruza una esquina
        jl = i + 1
        while jl < lim and _recta(q[i:jl + 2]): jl += 1
        ja, arco = i, False
        if lim - i >= 4:
            j = i + 4
            while j <= lim and _circulo(q[i:j + 1])[3] < 0.01 and _circulo(q[i:j + 1])[2] < 400: ja = j; j += 1
            if ja > i:
                cx, cy, r, _ = _circulo(q[i:ja + 1]); cuerda = np.hypot(*(q[ja] - q[i]))
                largo = np.hypot(*(q[i + 1:ja + 1] - q[i:ja]).T).sum()
                arco = np.degrees(largo / r) >= 12 and np.degrees(largo / r) < 300 and cuerda > 1e-3
        Ll = np.hypot(*(q[jl] - q[i]))
        recta = jl - i >= 2 or (esq[i] and esq[jl]) or Ll >= 1.5
        if arco and (not recta or ja > jl):
            suelta(); m = (i + ja) // 2
            es.append(Edge.makeThreePointArc(_V(q[i]), _V(q[m]), _V(q[ja]))); i = ja; libre = [i]
        elif recta:
            suelta(); es.append(Edge.makeLine(_V(q[i]), _V(q[jl]))); i = jl; libre = [i]
        else:
            i += 1; libre.append(i)
            if esq[i]: suelta(); libre = [i]
    suelta()
    return es

N_ARISTAS = {}
def cara2d(poly):
    w = [Wire.assembleEdges(aristas(r.coords)) for r in [poly.exterior] + list(poly.interiors)]
    return Face.makeFromWires(w[0], w[1:])
def ext(poly, z0, z1):
    geoms = [x for x in getattr(poly, "geoms", [poly]) if x.area > 1e-3]
    s = None
    for x in geoms:
        k = Solid.extrudeLinear(cara2d(x), Vector(0, 0, z1 - z0)).translate(Vector(0, 0, z0))
        s = k if s is None else s.fuse(k)
    return s
def cil(x, y, r, z0, z1): return Solid.makeCylinder(r, z1 - z0, Vector(float(x), float(y), z0), Vector(0, 0, 1))
def caja(x0, x1, y0, y1, z0, z1): return Solid.makeBox(x1 - x0, y1 - y0, z1 - z0, Vector(float(x0), float(y0), float(z0)))
def suma(*s):
    r = s[0]
    for k in s[1:]: r = r.fuse(k)
    return r.clean()
def resta(a, *s):
    for k in s: a = a.cut(k)
    return a.clean()

t, alto, zi0, zi1, zc0, zc1 = g.t, g.alto, g.zi0, g.zi1, g.zc0, g.zc1
P, C2, ur, yb, y_lomo, x_ext = g.P, g.C2, g.ur, g.yb, g.y_lomo, g.x_ext

# ---------- piezas ----------
def bandeja(saliente=g.FIADOR_SALIENTE):
    A, Bc = g.bandeja2d.intersection(g.b_extremos), g.bandeja2d.intersection(g.b_centro)
    cuerpo = suma(ext(A, 0, zc0 + 0.15), ext(Bc, zc0 + 0.15, zc1 - 0.15), ext(A, zc1 - 0.15, alto))   # 1. cuerpo con el nudillo
    cuerpo = resta(cuerpo, ext(g.corte, g.BASE, alto + 1))                                            # 2. vaciado de la llave
    return suma(cuerpo, cil(ur, g.v_res, saliente, 0, 16))                                            # 3. resalte del fiador
def tira(p, extremo):
    s = ext(p, 0, t).rotate(Vector(0, 0, 0), Vector(1, 0, 0), 90)
    if extremo: return s.rotate(Vector(0, 0, 0), Vector(0, 0, 1), 90).translate(Vector(x_ext, y_lomo, 0))
    return s.translate(Vector(g.u_lomo, y_lomo, 0))
def bisagra():
    s = suma(ext(g.hoja2d, zi0, zi1), ext(g.ref2d, zi0, zc0 - 0.15), ext(g.ref2d, zc1 + 0.15, zi1),
             caja(*g.tab_h, y_lomo, y_lomo + g.HOJA[1], zi0 - t, zi1 + t))
    return resta(s, cil(P[0], P[1], g.EJE_D / 2 + 0.15, zi0 - t - 1, zi1 + t + 1))
def remache(c, alas_en_u, extra=0.2, marcas=0):
    ln, (al, aa, ah) = t + extra, g.ALA
    s = suma(cil(0, 0, g.EJE_D / 2, zi0, zi1), cil(0, 0, g.CUELLO_D / 2, zi0 - ln - ah, zi1 + ln + ah),
             caja(-al / 2, al / 2, -aa / 2, aa / 2, zi0 - ln - ah, zi0 - ln), caja(-al / 2, al / 2, -aa / 2, aa / 2, zi1 + ln, zi1 + ln + ah))
    s = resta(s, caja(-20, 20, -20, -aa / 2, zi0 - 20, zi1 + 20))
    for i in range(marcas):
        z = alto / 2 - 3 + 2.4 * i
        s = resta(s, resta(cil(0, 0, g.EJE_D / 2 + 1, z, z + 0.8), cil(0, 0, g.EJE_D / 2 - 0.5, z - 1, z + 2)))
    if not alas_en_u: s = s.rotate(Vector(0, 0, 0), Vector(0, 0, 1), 90)
    return s.translate(Vector(float(c[0]), float(c[1]), 0))
def seguro(c, alas_en_u, pata=4.4, marcas=0):
    z0, (al, aa, ah), rc = zi1 + t, g.ALA, g.CUELLO_D / 2
    s = resta(cil(0, 0, 7.5, z0 + 0.2, z0 + 0.2 + ah), caja(-al / 2 - 0.2, al / 2 + 0.2, -aa / 2 - 0.2, aa / 2 + 0.2, z0, z0 + 5), cil(0, 0, rc + 0.2, z0, z0 + 5))
    s = suma(s, caja(-pata / 2, pata / 2, rc + 0.25, al / 2 + 0.2, z0 - t, z0 + 0.3), caja(-pata / 2, pata / 2, -al / 2 - 0.2, -rc - 0.25, z0 - t, z0 + 0.3))
    for a_ in np.radians(25 + 22 * np.arange(marcas)):
        s = resta(s, cil(7.5 * np.cos(a_), 7.5 * np.sin(a_), 0.9, z0, z0 + 6))
    if not alas_en_u: s = s.rotate(Vector(0, 0, 0), Vector(0, 0, 1), 90)
    return s.translate(Vector(float(c[0]), float(c[1]), 0))

MDF, ROJO, NEGRO, AZUL, AMAR = cq.Color(0.78, 0.63, 0.44), cq.Color(0.84, 0.23, 0.17), cq.Color(0.2, 0.2, 0.22), cq.Color(0.18, 0.44, 0.69), cq.Color(0.88, 0.63, 0.13)
band = bandeja()
piezas = [("MDF_cara_inferior", ext(g.cara, zi0 - t, zi0), MDF), ("MDF_cara_superior", ext(g.cara, zi1, zi1 + t), MDF),
          ("MDF_lomo", tira(g.p_lomo, False), MDF), ("MDF_extremo", tira(g.p_ext, True), MDF),
          ("bandeja", band, ROJO), ("bisagra_fija", bisagra(), AZUL),
          ("pasador_eje", remache(P, False), NEGRO), ("pasador_esquina", remache(C2, True), NEGRO),
          ("broche_seguro_eje", seguro(P, False), AMAR), ("broche_seguro_esquina", seguro(C2, True), AMAR)]
piezas.append(("llave_referencia_calcado", ext(g.herr, g.BASE, g.BASE + 13), cq.Color(0.75, 0.77, 0.8)))   # el calcado de la foto, como solido
def guardar(solidos, archivo):                     # un solo conjunto de cuerpos, sin componentes ni ensamblaje
    cq.exporters.export(cq.Compound.makeCompound(solidos), os.path.join(g.aqui, archivo))
for k, (n, s, col) in enumerate(piezas):
    print(f"Cuerpo {k + 1}:", end=" ")
    print(f"{n:24s} valido={s.isValid()} solidos={len(s.Solids())} caras={len(s.Faces())} volumen={s.Volume() / 1000:.2f} cm3")
guardar([s for n, s, col in piezas], "estuche_navaja.step")

# ---------- piezas de prueba, acostadas para imprimir ----------
def acostar(s, eje=None, ang=0):
    if eje: s = s.rotate(Vector(0, 0, 0), Vector(*eje), ang)
    bb = s.BoundingBox(); return s.translate(Vector(-bb.xmin, -bb.ymin, -bb.zmin))
pr = [("1_calce_llave", acostar(resta(ext(g.vaciado.buffer(2.5), 0, 3.0), ext(g.vaciado, 0.6, 4.0)))),
      ("2_bisagra_trozo_bandeja", acostar(band.intersect(cil(P[0], P[1], 26, -1, alto + 1)))),
      ("5_calibre_remache", acostar(ext(g.cal5.difference(unary_union([box(8.5 + 33 * i - 0.2, 5.8, 8.5 + 33 * i + g.PESTANA + 0.2, 6.2 + t) for i in range(3)])), 0, t))),
      ("bisagra_fija", acostar(bisagra(), (1, 0, 0), 90))]
pr += [(f"pasador_{i + 1}_marcas_cuello_+{e_:.1f}", acostar(remache((0, 0), True, e_, i + 1), (1, 0, 0), 90)) for i, e_ in enumerate(g.VAR_REMACHE)]
pr += [(f"broche_seguro_{i + 1}_marcas_pata_{p_:.1f}", acostar(seguro((0, 0), True, p_, i + 1), (1, 0, 0), 180)) for i, p_ in enumerate(g.VAR_SEGURO)]
zona = caja(ur - 30, ur + 3, yb - 1, g.vs1 + 7, -1, alto + 1)
for i, sal in enumerate(g.VAR_FIADOR):
    b_ = resta(bandeja(sal).intersect(zona), *[caja(ur - 27 + 3 * k, ur - 25.8 + 3 * k, yb - 1, yb + 3, alto - 1, alto + 1) for k in range(i + 1)])
    pr.append((f"broche_fiador_{i + 1}_marcas_saliente_{sal:.1f}", acostar(b_)))
x = y = fila = 0.0; sueltos = []
for k, (n, s) in enumerate(pr):
    bb = s.BoundingBox()
    if x > 0 and x + bb.xlen > 207: x, y, fila = 0.0, y + fila + 6, 0.0
    sueltos.append(s.translate(Vector(x, y, 0)))
    print(f"Cuerpo {k + 1}: {n:38s} valido={s.isValid()} solidos={len(s.Solids())} {bb.xlen:.1f} x {bb.ylen:.1f} x {bb.zlen:.1f}")
    x += bb.xlen + 6; fila = max(fila, bb.ylen)
guardar(sueltos, "pruebas_navaja.step")
print("comparacion con las mallas: bandeja", round(g.bandeja.volume / 1000, 2), "bisagra", round(g.bisagra.volume / 1000, 2),
      "remache", round(g.rem[0].volume / 1000, 2), "seguro", round(g.seg[0].volume / 1000, 2), "cara", round(g.m_caras[0].volume / 1000, 2))
