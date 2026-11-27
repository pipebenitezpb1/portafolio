"""Primer modelo en 3D del fierro de la llave (sin la goma), con la tecnica de dos calcos:

  1. calco SUPERIOR: el contorno visto desde arriba, extruido en vertical;
  2. calco LATERAL: el perfil de grosor visto a lo largo de la linea negra marcada en la cabeza
     (la direccion en que corre la mordaza), extruido en esa direccion;
  3. INTERSECCION de los dos volumenes.

Salidas: llave_fierro.step (solido, para Rhino o Fusion), llave_fierro.stl y calcos_fierro.3dm (las curvas y el eje).
Varias medidas son ESTIMADAS de las fotos; estan arriba como parametros para corregirlas con pie de metro.
"""
import os, sys, io, contextlib, json
import numpy as np
sys.dont_write_bytecode = True
aqui = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(aqui, "..", "version-navaja"))
import cadquery as cq
from cadquery import Vector, Edge, Wire, Face, Solid
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import affinity

# ---- medidas estimadas (corregir cuando se midan) ----
T_CABEZA = None        # mm, grosor maximo de la cabeza, en la linea negra.  None = estimado de la foto lateral
T_PUNTA = None         # mm, grosor en la punta de la mordaza.               None = estimado de la foto lateral
T_CUELLO = 5.5         # mm, grosor del cuello y del vastago (en la foto se ve lejos y no se puede medir)
T_CORONA = 7.0         # mm, grosor de la corona
BOCA_CORONA = 16.0     # mm, diametro del agujero de la corona
HEX = (7.8, 6.8)       # mm, diametro circunscrito de los dos agujeros hexagonales
REDONDEO = 0.8         # mm, redondeo de los cantos (0 = cantos vivos)

# ---- 1. calco superior: el contorno de la llave ya corregido con las medidas, sin la goma ----
with contextlib.redirect_stdout(io.StringIO()):
    src = open(os.path.join(aqui, "..", "version-navaja", "generar_navaja.py")).read()
    ns = {"__file__": os.path.join(aqui, "..", "version-navaja", "generar_navaja.py"), "__name__": "contorno"}
    exec(src[:src.index("caja_ref = suave(a_medida(LARGO_ESTIMADO, ANCHO_ESTIMADO))")], ns)     # solo hasta obtener la llave
llave, hb, FACT = ns["herr"], ns["hb"], ns["FACTORES"]
kx, ky, cx, cy = ns["LARGO_ESTIMADO"] / hb[2], ns["ANCHO_ESTIMADO"] / hb[3], hb[2] / 2, hb[3] / 2
ub = lambda u: cx + kx * (u - cx)                        # de coordenadas de la foto original a las del modelo (zona de la cabeza)
vb = lambda v: cy + ky * (v - cy)
punta = llave.bounds[0]; uF, uG = punta + FACT["F"], punta + FACT["G"]      # donde empieza y termina la goma
def ancho(u):
    g_ = llave.intersection(LineString([(u, -100), (u, 300)])); return g_.bounds[1], g_.bounds[3]
a0, a1 = ancho(uF - 1.5), ancho(uG + 1.5)
vastago = Polygon([(uF - 1.5, a0[0]), (uG + 1.5, a1[0]), (uG + 1.5, a1[1]), (uF - 1.5, a0[1])])   # bajo la goma se supone recto
fierro2d = unary_union([llave.intersection(box(-50, -100, uF - 1.5, 300)), vastago, llave.intersection(box(uG + 1.5, -100, 500, 300))])
fierro2d = fierro2d.buffer(0.6).buffer(-1.2).buffer(0.6).simplify(0.03)

