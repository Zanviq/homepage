// Procedural paper textures — a plain-JS port of frontend/src/lib/card/paper.ts,
// tinted for lavender stock. Each kind is a seamless tile: white where the
// tooth catches light from the upper left, plum-dark where it falls away.
//   Paper.apply({ "--tex-paper": "paper", "--tex-cotton": "cotton", ... })
(function () {
  const T = 256;
  const RECIPES = {
    paper: { seed: 11, grain: [[128, 0.45], [64, 0.35], [32, 0.2], [8, 0.1]], fibres: { count: 120, len: [4, 14], width: [0.5, 1], weight: 0.45 }, bump: 0.55, gain: 0.8, mottle: 0.03 },
    cotton: { seed: 23, grain: [[64, 0.3], [32, 0.45], [16, 0.35], [4, 0.2]], fibres: { count: 300, len: [8, 30], width: [0.6, 1.4], weight: 0.5 }, bump: 0.5, gain: 0.85, mottle: 0.06 },
    laid: { seed: 5, grain: [[128, 0.3], [32, 0.2]], fibres: { count: 80, len: [6, 18], width: [0.5, 0.9], weight: 0.3 }, laid: true, bump: 0.5, gain: 0.7, mottle: 0.04 },
    felt: { seed: 41, grain: [[64, 0.5], [32, 0.4], [16, 0.2]], fibres: { count: 500, len: [6, 22], width: [0.5, 1.1], weight: 0.6 }, bump: 0.4, gain: 0.6, mottle: 0.1 },
  };

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function addNoise(out, cx, cy, amp, rand) {
    const lat = new Float32Array(cx * cy);
    for (let i = 0; i < lat.length; i++) lat[i] = rand() * 2 - 1;
    for (let y = 0; y < T; y++) {
      const fy = (y / T) * cy, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      const r0 = (y0 % cy) * cx, r1 = ((y0 + 1) % cy) * cx;
      for (let x = 0; x < T; x++) {
        const fx = (x / T) * cx, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const c0 = x0 % cx, c1 = (x0 + 1) % cx;
        const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx;
        const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
        out[y * T + x] += (a + (b - a) * sy) * amp;
      }
    }
  }

  function fibreMap(f, rand) {
    const c = document.createElement("canvas");
    c.width = c.height = T;
    const g = c.getContext("2d");
    g.lineCap = "round";
    for (let i = 0; i < f.count; i++) {
      const x = rand() * T, y = rand() * T, ang = rand() * Math.PI * 2;
      const len = f.len[0] + rand() * (f.len[1] - f.len[0]);
      const bend = (rand() - 0.5) * len * 0.7;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      const mx = (x + x2) / 2 - Math.sin(ang) * bend, my = (y + y2) / 2 + Math.cos(ang) * bend;
      g.lineWidth = f.width[0] + rand() * (f.width[1] - f.width[0]);
      g.strokeStyle = `rgba(255,255,255,${0.35 + rand() * 0.65})`;
      for (const ox of [-T, 0, T])
        for (const oy of [-T, 0, T]) {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.quadraticCurveTo(mx + ox, my + oy, x2 + ox, y2 + oy);
          g.stroke();
        }
    }
    const px = g.getImageData(0, 0, T, T).data;
    const out = new Float32Array(T * T);
    for (let i = 0; i < out.length; i++) out[i] = px[i * 4 + 3] / 255;
    return out;
  }

  function build(r, strength) {
    const rand = rng(r.seed);
    const h = new Float32Array(T * T);
    for (const [cells, amp] of r.grain) addNoise(h, cells, cells, amp, rand);
    if (r.laid) {
      // laid paper: fine horizontal wires, a chain line every quarter tile
      for (let y = 0; y < T; y++)
        for (let x = 0; x < T; x++) {
          const d = Math.abs(((x + 32) % 64) - 32);
          h[y * T + x] += 0.28 * Math.cos((2 * Math.PI * y) / 4) + (d < 2 ? 0.5 * (1 - d / 2) : 0);
        }
    }
    const fib = fibreMap(r.fibres, rand);
    for (let i = 0; i < h.length; i++) h[i] += fib[i] * r.fibres.weight;
    const mottle = new Float32Array(T * T);
    addNoise(mottle, 4, 4, 0.6, rand);
    addNoise(mottle, 8, 8, 0.4, rand);

    let lx = -0.55, ly = -0.65, lz = 0.52;
    const ln = Math.hypot(lx, ly, lz);
    lx /= ln; ly /= ln; lz /= ln;
    const img = new ImageData(T, T);
    const d = img.data;
    for (let y = 0; y < T; y++) {
      const yu = ((y - 1 + T) % T) * T, yd = ((y + 1) % T) * T;
      for (let x = 0; x < T; x++) {
        const xl = (x - 1 + T) % T, xr = (x + 1) % T;
        const gx = (h[y * T + xr] - h[y * T + xl]) * r.bump;
        const gy = (h[yd + x] - h[yu + x]) * r.bump;
        const lit = (-gx * lx - gy * ly + lz) / Math.hypot(gx, gy, 1);
        const v = (lit - lz) * r.gain + mottle[y * T + x] * r.mottle;
        const o = (y * T + x) * 4;
        if (v >= 0) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; }
        else { d[o] = 30; d[o + 1] = 29; d[o + 2] = 44; }
        d[o + 3] = Math.min(255, Math.abs(v) * 255 * strength);
      }
    }
    const c = document.createElement("canvas");
    c.width = c.height = T;
    c.getContext("2d").putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  const cache = {};
  window.Paper = {
    url(kind, strength = 1) {
      const key = kind + strength;
      if (!cache[key]) cache[key] = build(RECIPES[kind], strength);
      return cache[key];
    },
    /** Sets CSS custom properties on :root to url(...) textures: { "--tex": ["paper", 0.6] }. */
    apply(map) {
      for (const [prop, spec] of Object.entries(map)) {
        const [kind, strength] = Array.isArray(spec) ? spec : [spec, 1];
        document.documentElement.style.setProperty(prop, `url(${this.url(kind, strength)})`);
      }
    },
  };
})();
