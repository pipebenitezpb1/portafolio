"""Deja las fotos de la llave dentro de un archivo de Rhino, a escala real y alineadas, para calcarlas a mano.

  - foto superior: acostada en el plano XY, girada y escalada para que la llave mida su largo real;
  - foto lateral: parada en un plano vertical perpendicular a la linea negra, con esa linea coincidiendo en las dos vistas.
Las fotos van como superficies planas con la imagen de textura: en Rhino hay que usar el modo de vista "Renderizado" para verlas,
y los .jpg deben quedar en la misma carpeta que el .3dm.
"""
import os, json
import numpy as np, cv2
import rhino3dm as r3
from shapely.geometry import Polygon, LineString
aqui = os.path.dirname(os.path.abspath(__file__))

# ---- puntos de referencia tomados de las fotos (pixeles) ----
SUP = dict(archivo="foto_superior_2.jpg", punta_mordaza=(430, 640), punta_corona=(2264, 1540), linea=((770, 525), (730, 1045)))
LAT = dict(archivo="foto_lateral_1.jpg", x_linea=818, y_centro=802, x_punta=192)      # linea negra, centro del grosor, punta de la mordaza
LARGO = 203.5                                    # mm, largo real de la llave (estimado; ajusta el tamano de la foto superior)

# contorno ya corregido, para ubicar las dos puntas en las coordenadas del modelo
import io, contextlib
with contextlib.redirect_stdout(io.StringIO()):
    src = open(os.path.join(aqui, "..", "version-navaja", "generar_navaja.py")).read()
    ns = {"__file__": os.path.join(aqui, "..", "version-navaja", "generar_navaja.py"), "__name__": "contorno"}
    exec(src[:src.index("caja_ref = suave(a_medida(LARGO_ESTIMADO, ANCHO_ESTIMADO))")], ns)
llave = ns["herr"]; co = np.array(llave.exterior.coords)
m_mordaza = co[np.argmax(co[:, 0])]; izq = co[co[:, 0] < co[:, 0].min() + 0.3]; m_corona = np.array([co[:, 0].min(), izq[:, 1].mean()])

# ---- foto superior: semejanza (giro + escala) que lleva las dos puntas de la foto a las del modelo ----
z = lambda p: complex(p[0], -p[1])               # pixel -> plano con el eje Y hacia arriba
a = (complex(*m_mordaza) - complex(*m_corona)) / (z(SUP["punta_mordaza"]) - z(SUP["punta_corona"]))
b = complex(*m_corona) - a * z(SUP["punta_corona"])
T = lambda p: (lambda w: np.array([w.real, w.imag]))(a * z(p) + b)
img = cv2.imread(os.path.join(aqui, SUP["archivo"])); Hs, Ws = img.shape[:2]
l1, l2 = T(SUP["linea"][0]), T(SUP["linea"][1])
d = (l2 - l1) / np.hypot(*(l2 - l1)); p0 = (l1 + l2) / 2
json.dump({"p0": [float(v) for v in p0], "d": [float(v) for v in d]}, open(os.path.join(aqui, "eje_foto.json"), "w"))

# ---- foto lateral: plano vertical perpendicular a la linea, del lado desde donde se tomo la foto ----
n = np.array([d[1], -d[0]]); n = n if n[0] < 0 else -n                # hacia el mango (a la derecha en la foto lateral)
f = np.array([-n[1], n[0]])                                           # direccion en que mira la camara: derecha de la foto = n
s_punta = ((co - p0) @ n).min()                                       # la punta de la mordaza, medida desde la linea
kl = abs(s_punta) / (LAT["x_linea"] - LAT["x_punta"])                 # mm por pixel de la foto lateral
lat = cv2.imread(os.path.join(aqui, LAT["archivo"])); Hl, Wl = lat.shape[:2]
cam = p0 - f * (max(abs((l1 - p0) @ f), abs((l2 - p0) @ f)) + 25)      # 25 mm por fuera del canto de la cabeza
L = lambda x, y: (*(cam + (x - LAT["x_linea"]) * kl * n), (LAT["y_centro"] - y) * kl)

# ---- archivo de Rhino ----
m3 = r3.File3dm(); m3.Settings.ModelUnitSystem = r3.UnitSystem.Millimeters
def capa(nombre, col, visible=True):
    c_ = r3.Layer(); c_.Name = nombre; c_.Color = (*col, 255); c_.Visible = visible; m3.Layers.Add(c_); return len(m3.Layers) - 1
FOTOS = []
def foto(esquinas, archivo, idx, nombre):                              # esquinas: abajo-izq, abajo-der, arriba-der, arriba-izq
    mat = r3.Material(); mat.Name = nombre; mat.DiffuseColor = (255, 255, 255, 255); mat.DisableLighting = True; mat.SetBitmapTexture(archivo)
    try: m3.EmbeddedFiles.Add(r3.EmbeddedFile.Read(os.path.join(aqui, archivo)))        # la imagen va tambien dentro del .3dm
    except Exception: pass
    FOTOS.append((nombre, archivo, [list(map(float, e_)) for e_ in esquinas]))
    m3.Materials.Add(mat); im = len(m3.Materials) - 1
    o_, x_, y_ = np.array(esquinas[0], float), np.array(esquinas[1], float) - np.array(esquinas[0], float), np.array(esquinas[3], float) - np.array(esquinas[0], float)
    lx, ly = np.linalg.norm(x_), np.linalg.norm(y_)
    pl = r3.Plane(r3.Point3d(*o_), r3.Vector3d(*(x_ / lx)), r3.Vector3d(*(y_ / ly)))
    sup = r3.PlaneSurface(pl, r3.Interval(0, float(lx)), r3.Interval(0, float(ly)))     # la imagen se reparte sobre toda la superficie
    at = r3.ObjectAttributes(); at.LayerIndex = idx; at.Name = nombre; at.MaterialSource = r3.ObjectMaterialSource.MaterialFromObject; at.MaterialIndex = im
    m3.Objects.Add(sup, at)