# ---- 2. la linea negra: paralela al borde de la escala, pasando por el borde de la ventana del sinfin ----
e0, e1 = np.array([ub(159.8), vb(49.8)]), np.array([ub(172.0), vb(28.4)])                # borde de la escala (0-20)
d = (e1 - e0) / np.hypot(*(e1 - e0))                                                      # direccion de la linea = de la mordaza
p0 = np.array([ub(159.5), vb(22.5)])                                                      # punto de la linea
if os.path.exists(os.path.join(aqui, "eje_foto.json")):                                   # la linea negra medida en la foto superior
    _e = json.load(open(os.path.join(aqui, "eje_foto.json"))); p0 = np.array(_e["p0"]); d = np.array(_e["d"])
n = np.array([d[1], -d[0]]); n = n if n[0] < 0 else -n                                    # perpendicular, hacia el mango
s_de = lambda p: (np.array(p) - p0) @ n
co = np.array(fierro2d.exterior.coords); ss = (co - p0) @ n
s_min, s_max = ss.min(), ss.max()
linea = LineString([p0 - d * 60, p0 + d * 60]).intersection(fierro2d)

# ---- 3. calco lateral (foto_lateral_1): grosor en pixeles a cada distancia de la linea negra ----
#   (pixeles a la derecha de la linea, grosor en pixeles).  Negativo = hacia la punta de la mordaza.
PERFIL_PX = [(-622, 150), (-500, 176), (-300, 216), (-100, 246), (0, 257), (40, 250), (100, 200), (160, 122), (215, 72)]
k = abs(s_min) / 622.0                                   # mm por pixel: la punta de la mordaza queda a 622 px de la linea
t_cab = T_CABEZA or 257 * k; t_pun = T_PUNTA or 150 * k
f_t = lambda px_t: t_pun + (px_t - 150) / (257 - 150) * (t_cab - t_pun) if px_t >= 150 else T_CUELLO + (px_t - 72) / (150 - 72) * (t_pun - T_CUELLO)
perfil = [(x_ * k, max(f_t(t_), T_CUELLO)) for x_, t_ in PERFIL_PX]
s_cor = s_de((punta + 27.0, sum(ancho(punta + 13.0)) / 2))                                  # donde empieza la corona
perfil += [(perfil[-1][0] + 6, T_CUELLO), (s_cor - 8, T_CUELLO), (s_cor, T_CORONA), (s_max + 5, T_CORONA)]
perfil[0] = (s_min - 5, perfil[0][1])
lateral2d = Polygon([(s_, t_ / 2) for s_, t_ in perfil] + [(s_, -t_ / 2) for s_, t_ in reversed(perfil)])

# ---- solidos ----
src_f = open(os.path.join(aqui, "..", "version-navaja", "exportar_fusion.py")).read()     # se reutiliza el paso de poligono a rectas, arcos y curvas
exec(src_f[src_f.index("# ---------- de un poligono a un perfil"):src_f.index("def cara2d")], globals())
def cara(poly):
    w = [Wire.assembleEdges(aristas(r.coords)) for r in [poly.exterior] + list(poly.interiors)]
    return Face.makeFromWires(w[0], w[1:])
zt = max(t_cab, T_CORONA) / 2 + 3
superior = Solid.extrudeLinear(cara(fierro2d), Vector(0, 0, 2 * zt)).translate(Vector(0, 0, -zt))
plano = cq.Plane(origin=(float(p0[0]), float(p0[1]), 0), xDir=(float(n[0]), float(n[1]), 0), normal=(float(d[0]), float(d[1]), 0))
signo = 1 if plano.yDir.z > 0 else -1
lateral = cq.Workplane(plano).polyline([(float(s_), float(signo * z_)) for s_, z_ in lateral2d.exterior.coords[:-1]]).close().extrude(300, both=True).val()
cuerpo = superior.intersect(lateral).clean()
# detalles que la interseccion no da: agujero de la corona, hexagonos y ventana del sinfin (posiciones aproximadas)
c_cor = np.array([punta + 13.2, sum(ancho(punta + 13.2)) / 2])
def prisma(pts): return Solid.extrudeLinear(Face.makeFromWires(Wire.makePolygon([Vector(float(x_), float(y_), -30) for x_, y_ in pts], close=True)), Vector(0, 0, 60))
def hexa(c, r_): return prisma([(c[0] + r_ * np.cos(a_), c[1] + r_ * np.sin(a_)) for a_ in np.radians(np.arange(0, 360, 60))])
cortes = [Solid.makeCylinder(BOCA_CORONA / 2, 60, Vector(float(c_cor[0]), float(c_cor[1]), -30), Vector(0, 0, 1)),
          hexa((ub(119.2), vb(21.8) + 0.3), HEX[0] / 2), hexa((ub(133.4), vb(22.6) + 0.3), HEX[1] / 2),
          prisma([(ub(x_), vb(y_)) for x_, y_ in [(144.5, 24.5), (158.0, 28.3), (160.0, 16.7), (147.5, 13.5)]])]
