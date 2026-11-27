# -*- coding: utf-8 -*-
# Pone las fotos de la llave en Rhino, a escala real y alineadas por la linea negra.
# Uso: en Rhino escribe el comando  RunPythonScript  y elige este archivo.
# Los dos .jpg tienen que estar en la misma carpeta que este script.
import os
import rhinoscriptsyntax as rs

carpeta = os.path.dirname(os.path.abspath(__file__))
FOTOS = [["foto superior", "foto_superior_2.jpg", [[179.68437010745595, 156.470846388862, 0.0], [-46.3469703586739, 31.89296521919028, 0.0], [47.08644051857988, -137.63054013040713, 0.0], [273.1177809847097, -13.052658960735407, 0.0]]], ["foto lateral", "foto_lateral_1.jpg", [[188.01633760218192, 84.21911819386146, -37.99246938629931], [89.82322219896625, 39.54693136068397, -37.99246938629931], [89.82322219896625, 39.54693136068397, 42.9154372504395], [188.01633760218192, 84.21911819386146, 42.9154372504395]]]]
LINEAS = [["linea negra - superior", [187.98019638660338, -21.403868997224073, 0.0], [150.71100062335205, 60.5168673712953, 0.0]], ["linea negra - lateral", [148.1740913721073, 66.09320111571702, -9.096788444606878], [148.1740913721073, 66.09320111571702, 9.096788444606878]], ["union de las dos vistas", [169.34559850497772, 19.556499187035612, 0.0], [148.1740913721073, 66.09320111571702, 0.0]], ["largo 203.5 mm", [-0.01300000000000523, 12.585517029056213, 0.0], [204.43636780574016, 22.308974966036434, 0.0]]]

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
print("Listo: 2 fotos y %d lineas de referencia." % len(LINEAS))
