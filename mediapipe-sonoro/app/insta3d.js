// Estética Insta3D para los lienzos (canvas): colores, tipografías, cubo isométrico y fondo de puntos.
window.I3D = (() => {
  const C = {
    negro: "#16150f", negro2: "#211f17", negro3: "#2c2a21", linea: "#38362b",
    verde: "#1a7a2e", verdeClaro: "#2fae4a", menta: "#8fe0a0",
    papel: "#f6f5f0", gris: "#a9a79b", naranjo: "#f26b1d", naranjoClaro: "#ffa66b",
  };
  // Serie para distinguir cosas (pistas, acordes, pinceles): verdes, naranjos y papel
  const SERIE = [C.verdeClaro, C.naranjo, C.papel, C.menta, C.naranjoClaro, "#5fcf75", "#d9d7cc"];
  const COND = "'Barlow Condensed', 'Arial Narrow', sans-serif";
  const TEXTO = "Inter, system-ui, -apple-system, sans-serif";
  const cond = (px, w = 700) => `${w} ${px}px ${COND}`;
  const texto = (px, w = 500) => `${w} ${px}px ${TEXTO}`;

  const patCache = new Map();
  function dotPattern(ctx, color, step, r) {
    const key = color + step + r;
    if (!patCache.has(key)) {
      const c = document.createElement("canvas"); c.width = c.height = step;
      const g = c.getContext("2d"); g.fillStyle = color; g.beginPath(); g.arc(step / 2, step / 2, r, 0, 7); g.fill();
      patCache.set(key, c);
    }
    return ctx.createPattern(patCache.get(key), "repeat");
  }
  const cubeFace = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 4;
    const g = c.getContext("2d"); g.fillStyle = C.verde; g.fillRect(0, 0, 4, 4);
    g.fillStyle = C.negro; g.beginPath(); g.arc(2, 2, 0.9, 0, 7); g.fill(); return c;
  })();

  // Cubo isométrico del logo (alto = h px)
  function cube(ctx, x, y, h) {
    const k = h / 46;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    poly([[20, 1], [39, 12], [39, 34], [20, 45], [1, 34], [1, 12]], C.negro);
    ctx.strokeStyle = "rgba(246,245,240,0.25)"; ctx.lineWidth = 1 / k; ctx.stroke();
    poly([[1, 12], [20, 1], [20, 14], [1, 25]], C.verde);
    const pat = ctx.createPattern(cubeFace, "repeat");
    poly([[1, 25], [20, 14], [39, 25], [20, 36]], pat);
    poly([[20, 36], [39, 25], [39, 34], [20, 45]], pat);
    ctx.restore();
  }

  // Fondo de puntos verdes (como la portada), más denso hacia la derecha
  function dots(ctx, W, H, alpha = 0.18) {
    ctx.save();
    ctx.fillStyle = dotPattern(ctx, `rgba(47,174,74,${alpha})`, 16, 1.6);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Título de marca: cubo + TÍTULO (última palabra en verde) + antetítulo con raya verde
  function title(ctx, x, y, text, sub, size = 30) {
    cube(ctx, x, y, size * 1.15);
    const words = text.toUpperCase().split(" ");
    const last = words.length > 1 ? words.pop() : null;
    ctx.save(); ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = cond(size); let tx = x + size * 1.4;
    ctx.fillStyle = C.papel; const first = words.join(" ") + (last ? " " : "");
    ctx.fillText(first, tx, y + 2); tx += ctx.measureText(first).width;
    if (last) { ctx.fillStyle = C.verdeClaro; ctx.fillText(last, tx, y + 2); }
    if (sub) {
      const sy = y + size * 1.15 + 8;
      ctx.fillStyle = C.verdeClaro; ctx.fillRect(x, sy + 5, 26, 3);
      ctx.font = cond(Math.round(size * 0.45), 600);
      if ("letterSpacing" in ctx) ctx.letterSpacing = "3px";
      ctx.fillText(sub.toUpperCase(), x + 34, sy);
    }
    ctx.restore();
  }

  return { C, SERIE, COND, TEXTO, cond, texto, cube, dots, title };
})();