for c_ in cortes: cuerpo = cuerpo.cut(c_)
cuerpo = cuerpo.clean()
if REDONDEO:
    try:
        r_ = cq.Workplane("XY").add(cuerpo).edges().fillet(REDONDEO).val()
        cuerpo = r_ if r_.isValid() else cuerpo
    except Exception as ex:
        print("no se pudo redondear los cantos:", str(ex)[:60])
from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
from OCP.Interface import Interface_Static
w_ = STEPControl_Writer(); Interface_Static.SetIVal_s("write.step.assembly", 0); w_.Transfer(cuerpo.wrapped, STEPControl_AsIs); w_.Write(os.path.join(aqui, "llave_fierro.step"))
cq.exporters.export(cq.Workplane("XY").add(cuerpo), os.path.join(aqui, "llave_fierro.stl"), tolerance=0.02, angularTolerance=0.1)

# ---- curvas para repetir el proceso en Rhino ----
import rhino3dm as r3
m3 = r3.File3dm(); m3.Settings.ModelUnitSystem = r3.UnitSystem.Millimeters
def capa(nombre, col):
    c_ = r3.Layer(); c_.Name = nombre; c_.Color = (*col, 255); return m3.Layers.Add(c_)
def poli(pts, idx, nombre):
    pl = r3.Polyline(0)
    for x_, y_, z_ in pts: pl.Add(float(x_), float(y_), float(z_))
    at = r3.ObjectAttributes(); at.LayerIndex = idx; at.Name = nombre; m3.Objects.AddPolyline(pl, at)
poli([(x_, y_, 0) for x_, y_ in fierro2d.exterior.coords], capa("1 Calco superior", (0, 0, 230)), "contorno superior")
poli([(*(p0 + s_ * n), z_) for s_, z_ in lateral2d.exterior.coords], capa("2 Calco lateral (en el plano del eje)", (230, 0, 0)), "perfil lateral")
ie = capa("3 Eje (linea negra)", (0, 0, 0)); lc = np.array(linea.coords)
poli([(*lc[0], 0), (*lc[-1], 0)], ie, "linea negra sobre la cara"); poli([(*lc[0], -t_cab / 2), (*lc[0], t_cab / 2)], ie, "linea negra en el canto")
m3.Write(os.path.join(aqui, "calcos_fierro.3dm"), 7)

bb = cuerpo.BoundingBox()
print(f"fierro: {bb.xlen:.1f} x {bb.ylen:.1f} x {bb.zlen:.1f} mm | valido {cuerpo.isValid()} | solidos {len(cuerpo.Solids())} | caras {len(cuerpo.Faces())} | {cuerpo.Volume() / 1000:.1f} cm3 (~{cuerpo.Volume() * 7.85 / 1000:.0f} g en acero)")
print(f"linea negra: a {np.degrees(np.arctan2(abs(d[1]), abs(d[0]))):.0f} grados del eje largo | escala de la foto lateral {k:.4f} mm/px")
print(f"grosores: cabeza {t_cab:.1f} (estimado), punta {t_pun:.1f} (estimado), cuello {T_CUELLO} y corona {T_CORONA} (supuestos)")
json.dump({"p0": [float(v) for v in p0], "d": [float(v) for v in d]}, open(os.path.join(aqui, "eje.json"), "w"))
