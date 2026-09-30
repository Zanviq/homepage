// Business-card stage — a plain-JS port of frontend/src/components/card/CardStage.tsx.
// While the tall stage scrolls by, the card plays its choreography (tilt, flip,
// light); past the stage it flies into the bottom-right corner and stays there,
// flipping on click and leaning toward the pointer. Themes hook in with
//   pose(p, base) -> base   : extra offsets for the card (x/y in card sizes)
//   frame(state)            : animate props around the card (envelope, stack…)
(function () {
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const DOCK_MS = 650;

  // light from the upper left, slightly in front
  const L = (() => { const v = [-0.38, -0.5, 0.78]; const n = Math.hypot(...v); return v.map((c) => c / n); })();
  function faceLight(rx, ry, face) {
    const a = (rx * Math.PI) / 180, b = (ry * Math.PI) / 180, s = face === "front" ? 1 : -1;
    const n = [s * Math.sin(b), -s * Math.cos(b) * Math.sin(a), s * Math.cos(b) * Math.cos(a)];
    const lit = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    const turn = face === "front" ? Math.sin(b) : -Math.sin(b);
    return { tone: lit - L[2], hx: 30 - turn * 70, hy: 22 + Math.sin(a) * 70 };
  }
  const faceAt = (ry) => { const a = ((ry % 360) + 360) % 360; return a > 90 && a < 270 ? "back" : "front"; };

  window.CardStage = function mount(o) {
    const cfg = Object.assign(
      { tilt: 10, flipStart: 0.36, flipEnd: 0.64, scaleFrom: 0.9, scaleTo: 1, smoothing: 0.15, dockWidth: 260, light: 0.55, shine: "255,252,255", shade: "30,20,52" },
      o
    );
    const { stage, layer, slot, fly, card, hint } = o;
    const faces = [...card.querySelectorAll(":scope > .face")];
    const lights = faces.map((f) => f.querySelector(".light"));

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stage.classList.add("is-static");
      cfg.frame && cfg.frame({ p: 1, t: 0, static: true });
      return () => {};
    }

    const basePose = (p) => {
      const flip = 180 * smooth(cfg.flipStart, cfg.flipEnd, p);
      const env = Math.sin(Math.PI * clamp01(p));
      const b = {
        rx: cfg.tilt * (0.6 - p) * 0.9 * (0.4 + env * 0.6),
        ry: flip + cfg.tilt * 0.6 * env * 0.4,
        rz: -cfg.tilt * 0.25 * (1 - smooth(0, 0.5, p)),
        sc: lerp(cfg.scaleFrom, cfg.scaleTo, smooth(0, 0.35, p)),
        x: 0, y: 0,
      };
      return cfg.pose ? cfg.pose(p, b) : b;
    };
    const endsOnBack = faceAt(basePose(1).ry) === "back";

    const s = { init: false, ys: 0, t: 0, docked: false, spin: 0, spinV: 0, spinTo: 0, hx: 0, hy: 0, tx: 0, ty: 0, hov: 0, hovTo: 0, press: 0, pressTo: 0 };
    let geo = { dx: 0, dy: 0, s: 0.3 };
    const measure = () => {
      const vw = layer.clientWidth, vh = layer.clientHeight;
      const r = slot.getBoundingClientRect();
      const aspect = r.width / Math.max(1, r.height);
      const w = Math.min(cfg.dockWidth, vw * 0.38);
      const h = w / aspect;
      const m = vw < 640 ? 14 : 28;
      geo = { dx: vw - m - w / 2 - 4 - (r.left + r.width / 2), dy: vh - m - h / 2 - 4 - (r.top + r.height / 2), s: w / Math.max(1, r.width) };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(layer);
    ro.observe(slot);

    let raf = 0, last = performance.now(), prevKey = "", docked = false;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const y = window.scrollY;
      const vh = layer.clientHeight || innerHeight;
      const top = stage.getBoundingClientRect().top + y;
      const span = Math.max(1, stage.offsetHeight - vh);
      const past = y - (top + span);

      if (!s.docked && past > vh * 0.05) s.docked = true;
      else if (s.docked && past < -vh * 0.02) s.docked = false;
      if (!s.init) { s.init = true; s.ys = y; s.t = s.docked ? 1 : 0; }

      const tau = 0.02 + clamp01(cfg.smoothing) * 0.3;
      s.ys += (y - s.ys) * (1 - Math.exp(-dt / tau));
      if (Math.abs(y - s.ys) < 0.3) s.ys = y;
      const p = clamp01((s.ys - top) / span);
      const step = (dt * 1000) / DOCK_MS;
      s.t = s.docked ? Math.min(1, s.t + step) : Math.max(0, s.t - step);

      if (!s.docked) s.spinTo = Math.round(s.spinTo / 360) * 360;
      const w = 9, z = 0.62;
      s.spinV += (w * w * (s.spinTo - s.spin) - 2 * z * w * s.spinV) * dt;
      s.spin += s.spinV * dt;
      if (Math.abs(s.spinTo - s.spin) < 0.05 && Math.abs(s.spinV) < 0.05) { s.spin = s.spinTo; s.spinV = 0; }
      const lift = Math.sin(Math.PI * clamp01(1 - Math.abs(s.spinTo - s.spin) / 180));
      if (s.docked && s.hovTo === 0) { s.tx = 0; s.ty = 0; }
      const kh = 1 - Math.exp(-dt / 0.12);
      s.hx += (s.tx - s.hx) * kh;
      s.hy += (s.ty - s.hy) * kh;
      s.hov += (s.hovTo - s.hov) * (1 - Math.exp(-dt / 0.1));
      s.press += (s.pressTo - s.press) * (1 - Math.exp(-dt / 0.05));

      const t = s.t;
      const b = basePose(p);
      const arc = Math.sin(Math.PI * t);
      const k = lerp(1, 1.8, t);
      const rx = b.rx * (1 - t) + arc * 14 - s.hy * 6 * k;
      const ry = b.ry + (endsOnBack ? 180 * ease(win(t, 0.12, 0.85)) : 0) + s.spin + s.hx * 8 * k;
      const rz = lerp(b.rz, -2.5 * (1 - s.hov), t) - arc * 10;
      const sc = b.sc * (1 + 0.1 * lift + t * (0.05 * s.hov - 0.04 * s.press));
      const off = 1 - ease(win(t, 0, 0.5));
      const key = [p, t, rx, ry, rz, sc].map((v) => v.toFixed(3)).join();
      if (key !== prevKey) {
        prevKey = key;
        fly.style.transform = `translate3d(${geo.dx * ease(win(t, 0, 0.9))}px, ${geo.dy * ease(win(t, 0.1, 1))}px, 0) scale(${lerp(1, geo.s, ease(win(t, 0, 0.7)))})`;
        card.style.transform = `translate(${b.x * off * 100}%, ${b.y * off * 100}%) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${sc})`;
        card.style.setProperty("--ry", ry.toFixed(2));
        card.style.setProperty("--rx", rx.toFixed(2));
        faces.forEach((f, i) => {
          if (!lights[i]) return;
          const lf = faceLight(rx, ry, f.classList.contains("back") ? "back" : "front");
          const a = cfg.light;
          lights[i].style.background = `radial-gradient(130% 100% at ${lf.hx}% ${lf.hy}%, rgba(${cfg.shine},${a * (0.1 + Math.max(0, lf.tone) * 0.7)}) 0%, rgba(${cfg.shine},0) 62%), rgba(${cfg.shade},${a * Math.max(0, -lf.tone) * 0.8})`;
        });
        const showing = faceAt(ry);
        faces.forEach((f) => f.classList.toggle("showing", f.classList.contains(showing)));
        if (hint) hint.style.opacity = String(Math.max(0, 1 - p * 5) * (1 - t));
        cfg.frame && cfg.frame({ p, t, docked: s.docked, rx, ry });
      }
      if (s.docked !== docked) {
        docked = s.docked;
        fly.classList.toggle("docked", docked);
        fly.tabIndex = docked ? 0 : -1;
        fly.setAttribute("role", docked ? "button" : "presentation");
        if (docked) fly.setAttribute("aria-label", cfg.flipLabel || "Flip");
        else fly.removeAttribute("aria-label");
      }
      fly.style.pointerEvents = docked || t === 0 ? "auto" : "none";
    };
    raf = requestAnimationFrame(tick);

    const onMove = (e) => {
      if (e.pointerType !== "mouse" || s.docked) return;
      s.tx = (e.clientX / innerWidth - 0.5) * 2;
      s.ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    const flip = () => { s.spinTo += 180; };
    const onClick = () => docked && flip();
    const onKey = (e) => { if (docked && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); flip(); } };
    const onFlyMove = (e) => {
      if (!docked || e.pointerType !== "mouse") return;
      const r = fly.getBoundingClientRect();
      s.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      s.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      s.hovTo = 1;
    };
    const onLeave = () => { s.hovTo = 0; s.pressTo = 0; };
    const onDown = () => { if (docked) s.pressTo = 1; };
    const onUp = () => { s.pressTo = 0; };
    addEventListener("pointermove", onMove, { passive: true });
    fly.addEventListener("click", onClick);
    fly.addEventListener("keydown", onKey);
    fly.addEventListener("pointermove", onFlyMove);
    fly.addEventListener("pointerleave", onLeave);
    fly.addEventListener("pointerdown", onDown);
    fly.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
    };
  };
  window.CardStage.smooth = smooth;
  window.CardStage.win = win;
  window.CardStage.ease = ease;
})();
