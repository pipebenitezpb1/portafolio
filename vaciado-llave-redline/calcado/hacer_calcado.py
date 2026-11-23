"""Foto de la llave alineada con el modelo y calcado del contorno encima.

Necesita contorno_px.npy (contorno detectado en la foto, en pixeles) y la foto original.
Escala: 11,4 px/mm, medida en las marcas de milimetros de la mordaza.
Salidas (10 px por mm; la imagen cubre 240 x 100 mm):
    foto_alineada.png   foto girada y escalada al sistema de coordenadas del modelo
    calcado.png         la misma foto con el calcado y el vaciado dibujados encima
    contorno_llave.svg  el calcado como curva, 1:1 en mm
"""
import json, os
import numpy as np, cv2
from shapely.geometry import Polygon
aqui = os.path.dirname(os.path.abspath(__file__))
PX_MM, K = 11.4, 10                      # escala de la foto y resolucion de salida (px por mm)
U0, V0, ANCHO, ALTO = -20.0, -25.0, 240.0, 100.0
foto = cv2.imread(os.path.join(aqui, "foto_original.jpg"))
c = np.load(os.path.join(aqui, "contorno_px.npy")).astype(float)

# misma transformacion que se uso para pasar el contorno a milimetros
p = c / PX_MM; p[:, 1] *= -1
(cx, cy), (w, h), ang = cv2.minAreaRect(p.astype(np.float32))
if w < h: ang += 90
t = np.deg2rad(-ang); R = np.array([[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]])
q = (p - [cx, cy]) @ R.T
sg = -1.0 if np.ptp(q[q[:, 0] < 0][:, 1]) > np.ptp(q[q[:, 0] > 0][:, 1]) else 1.0
q *= sg; d = q.min(0); q -= d
# pixel de la foto -> mm del modelo:  mm = A @ px + b
A = sg * R @ np.diag([1 / PX_MM, -1 / PX_MM]); b = -sg * R @ np.array([cx, cy]) - d
# mm -> pixel de la imagen de salida (v hacia arriba)
S = np.array([[K, 0], [0, -K]]); s0 = np.array([-U0 * K, (V0 + ALTO) * K])
M = np.c_[S @ A, S @ b + s0]
alineada = cv2.warpAffine(foto, M, (int(ANCHO * K), int(ALTO * K)), flags=cv2.INTER_LANCZOS4, borderValue=(255, 255, 255))
cv2.imwrite(os.path.join(aqui, "foto_alineada.png"), alineada)

def px(poly): return np.round(np.array(poly) @ S.T + s0).astype(np.int32)
suave = Polygon(json.load(open(os.path.join(aqui, "..", "version-navaja", "contorno_mm.json"))))
vaciado = suave.buffer(1.0)
img = cv2.addWeighted(alineada, 0.75, np.full_like(alineada, 255), 0.25, 0)
cv2.polylines(img, [px(q)], True, (0, 200, 255), 2, cv2.LINE_AA)                      # contorno detectado en la foto
cv2.polylines(img, [px(vaciado.exterior.coords)], True, (255, 120, 0), 3, cv2.LINE_AA) # vaciado (+1,0 mm)
cv2.polylines(img, [px(suave.exterior.coords)], True, (0, 0, 230), 4, cv2.LINE_AA)     # calcado suavizado
# regla usada para la escala: 20 marcas de 1 mm sobre la mordaza
r0 = A @ np.array([1850 + 600 / 4, 560 + 290 / 4]) + b
dr = A @ np.array([400 / 4, 840 / 4]); dr /= np.hypot(*dr); nrm = np.array([-dr[1], dr[0]])
for i in range(21):
    a_ = r0 + dr * i + nrm * 1.0; b_ = a_ + nrm * (3.0 if i % 10 == 0 else 1.6)
    cv2.line(img, tuple(px([a_])[0]), tuple(px([b_])[0]), (0, 160, 0), 3, cv2.LINE_AA)
f = cv2.FONT_HERSHEY_SIMPLEX
for txt, col, yy in [("Calcado suavizado (contorno de la llave)", (0, 0, 230), 40), ("Vaciado = calcado + 1,0 mm de holgura", (255, 120, 0), 80),
                     ("Contorno detectado en la foto", (0, 160, 220), 120), ("Regla de la mordaza: 20 mm = 228 px  ->  11,4 px/mm", (0, 160, 0), 160)]:
    cv2.putText(img, txt, (30, yy), f, 1.0, col, 2, cv2.LINE_AA)
x0, x1 = px([[0, -12]])[0], px([[200, -12]])[0]
cv2.arrowedLine(img, tuple(x0), tuple(x1), (60, 60, 60), 2, cv2.LINE_AA, tipLength=0.01); cv2.arrowedLine(img, tuple(x1), tuple(x0), (60, 60, 60), 2, cv2.LINE_AA, tipLength=0.01)
cv2.putText(img, "200,0 mm", (int((x0[0] + x1[0]) / 2) - 80, x0[1] + 40), f, 1.0, (60, 60, 60), 2, cv2.LINE_AA)
cv2.imwrite(os.path.join(aqui, "calcado.png"), img)
co = np.array(suave.exterior.coords); bx = suave.bounds
open(os.path.join(aqui, "contorno_llave.svg"), "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{bx[2] + 10:.2f}mm" height="{bx[3] + 10:.2f}mm" viewBox="-5 -5 {bx[2] + 10:.2f} {bx[3] + 10:.2f}">'
    f'<path fill="none" stroke="red" stroke-width="0.2" d="M' + " L".join(f"{x:.2f},{bx[3] - y:.2f}" for x, y in co) + ' Z"/></svg>')
print("origen del modelo (0,0) en el pixel", px([[0, 0]])[0], "de foto_alineada.png;", f"{ANCHO:g} x {ALTO:g} mm a {K} px/mm")

# foto para usar como lienzo (canvas) en Fusion: dos cruces a 200 mm exactos para calibrarla,
# en los puntos (0, 0) y (200, 0) del modelo
lz = alineada.copy()
for u, txt in [(0, "(0,0)"), (200, "(200,0)")]:
    cx_, cy_ = px([[u, 0]])[0]
    cv2.line(lz, (cx_ - 40, cy_), (cx_ + 40, cy_), (0, 0, 255), 2, cv2.LINE_AA); cv2.line(lz, (cx_, cy_ - 40), (cx_, cy_ + 40), (0, 0, 255), 2, cv2.LINE_AA)
    cv2.circle(lz, (cx_, cy_), 12, (0, 0, 255), 2, cv2.LINE_AA)
    cv2.putText(lz, txt, (cx_ - 60, cy_ + 80), f, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
cv2.putText(lz, "Calibrar: 200 mm entre las dos cruces", (px([[55, 0]])[0][0], px([[0, -14]])[0][1]), f, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
cv2.imwrite(os.path.join(aqui, "foto_para_lienzo.png"), lz)
