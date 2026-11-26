"""Dibuja sobre la foto alineada las medidas de la llave que hay que tomar con regla o pie de metro."""
import json, os
import numpy as np, cv2
from shapely.geometry import Polygon, LineString
aqui = os.path.dirname(os.path.abspath(__file__))
img = cv2.imread(os.path.join(aqui, "foto_alineada.png"))
img = cv2.addWeighted(img, 0.8, np.full_like(img, 255), 0.2, 0)
img = cv2.copyMakeBorder(img, 0, 260, 0, 0, cv2.BORDER_CONSTANT, value=(255, 255, 255))
h = Polygon(json.load(open(os.path.join(aqui, "..", "version-navaja", "contorno_mm.json"))))
P = lambda u, v: (int(round(200 + 10 * u)), int(round(750 - 10 * v)))
def ancho(u):
    g = h.intersection(LineString([(u, -50), (u, 120)])); return g.bounds[1], g.bounds[3]
F = cv2.FONT_HERSHEY_SIMPLEX
def cota(a, b, letra, col, dl=(12, -12)):
    cv2.arrowedLine(img, P(*a), P(*b), col, 4, cv2.LINE_AA, tipLength=0.04 if np.hypot(b[0] - a[0], b[1] - a[1]) > 60 else 0.12)
    cv2.arrowedLine(img, P(*b), P(*a), col, 4, cv2.LINE_AA, tipLength=0.04 if np.hypot(b[0] - a[0], b[1] - a[1]) > 60 else 0.12)
    m = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); o = (m[0] + dl[0], m[1] + dl[1])
    cv2.circle(img, (o[0] + 16, o[1] - 14), 26, (255, 255, 255), -1, cv2.LINE_AA); cv2.circle(img, (o[0] + 16, o[1] - 14), 26, col, 3, cv2.LINE_AA)
    cv2.putText(img, letra, (o[0] + 2, o[1]), F, 1.3, col, 3, cv2.LINE_AA)
def guia(a, b, col): cv2.line(img, P(*a), P(*b), col, 2, cv2.LINE_AA)
x0, y0, x1, y1 = h.bounds
ROJO, AZUL, VERDE, MOR = (40, 40, 220), (200, 90, 0), (0, 140, 0), (160, 0, 160)
# A largo total
guia((x0, y0 - 3), (x0, -14), ROJO); guia((x1, 20), (x1, -14), ROJO); cota((x0, -11), (x1, -11), "A", ROJO, (0, 60))
# B ancho total (con el lado del mango apoyado en una regla)
up = max(np.arange(140, 180, 0.5), key=lambda u: ancho(u)[1])
guia((up, y1), (up - 40, y1), AZUL); guia((185, y0), (up - 40, y0), AZUL); cota((up - 34, y0), (up - 34, y1), "B", AZUL, (-70, 0))
# C ancho del mango, D diametro de la corona, E ancho del cuello
a = ancho(70); cota((70, a[0]), (70, a[1]), "C", VERDE, (16, 10))
a = ancho(13); cota((13, a[0]), (13, a[1]), "D", MOR, (-70, 10))
a = ancho(126); cota((126, a[0]), (126, a[1]), "E", VERDE, (16, 10))
# F y G: desde la punta de la corona hasta donde empieza y termina la goma del mango
guia((23, 30), (23, 62), MOR); guia((109, 34), (109, 62), MOR); guia((x0, 30), (x0, 62), MOR)
cota((x0, 52), (23, 52), "F", MOR, (-10, -22)); cota((x0, 60), (109, 60), "G", MOR, (0, -22))
# H: desde la punta de la mordaza hasta el punto mas alto de la cabeza
guia((x1, 30), (x1, 62), ROJO); guia((up, y1), (up, 62), ROJO); cota((up, 58), (x1, 58), "H", ROJO, (0, -22))
txt = ["A  largo total, de punta a punta (mordaza cerrada)", "B  ancho total: mango apoyado en una regla, hasta el punto mas alto de la cabeza",
       "C  ancho maximo del mango de goma        D  diametro exterior de la corona        E  ancho del cuello metalico",
       "F  de la punta de la corona al inicio de la goma        G  de la punta de la corona al final de la goma",
       "H  de la punta de la mordaza al punto mas alto de la cabeza",
       "Grosor (de canto, no se ve en la foto):   T1  mango de goma        T2  cabeza        T3  corona"]
for i, t_ in enumerate(txt): cv2.putText(img, t_, (40, 1040 + 38 * i), F, 0.95, (30, 30, 30), 2, cv2.LINE_AA)
cv2.imwrite(os.path.join(aqui, "medidas_a_tomar.png"), img)
print("valores que usa hoy el modelo (mm), escalados a 207 x 53:")
kx, ky = 207 / x1, 53 / y1
for n, v in [("A", x1 * kx), ("B", y1 * ky), ("C", (ancho(70)[1] - ancho(70)[0]) * ky), ("D", (ancho(13)[1] - ancho(13)[0]) * ky), ("E", (ancho(126)[1] - ancho(126)[0]) * ky),
             ("F", 23 * kx), ("G", 109 * kx), ("H", (x1 - up) * kx)]: print(f"  {n} = {v:.1f}")
