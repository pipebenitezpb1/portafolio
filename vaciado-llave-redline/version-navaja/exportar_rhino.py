"""Exporta todo el estuche tipo navaja a un archivo de Rhino (.3dm, milimetros).

    pip install rhino3dm
    python3 exportar_rhino.py

Capas: modelo armado, piezas para imprimir, placas de prueba y curvas de corte del MDF.
Los solidos van como mallas cerradas; las piezas de corte van como curvas planas.
"""
import os
import numpy as np
import rhino3dm as r3
import trimesh
import generar_navaja as g

modelo = r3.File3dm()
modelo.Settings.ModelUnitSystem = r3.UnitSystem.Millimeters

def capa(nombre, color):
    c = r3.Layer(); c.Name = nombre; c.Color = (*color, 255)
    return modelo.Layers.Add(c)
def atr(idx, nombre):
    a = r3.ObjectAttributes(); a.LayerIndex = idx; a.Name = nombre; return a
def malla(m, idx, nombre, d=(0, 0, 0)):
    v = (m.vertices[m.faces].reshape(-1, 3) + np.array(d, float))       # sin soldar: aristas vivas
    rm = r3.Mesh()
    for x, y, z in v: rm.Vertices.Add(float(x), float(y), float(z))
    for i in range(0, len(v), 3): rm.Faces.AddFace(i, i + 1, i + 2)
    rm.Normals.ComputeNormals(); rm.Compact()
    modelo.Objects.AddMesh(rm, atr(idx, nombre))
def curvas(poly, idx, nombre, d=(0, 0)):
    b = poly.bounds
    for an in [poly.exterior] + list(poly.interiors):
        pl = r3.Polyline(0)
        for x, y in an.coords: pl.Add(float(x - b[0] + d[0]), float(y - b[1] + d[1]), 0.0)
        modelo.Objects.AddPolyline(pl, atr(idx, nombre))
    return b[2] - b[0], b[3] - b[1]
def rotulo(texto, x, y, idx):
    modelo.Objects.AddTextDot(texto, r3.Point3d(float(x), float(y), 0.0), atr(idx, texto))

MDF, ROJO, NEGRO, AZUL, AMARILLO = (200, 160, 112), (214, 58, 44), (60, 64, 70), (47, 111, 176), (224, 160, 32)
c_txt = capa("Rotulos", (90, 90, 90))

# ---- 1. modelo armado ----
for nombre, color, piezas in [("Armado - MDF", MDF, [("Cara inferior", g.m_caras[0]), ("Cara superior", g.m_caras[1]),
                                                    ("Lomo", g.m_lomo), ("Extremo", g.m_ext)]),
                              ("Armado - bandeja", ROJO, [("Bandeja", g.bandeja)]),
                              ] + ([("Armado - bisagra fija", AZUL, [("Bisagra fija", g.bisagra)])] if g.CON_BISAGRA_FIJA else []) + [
                              ("Armado - pasadores (remaches)", NEGRO, [("Pasador eje", g.rem[0]), ("Pasador esquina", g.rem[1])]),
                              ("Armado - broches (seguros)", AMARILLO, [("Seguro eje", g.seg[0]), ("Seguro esquina", g.seg[1])])]:
    idx = capa(nombre, color)
    for n, m in piezas: malla(m, idx, n)
rotulo("MODELO ARMADO", 100, 75, c_txt)

# ---- calcado de la foto: contorno de la llave y vaciado, en su posicion dentro de la bandeja ----
idx = capa("Calcado de la llave (de la foto)", (0, 0, 230))
for n, p in [("Contorno de la llave (calcado)", g.herr), ("Vaciado (calcado + holgura)", g.vaciado)]:
    pl = r3.Polyline(0)
    for x_, y_ in p.exterior.coords: pl.Add(float(x_), float(y_), float(g.PISO))
    modelo.Objects.AddPolyline(pl, atr(idx, n))

# ---- 2. piezas definitivas, orientadas para imprimir ----
idx = capa("Imprimir - piezas definitivas", ROJO); x, y0 = 0.0, -150.0
for n, f, cant in [("Bandeja", "bandeja_navaja.stl", 1)] + ([("Bisagra fija", "bisagra_fija.stl", 1)] if g.CON_BISAGRA_FIJA else []) + [
                   ("Pasador (remache)", "remache_x2.stl", 2), ("Broche (seguro)", "seguro_x2.stl", 2)]:
    m = trimesh.load(os.path.join(g.aqui, f))
    for k in range(cant):
        malla(m, idx, n, (x, y0, 0)); x += m.extents[0] + 8
rotulo("PIEZAS PARA IMPRIMIR (definitivas)", 100, y0 + 75, c_txt)

# ---- 3. placas de prueba para imprimir ----
idx = capa("Imprimir - pruebas", AZUL); x, y0 = 0.0, -340.0
for n, f in [("Placa: todas las pruebas", "todas_las_pruebas.stl"), ("Placa: pasadores y broches", "7_pasadores_y_broches.stl")]:
    m = trimesh.load(os.path.join(g.pr, f)); malla(m, idx, n, (x, y0, 0))
    rotulo(n.upper(), x + m.extents[0] / 2, y0 + m.extents[1] + 10, c_txt); x += m.extents[0] + 30

# ---- 4. curvas de corte del MDF de 3 mm (1:1) ----
idx = capa("Corte MDF - piezas definitivas", (255, 0, 0)); y = 110.0
for n, p, cant in [("Cara (silueta)", g.cara, 2), ("Lomo", g.p_lomo, 1), ("Extremo", g.p_ext, 1)]:
    for k in range(cant):
        w, h = curvas(p, idx, n, (0, y)); rotulo(n, -18, y + h / 2, c_txt); y += h + 8
rotulo("CORTE MDF 3 mm (definitivo)", 100, y + 8, c_txt)
idx = capa("Corte MDF - pruebas", (255, 0, 255)); y, x0 = 110.0, 290.0
for n, p, cant in [("Esquina de la bisagra", g.mini, 2), ("Lomo corto", g.mini_lomo, 1),
                   ("Calibre de holguras (-0,1 / 0 / +0,1)", g.cal, 1), ("Extremo real", g.p_ext, 1)]:
    for k in range(cant):
        w, h = curvas(p, idx, n, (x0, y)); rotulo(n, x0 + w + 30, y + h / 2, c_txt); y += h + 8
rotulo("CORTE MDF 3 mm (pruebas)", x0 + 50, y + 8, c_txt)

salida = os.path.join(g.aqui, "estuche_navaja.3dm")
modelo.Write(salida, 7)
print("escrito", salida, f"{os.path.getsize(salida) / 1e6:.1f} MB, {len(modelo.Objects)} objetos, {len(modelo.Layers)} capas")