def poli(pts, idx, nombre):
    pl = r3.Polyline(0)
    for x_, y_, z_ in pts: pl.Add(float(x_), float(y_), float(z_))
    at = r3.ObjectAttributes(); at.LayerIndex = idx; at.Name = nombre; m3.Objects.AddPolyline(pl, at)
foto([(*T((0, Hs)), 0), (*T((Ws, Hs)), 0), (*T((Ws, 0)), 0), (*T((0, 0)), 0)], SUP["archivo"], capa("Foto superior", (120, 120, 120)), "foto superior")
foto([L(0, Hl), L(Wl, Hl), L(Wl, 0), L(0, 0)], LAT["archivo"], capa("Foto lateral", (120, 120, 120)), "foto lateral")
ie = capa("Eje - linea negra", (0, 0, 0))
poli([(*(p0 - d * 45), 0), (*(p0 + d * 45), 0)], ie, "linea negra sobre la foto superior")
poli([L(LAT["x_linea"], LAT["y_centro"] + 170), L(LAT["x_linea"], LAT["y_centro"] - 170)], ie, "linea negra sobre la foto lateral")
poli([(*p0, 0), (*cam, 0)], ie, "union entre las dos vistas")
ir = capa("Referencia - largo real", (0, 150, 0))
poli([(*m_corona, 0), (*m_mordaza, 0)], ir, f"largo {LARGO} mm")
ic = capa("Calcos hechos por Claude (apagada)", (0, 0, 230), visible=False)
if os.path.exists(os.path.join(aqui, "calcos_fierro.3dm")):
    for o in r3.File3dm.Read(os.path.join(aqui, "calcos_fierro.3dm")).Objects:
        at = r3.ObjectAttributes(); at.LayerIndex = ic; at.Name = o.Attributes.Name; m3.Objects.Add(o.Geometry, at)
m3.Write(os.path.join(aqui, "calcos_con_fotos.3dm"), 7)
esc = np.hypot(*(T((1000, 0)) - T((0, 0)))) / 1000
print(f"foto superior: {1 / esc:.2f} px/mm, girada {np.degrees(np.angle(a)):.1f} grados | linea negra a {np.degrees(np.arctan2(abs(d[1]), abs(d[0]))):.0f} grados del eje largo, en p0 = {np.round(p0, 1)}")
print(f"foto lateral: {1 / kl:.2f} px/mm | cubre {Wl * kl:.0f} x {Hl * kl:.0f} mm | grosor maximo de la cabeza segun la foto: {257 * 1.008 * kl:.1f} mm")

# ---- script para ejecutar DENTRO de Rhino: crea las imagenes con el comando propio de Rhino (se ven en cualquier modo de vista) ----
lineas = [("linea negra - superior", [*(p0 - d * 45), 0], [*(p0 + d * 45), 0]),
          ("linea negra - lateral", list(L(LAT["x_linea"], LAT["y_centro"] + 170)), list(L(LAT["x_linea"], LAT["y_centro"] - 170))),
          ("union de las dos vistas", [*p0, 0], [*cam, 0]), ("largo %s mm" % LARGO, [*m_corona, 0], [*m_mordaza, 0])]
open(os.path.join(aqui, "poner_fotos_en_rhino.py"), "w").write('''# -*- coding: utf-8 -*-
# Pone las fotos de la llave en Rhino, a escala real y alineadas por la linea negra.
# Uso: en Rhino escribe el comando  RunPythonScript  y elige este archivo.
# Los dos .jpg tienen que estar en la misma carpeta que este script.
import os
import rhinoscriptsyntax as rs

carpeta = os.path.dirname(os.path.abspath(__file__))
FOTOS = %s
LINEAS = %s

def capa(nombre, color):
    if not rs.IsLayer(nombre): rs.AddLayer(nombre, color)
    return nombre

rs.EnableRedraw(False)
for nombre, archivo, esq in FOTOS:
    ruta = os.path.join(carpeta, archivo)
    if not os.path.exists(ruta):
        print("No encuentro " + ruta); continue
    origen = esq[0]                                   # esquina inferior izquierda de la foto
    eje_x = rs.VectorCreate(esq[1], esq[0]); eje_y = rs.VectorCreate(esq[3], esq[0])
    plano = rs.PlaneFromFrame(origen, eje_x, eje_y)
    obj = rs.AddPictureFrame(plano, ruta, rs.VectorLength(eje_x), rs.VectorLength(eje_y), True)
    if obj:
        rs.ObjectName(obj, nombre); rs.ObjectLayer(obj, capa("Fotos", (120, 120, 120)))
    else:
        print("No se pudo crear la imagen " + nombre)
for nombre, a, b in LINEAS:
    ln = rs.AddLine(a, b); rs.ObjectName(ln, nombre); rs.ObjectLayer(ln, capa("Eje - linea negra", (0, 0, 0)))
rs.EnableRedraw(True)
rs.ZoomExtents(all=True)
print("Listo: 2 fotos y %%d lineas de referencia." %% len(LINEAS))
''' % (json.dumps(FOTOS), json.dumps([(n_, [float(v) for v in a_], [float(v) for v in b_]) for n_, a_, b_ in lineas])))
print("script de Rhino escrito:", len(FOTOS), "fotos")
