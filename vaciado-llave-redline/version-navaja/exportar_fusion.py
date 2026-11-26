"""Exporta el estuche tipo navaja como SOLIDOS (STEP) para Fusion 360.

    pip install cadquery
    python3 exportar_fusion.py

Cada pieza se construye como lo haria una persona, con operaciones simples:
perfil (rectas, arcos y curvas suaves) -> extrusion -> cilindros y cajas que se
suman o se restan.  Salidas:
    estuche_navaja.step   estuche armado: solo cuerpos (sin componentes), en el orden que imprime este script
    pruebas_navaja.step   piezas de prueba para imprimir, acostadas sobre el plano XY
    todo_navaja.step      todo junto: armado, pruebas impresas y piezas de MDF planas (definitivas y de prueba)
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

def tramos_perfil(coords):                         # ['l',a,b] | ['a',a,medio,b] | ['s',[puntos]]
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
            if len(pts) == 2 or _recta(pts): es.append(['l', pts[0], pts[-1]])
            else:
                s = np.r_[0, np.cumsum(np.hypot(*(pts[1:] - pts[:-1]).T))]
                k = max(2, int(s[-1] / 1.5)); ids = sorted(set(np.searchsorted(s, np.linspace(0, s[-1], k + 1)).clip(0, len(pts) - 1)))
                es.append(['s', [pts[m] for m in ids]])
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
                segs = np.hypot(*(q[i + 1:ja + 1] - q[i:ja]).T)          # un arco real tiene sus puntos repartidos parejo
                arco = np.degrees(largo / r) >= 12 and np.degrees(largo / r) < 300 and cuerda > 1e-3 and segs.max() <= 4 * np.median(segs)
        Ll = np.hypot(*(q[jl] - q[i]))
        recta = jl - i >= 2 or (esq[i] and esq[jl]) or Ll >= 1.5
        if arco and (not recta or ja > jl):
            suelta(); m = (i + ja) // 2
            es.append(['a', q[i], q[m], q[ja]]); i = ja; libre = [i]
        elif recta:
            suelta(); es.append(['l', q[i], q[jl]]); i = jl; libre = [i]
        else:
            i += 1; libre.append(i)
            if esq[i]: suelta(); libre = [i]
    suelta()
    return es

def aristas(coords):
    return [Edge.makeLine(_V(d[1]), _V(d[2])) if d[0] == 'l' else Edge.makeThreePointArc(_V(d[1]), _V(d[2]), _V(d[3])) if d[0] == 'a'
            else Edge.makeSpline([_V(p_) for p_ in d[1]]) for d in tramos_perfil(coords)]
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
    if g.CON_VACIADO: cuerpo = resta(cuerpo, ext(g.corte, g.PISO, alto + 1))                          # 2. vaciado de la llave
    cuerpo = resta(cuerpo, ext(g.unero2d, -1, g.UNERO[1]), ext(g.unero2d, alto - g.UNERO[1], alto + 1))   # ranura del labio
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
          ("bandeja", band, ROJO)] + ([("bisagra_fija", bisagra(), AZUL)] if g.CON_BISAGRA_FIJA else []) + [
          ("pasador_eje", remache(P, False), NEGRO), ("pasador_esquina", remache(C2, True), NEGRO),
          ("broche_seguro_eje", seguro(P, False), AMAR), ("broche_seguro_esquina", seguro(C2, True), AMAR)]
piezas.append(("llave_referencia_calcado", ext(g.herr, g.PISO, g.PISO + 13), cq.Color(0.75, 0.77, 0.8)))   # el calcado de la foto, como solido
def guardar(solidos, archivo):                     # un solo conjunto de cuerpos, sin componentes ni ensamblaje
    from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
    from OCP.Interface import Interface_Static
    w = STEPControl_Writer()
    Interface_Static.SetIVal_s("write.step.assembly", 0)     # 0 = no escribir estructura de ensamblaje
    w.Transfer(cq.Compound.makeCompound(solidos).wrapped, STEPControl_AsIs)
    w.Write(os.path.join(g.aqui, archivo))
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
      ] + ([("bisagra_fija", acostar(bisagra(), (1, 0, 0), 90))] if g.CON_BISAGRA_FIJA else [])
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
# ---------- todo en un solo archivo: armado + pruebas impresas + MDF plano (definitivo y de prueba) ----------
def plano(poly, x_, y_):
    k = ext(poly, 0, t); bb = k.BoundingBox(); return k.translate(Vector(x_ - bb.xmin, y_ - bb.ymin, 0)), bb.xlen, bb.ylen
todo = [(n, s_) for n, s_, col in piezas]
todo += [("PRUEBA impresa: " + n, s_.translate(Vector(0, -230, 0))) for (n, _), s_ in zip(pr, sueltos)]
y = 110.0
for n, p in [("MDF plano: cara", g.cara), ("MDF plano: cara", g.cara), ("MDF plano: lomo", g.p_lomo), ("MDF plano: extremo", g.p_ext)]:
    k, w_, h_ = plano(p, 0, y); todo.append((n, k)); y += h_ + 8
y = 110.0
for n, p in [("PRUEBA MDF: esquina de la bisagra", g.mini), ("PRUEBA MDF: esquina de la bisagra", g.mini), ("PRUEBA MDF: lomo corto", g.mini_lomo),
             ("PRUEBA MDF: calibre de holguras", g.cal), ("PRUEBA MDF: extremo", g.p_ext)]:
    k, w_, h_ = plano(p, 290, y); todo.append((n, k)); y += h_ + 8
# lamina de calco bajo el estuche: el rectangulo que ocupa la foto (240 x 100 mm), la linea trazada y el vaciado
# como cordones en relieve, y dos marcas en (0,0) y (200,0).  La foto misma no puede ir dentro de un STEP.
zl = zi0 - t - 5
linea = lambda p, w_: p.buffer(w_ / 2).difference(p.buffer(-w_ / 2))
todo += [("CALCO: lamina del lienzo 240 x 100 mm", caja(-20, 220, -25, 75, zl - 0.4, zl)),
         ("CALCO: linea trazada de la llave", ext(linea(g.herr, 0.6), zl, zl + 0.4)),
         ("CALCO: linea del vaciado", ext(linea(g.vaciado, 0.4), zl, zl + 0.4)),
         ("CALCO: marca (0,0)", cil(0, 0, 1.0, zl, zl + 0.8)), ("CALCO: marca (200,0)", cil(200, 0, 1.0, zl, zl + 0.8))]
guardar([s_ for n, s_ in todo], "todo_navaja.step")
print("--- todo_navaja.step ---")
for k, (n, s_) in enumerate(todo):
    bb = s_.BoundingBox(); print(f"Cuerpo {k + 1}: {n} | valido={s_.isValid()} | en x {bb.xmin:.0f}..{bb.xmax:.0f}, y {bb.ymin:.0f}..{bb.ymax:.0f}")
# ---------- carpeta del script de Fusion: STEP + foto + calcado + nombres de los cuerpos ----------
import json, shutil
fz = os.path.join(g.aqui, "fusion", "EstucheNavaja")
def tramos(poly):                                  # el calcado partido en las esquinas, con un punto cada ~2 mm
    p = np.array(poly.exterior.coords)[:-1]; n = len(p)
    a_, b_ = p - np.roll(p, 1, 0), np.roll(p, -1, 0) - p
    giro = np.abs(np.degrees(np.arctan2(a_[:, 0] * b_[:, 1] - a_[:, 1] * b_[:, 0], (a_ * b_).sum(1))))
    esq = [i for i in range(n) if giro[i] > 12] or [0]
    out = []
    for i, j in zip(esq, esq[1:] + [esq[0] + n]):
        seg = p[np.arange(i, j + 1) % n]; d = np.r_[0, np.cumsum(np.hypot(*(seg[1:] - seg[:-1]).T))]
        k = max(1, int(d[-1] / 2.0)); ids = sorted(set(np.searchsorted(d, np.linspace(0, d[-1], k + 1)).clip(0, len(seg) - 1)))
        out.append([[round(float(x_), 3), round(float(y_), 3)] for x_, y_ in seg[ids]])
    return out
json.dump({"nombres": [n for n, s_ in todo], "llave": tramos(g.herr), "vaciado": tramos(g.vaciado),
           "lienzo_mm": {"x0": -20, "y0": -25, "ancho": 240, "alto": 100}}, open(os.path.join(fz, "datos.json"), "w"))
shutil.copy(os.path.join(g.aqui, "todo_navaja.step"), fz)
shutil.copy(os.path.join(g.aqui, "..", "calcado", "foto_para_lienzo.png"), fz)
shutil.make_archive(os.path.join(g.aqui, "fusion", "EstucheNavaja"), "zip", os.path.join(g.aqui, "fusion"), "EstucheNavaja")
print("comparacion con las mallas: bandeja", round(g.bandeja.volume / 1000, 2), 
      "remache", round(g.rem[0].volume / 1000, 2), "seguro", round(g.seg[0].volume / 1000, 2), "cara", round(g.m_caras[0].volume / 1000, 2))


# =====================================================================
#  PROCESO PARA LA LINEA DE TIEMPO DE FUSION
#  Cada pieza como una lista de pasos simples: perfil plano + altura + (cuerpo nuevo | sumar | restar).
#  El script fusion/EstucheNavajaHistorial los ejecuta dentro de Fusion, y asi queda el historial.
# =====================================================================
from shapely import affinity as af
from shapely.geometry import Polygon as _Pol
PASOS = []
def paso(pieza, nombre, op, poly, z0, z1, d=(0, 0)):
    for k, x_ in enumerate([x_ for x_ in getattr(poly, "geoms", [poly]) if x_.geom_type == "Polygon" and x_.area > 0.03]):
        x_ = af.translate(x_, *d)
        PASOS.append({"pieza": pieza, "nombre": nombre + (f" {k + 1}" if k else ""), "op": op, "z0": round(float(z0), 3), "z1": round(float(z1), 3),
                      "area": round(x_.area, 3), "_poly": x_})
def disco(c, r, n=48): return Point(float(c[0]), float(c[1])).buffer(r, resolution=n)
TODO2D = box(-1000, -1000, 1000, 1000)

def pasos_bandeja(pz, rec=TODO2D, sal=g.FIADOR_SALIENTE, d=(0, 0), marcas=0):
    paso(pz, "Cuerpo: volumen de la bandeja con el labio", "nuevo", g.silueta.intersection(rec), 0, alto, d)
    if g.CON_VACIADO: paso(pz, "Vaciado de la llave", "restar", g.corte.intersection(rec), g.PISO, alto + 0.5, d)
    paso(pz, "Ranura del labio, cara inferior", "restar", g.unero2d.intersection(rec), -0.5, g.UNERO[1], d)
    paso(pz, "Ranura del labio, cara superior", "restar", g.unero2d.intersection(rec), alto - g.UNERO[1], alto + 0.5, d)
    paso(pz, "Agujero del pasador", "restar", disco(P, g.EJE_D / 2 + 0.25).intersection(rec), -0.5, alto + 0.5, d)
    paso(pz, "Muesca del pasador de la esquina", "restar", g.muesca.intersection(box(C2[0] - g.rn - 1, yb - 0.6, ur + 0.6, C2[1] + g.rn + 1)).intersection(rec), -0.5, alto + 0.5, d)
    paso(pz, "Ranura de la lamina del fiador", "restar", g.ranura_fiador.intersection(rec), -0.5, alto + 0.5, d)
    paso(pz, "Rebaje para la hoja de la bisagra", "restar", g.silueta.difference(g.b_centro).buffer(0.02, join_style=2).intersection(rec), -0.5, alto + 0.5, d)
    nud = g.b_centro.difference(g.b_extremos).buffer(0.02, join_style=2).intersection(rec)
    paso(pz, "Espacio del nudillo inferior", "restar", nud, -0.5, zc0 + 0.15, d)
    paso(pz, "Espacio del nudillo superior", "restar", nud, zc1 - 0.15, alto + 0.5, d)
    paso(pz, "Resalte del fiador (clic)", "sumar", disco((ur, g.v_res), sal).intersection(rec.buffer(5)), 0, 16, d)
    for k in range(marcas):
        paso(pz, "Marca de variante", "restar", box(ur - 27 + 3 * k, yb - 1, ur - 25.8 + 3 * k, yb + 3), alto - 1, alto + 0.5, d)
def pasos_remache(pz, c, alas_en_u, extra=0.2, d=(0, 0), marcas=0):
    ln, (al, aa, ah) = t + extra, g.ALA
    def T(p):
        if not alas_en_u: p = af.rotate(p, 90, origin=(0, 0))
        return af.translate(p, float(c[0]), float(c[1]))
    ala = box(-al / 2, -aa / 2, al / 2, aa / 2)
    paso(pz, "Cuerpo del pasador (eje)", "nuevo", T(disco((0, 0), g.EJE_D / 2)), zi0, zi1, d)
    paso(pz, "Cuello inferior", "sumar", T(disco((0, 0), g.CUELLO_D / 2)), zi0 - ln - ah, zi0 + 0.01, d)
    paso(pz, "Cuello superior", "sumar", T(disco((0, 0), g.CUELLO_D / 2)), zi1 - 0.01, zi1 + ln + ah, d)
    paso(pz, "Cabeza inferior", "sumar", T(ala), zi0 - ln - ah, zi0 - ln, d)
    paso(pz, "Cabeza superior", "sumar", T(ala), zi1 + ln, zi1 + ln + ah, d)
    paso(pz, "Cara plana para imprimirlo acostado", "restar", T(box(-8, -8, 8, -aa / 2)), zi0 - ln - ah - 0.5, zi1 + ln + ah + 0.5, d)
    for i in range(marcas):
        z = alto / 2 - 3 + 2.4 * i
        paso(pz, "Marca de variante", "restar", T(disco((0, 0), g.EJE_D / 2 + 1).difference(disco((0, 0), g.EJE_D / 2 - 0.5))), z, z + 0.8, d)
def pasos_seguro(pz, c, alas_en_u, pata=4.4, d=(0, 0), marcas=0):
    z0, (al, aa, ah), rc = zi1 + t, g.ALA, g.CUELLO_D / 2
    def T(p):
        if not alas_en_u: p = af.rotate(p, 90, origin=(0, 0))
        return af.translate(p, float(c[0]), float(c[1]))
    dsc = disco((0, 0), 7.5).difference(box(-al / 2 - 0.2, -aa / 2 - 0.2, al / 2 + 0.2, aa / 2 + 0.2)).difference(disco((0, 0), rc + 0.2))
    for a_ in np.radians(25 + 22 * np.arange(marcas)): dsc = dsc.difference(disco((7.5 * np.cos(a_), 7.5 * np.sin(a_)), 0.9))
    paso(pz, "Disco con la ranura para la cabeza del pasador", "nuevo", T(dsc), z0 + 0.2, z0 + 0.2 + ah, d)
    paso(pz, "Pata 1 (entra en la oreja del MDF)", "sumar", T(box(-pata / 2, rc + 0.25, pata / 2, al / 2 + 0.2)), z0 - t, z0 + 0.3, d)
    paso(pz, "Pata 2", "sumar", T(box(-pata / 2, -al / 2 - 0.2, pata / 2, -rc - 0.25)), z0 - t, z0 + 0.3, d)

# --- estuche armado ---
paso("01 Llave de referencia (calcado)", "Contorno calcado de la foto", "nuevo", g.herr, g.PISO, g.PISO + 13)
pasos_bandeja("02 Bandeja")
for pz, z0_ in [("03 MDF cara inferior", zi0 - t), ("04 MDF cara superior", zi1)]:
    paso(pz, "Silueta de la cara", "nuevo", _Pol(g.cara.exterior), z0_, z0_ + t)
    for h_ in g.cara.interiors: paso(pz, "Ranura o agujero", "restar", _Pol(h_), z0_ - 0.5, z0_ + t + 0.5)
lomo2d = box(g.u_lomo, y_lomo - t, x_ext + t, y_lomo)
paso("05 MDF lomo", "Tira del lomo", "nuevo", lomo2d, zi0, zi1)
for a_, b_ in g.tabs_l:
    paso("05 MDF lomo", "Pestana inferior", "sumar", box(a_, y_lomo - t, b_, y_lomo), zi0 - t, zi0 + 0.01)
    paso("05 MDF lomo", "Pestana superior", "sumar", box(a_, y_lomo - t, b_, y_lomo), zi1 - 0.01, zi1 + t)
paso("06 MDF extremo", "Tira del extremo", "nuevo", g.extremo2d, zi0, zi1)
for a_, b_ in g.tabs_e:
    paso("06 MDF extremo", "Pestana inferior", "sumar", box(x_ext, a_, x_ext + t, b_), zi0 - t, zi0 + 0.01)
    paso("06 MDF extremo", "Pestana superior", "sumar", box(x_ext, a_, x_ext + t, b_), zi1 - 0.01, zi1 + t)
paso("06 MDF extremo", "Muesca del fiador", "restar", box(x_ext - 0.5, g.v_res - 1.4, x_ext + t + 0.5, g.v_res + 1.4), zi0 - 0.5, 17.0)
if g.CON_BISAGRA_FIJA:
    paso("07 Bisagra fija", "Hoja contra el lomo", "nuevo", g.hoja2d, zi0, zi1)
    paso("07 Bisagra fija", "Nudillo inferior con refuerzo", "sumar", g.ref2d, zi0, zc0 - 0.15)
    paso("07 Bisagra fija", "Nudillo superior con refuerzo", "sumar", g.ref2d, zc1 + 0.15, zi1)
    tabh = box(g.tab_h[0], y_lomo, g.tab_h[1], y_lomo + g.HOJA[1])
    paso("07 Bisagra fija", "Pestana inferior", "sumar", tabh, zi0 - t, zi0 + 0.01)
    paso("07 Bisagra fija", "Pestana superior", "sumar", tabh, zi1 - 0.01, zi1 + t)
    paso("07 Bisagra fija", "Agujero del pasador", "restar", disco(P, g.EJE_D / 2 + 0.15), zi0 - t - 1, zi1 + t + 1)
pasos_remache("08 Pasador del eje", P, False); pasos_remache("09 Pasador de la esquina", C2, True)
pasos_seguro("10 Broche (seguro) del eje", P, False); pasos_seguro("11 Broche (seguro) de la esquina", C2, True)
N_ARMADO = len(PASOS)
# --- pruebas impresas (de pie, bajo el armado) ---
Y = -150
paso("P1 Prueba: calce de la llave", "Anillo exterior", "nuevo", g.vaciado.buffer(2.5), 0, 3.0, (0, Y))
paso("P1 Prueba: calce de la llave", "Vaciado", "restar", g.vaciado, 0.6, 3.5, (0, Y))
pasos_bandeja("P2 Prueba: trozo de bandeja con bisagra", disco(P, 26), d=(0, Y - 70))
paso("P5 Prueba: calibre impreso", "Placa con agujeros", "nuevo", g.cal5.difference(unary_union([box(8.5 + 33 * i - 0.2, 5.8, 8.5 + 33 * i + g.PESTANA + 0.2, 6.2 + t) for i in range(3)])), 0, t, (40, Y - 80))
for i, e_ in enumerate(g.VAR_REMACHE): pasos_remache(f"P6 Prueba: pasador cuello +{e_:.1f} ({i + 1} marcas)", (160 + 18 * i, Y - 55), True, e_, marcas=i + 1)
for i, p_ in enumerate(g.VAR_SEGURO): pasos_seguro(f"P7 Prueba: seguro pata {p_:.1f} ({i + 1} marcas)", (160 + 20 * i, Y - 80), True, p_, marcas=i + 1)
for i, sal in enumerate(g.VAR_FIADOR): pasos_bandeja(f"P8 Prueba: fiador saliente {sal:.1f} ({i + 1} marcas)", box(ur - 30, yb - 1, ur + 3, g.vs1 + 7), sal, (-ur + 60 + 40 * i, Y - 130), i + 1)
# --- MDF plano: definitivo y de prueba ---
def plano_mdf(pz, p, x_, y_):
    b_ = p.bounds; d = (x_ - b_[0], y_ - b_[1])
    paso(pz, "Contorno", "nuevo", _Pol(p.exterior), 0, t, d)
    for h_ in p.interiors: paso(pz, "Ranura o agujero", "restar", _Pol(h_), -0.5, t + 0.5, d)
    return b_[3] - b_[1]
y = 110.0
for pz, p in [("M1 MDF plano: cara A", g.cara), ("M2 MDF plano: cara B", g.cara), ("M3 MDF plano: lomo", g.p_lomo), ("M4 MDF plano: extremo", g.p_ext)]:
    y += plano_mdf(pz, p, 0, y) + 8
y = 110.0
for pz, p in [("T1 Prueba MDF: esquina bisagra A", g.mini), ("T2 Prueba MDF: esquina bisagra B", g.mini), ("T3 Prueba MDF: lomo corto", g.mini_lomo),
              ("T4 Prueba MDF: calibre de holguras", g.cal), ("T5 Prueba MDF: extremo", g.p_ext)]:
    y += plano_mdf(pz, p, 290, y) + 8

# comprobacion: se ejecutan los mismos pasos con solidos y se comparan los volumenes con las piezas del STEP
def ejecutar(pasos):
    cuerpos = {}
    for q in pasos:
        k = ext(q["_poly"], q["z0"], q["z1"])
        cuerpos[q["pieza"]] = k if q["op"] == "nuevo" else cuerpos[q["pieza"]].fuse(k) if q["op"] == "sumar" else cuerpos[q["pieza"]].cut(k)
    return cuerpos
malos = [(q["pieza"], q["nombre"]) for q in PASOS if abs(ext(q["_poly"], 0, 1).Volume() - q["area"]) > 0.01 * q["area"] + 0.05]
print("pasos cuyo perfil no reproduce su area:", malos or "ninguno")
res = ejecutar(PASOS[:N_ARMADO]); ref = {n: s_ for n, s_, col in piezas}
print("--- pasos para la linea de tiempo:", len(PASOS), "pasos,", len({q['pieza'] for q in PASOS}), "piezas ---")
for a_, b_ in [("02 Bandeja", "bandeja"), ("03 MDF cara inferior", "MDF_cara_inferior"), ("05 MDF lomo", "MDF_lomo"), ("06 MDF extremo", "MDF_extremo")] + ([("07 Bisagra fija", "bisagra_fija")] if g.CON_BISAGRA_FIJA else []) + [
               ("08 Pasador del eje", "pasador_eje"), ("10 Broche (seguro) del eje", "broche_seguro_eje"), ("01 Llave de referencia (calcado)", "llave_referencia_calcado")]:
    va, vb = res[a_].Volume(), ref[b_].Volume(); dif = res[a_].cut(ref[b_]).Volume() + ref[b_].cut(res[a_]).Volume()
    print(f"{a_:36s} por pasos {va / 1000:7.3f} cm3 | STEP {vb / 1000:7.3f} cm3 | diferencia de forma {dif:.2f} mm3")
def lazos(p): return [[[d_[0]] + [[round(float(v_), 4) for v_ in pt] for pt in d_[1:]] if d_[0] != 's' else ['s', [[round(float(v_), 4) for v_ in pt] for pt in d_[1]]]
                       for d_ in tramos_perfil(r_.coords)] for r_ in [p.exterior] + list(p.interiors)]
fh = os.path.join(g.aqui, "fusion", "EstucheNavajaHistorial"); os.makedirs(fh, exist_ok=True)
json.dump({"pasos": [{**{k_: v_ for k_, v_ in q.items() if k_ != "_poly"}, "lazos": lazos(q["_poly"])} for q in PASOS],
           "calcado": {"llave": tramos(g.herr), "vaciado": tramos(g.vaciado)}}, open(os.path.join(fh, "proceso.json"), "w"))
shutil.copy(os.path.join(g.aqui, "..", "calcado", "foto_para_lienzo.png"), fh)
shutil.make_archive(os.path.join(g.aqui, "fusion", "EstucheNavajaHistorial"), "zip", os.path.join(g.aqui, "fusion"), "EstucheNavajaHistorial")
