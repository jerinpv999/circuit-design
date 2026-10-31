/* Copperline core: units, geometry helpers, stroke font */
(function (G) {
  const CL = (G.CL = G.CL || {});

  const PREFIX = { f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };
  const siCache = new Map();
  CL.parseSI = function (s) {
    if (typeof s === 'number') return s;
    if (s == null) return NaN;
    if (siCache.has(s)) return siCache.get(s);
    const str = String(s).trim();
    const m = str.match(/^([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*([a-zA-Zµμ]*)/);
    let v = NaN;
    if (m) {
      v = parseFloat(m[1]);
      const u = m[2];
      if (u) {
        if (/^meg/i.test(u)) v *= 1e6;
        else if (PREFIX[u[0]] !== undefined && !(u.length > 1 && /^(Hz|F|H)$/.test(u))) v *= PREFIX[u[0]];
      }
    }
    if (siCache.size > 5000) siCache.clear();
    siCache.set(s, v);
    return v;
  };

  CL.formatSI = function (v, unit = '', digits = 3) {
    if (!isFinite(v)) return '—';
    if (v === 0) return '0 ' + unit;
    const a = Math.abs(v);
    const tbl = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    for (const [s, p] of tbl) {
      if (a >= s * 0.9995) {
        let n = v / s;
        const str = Math.abs(n) >= 100 ? n.toFixed(Math.max(0, digits - 3)) : Math.abs(n) >= 10 ? n.toFixed(Math.max(0, digits - 2)) : n.toFixed(Math.max(0, digits - 1));
        return str + ' ' + p + unit;
      }
    }
    return v.toExponential(2) + ' ' + unit;
  };

  CL.uid = (() => { let n = Date.now() % 100000; return (p = 'id') => p + (n++).toString(36); })();

  CL.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* distance from point to segment */
  CL.distPtSeg = function (px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy;
    let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const x = ax + t * dx, y = ay + t * dy;
    return Math.hypot(px - x, py - y);
  };
  function segInter(a, b, c, d) {
    const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  CL.distSegSeg = function (a, b, c, d) {
    if (segInter(a, b, c, d)) return 0;
    return Math.min(
      CL.distPtSeg(a[0], a[1], c[0], c[1], d[0], d[1]),
      CL.distPtSeg(b[0], b[1], c[0], c[1], d[0], d[1]),
      CL.distPtSeg(c[0], c[1], a[0], a[1], b[0], b[1]),
      CL.distPtSeg(d[0], d[1], a[0], a[1], b[0], b[1])
    );
  };

  /* rotate a point by quarter turns; screen coords (y down), clockwise */
  CL.rotQ = function (x, y, r) {
    r = ((r % 4) + 4) % 4;
    if (r === 0) return [x, y];
    if (r === 1) return [-y, x];
    if (r === 2) return [-x, -y];
    return [y, -x];
  };

  /* ---------- stroke font (4 x 6 cell, y down) ---------- */
  const GLYPHS = {
    '0': '0,0 4,0 4,6 0,6 0,0;0,6 4,0', '1': '1,1 2,0 2,6;1,6 3,6', '2': '0,1 1,0 3,0 4,1 4,2 0,6 4,6',
    '3': '0,0 4,0 2,2.5 3,2.5 4,3.5 4,5 3,6 1,6 0,5', '4': '3,6 3,0 0,4 4,4', '5': '4,0 0,0 0,2.5 3,2.5 4,3.5 4,5 3,6 0,6',
    '6': '3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3.5 3,2.5 0,2.5', '7': '0,0 4,0 1.5,6',
    '8': '1,0 3,0 4,1 4,2 3,3 1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3;1,3 0,2 0,1 1,0', '9': '4,3.5 1,3.5 0,2.5 0,1 1,0 3,0 4,1 4,5 3,6 1,6',
    A: '0,6 0,2 2,0 4,2 4,6;0,3.5 4,3.5', B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3;0,0 3,0 4,1 4,2 3,3', C: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5',
    D: '0,0 0,6 2.5,6 4,4.5 4,1.5 2.5,0 0,0', E: '4,0 0,0 0,6 4,6;0,3 3,3', F: '4,0 0,0 0,6;0,3 3,3',
    G: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3.5 2,3.5', H: '0,0 0,6;4,0 4,6;0,3 4,3', I: '1,0 3,0;2,0 2,6;1,6 3,6',
    J: '4,0 4,5 3,6 1,6 0,5', K: '0,0 0,6;4,0 0,3.5;1.3,2.7 4,6', L: '0,0 0,6 4,6', M: '0,6 0,0 2,3 4,0 4,6',
    N: '0,6 0,0 4,6 4,0', O: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0', P: '0,6 0,0 3,0 4,1 4,2 3,3 0,3',
    Q: '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0;2.5,4.5 4,6', R: '0,6 0,0 3,0 4,1 4,2 3,3 0,3;2,3 4,6',
    S: '4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5', T: '0,0 4,0;2,0 2,6', U: '0,0 0,5 1,6 3,6 4,5 4,0',
    V: '0,0 2,6 4,0', W: '0,0 1,6 2,3 3,6 4,0', X: '0,0 4,6;4,0 0,6', Y: '0,0 2,3 4,0;2,3 2,6', Z: '0,0 4,0 0,6 4,6',
    '-': '1,3 3,3', '+': '1,3 3,3;2,2 2,4', '.': '1.8,5.6 2.2,5.6 2.2,6 1.8,6 1.8,5.6', '_': '0,6 4,6', '/': '0,6 4,0',
    '$': '4,1 3,0.5 1,0.5 0,1.5 1,3 3,3 4,4.5 3,5.5 1,5.5 0,5;2,0 2,6', ':': '2,1.5 2,2;2,4.5 2,5', '(': '3,0 2,1 2,5 3,6', ')': '1,0 2,1 2,5 1,6',
    '=': '1,2 3,2;1,4 3,4', '#': '1,0 1,6;3,0 3,6;0,2 4,2;0,4 4,4', ' ': ''
  };
  const parsed = {};
  for (const k in GLYPHS) parsed[k] = GLYPHS[k] ? GLYPHS[k].split(';').map(s => s.trim().split(/\s+/).map(p => p.split(',').map(Number))) : [];
  /* returns polylines in mm; (x,y) is the anchor, align 'c' centered both ways */
  CL.strokeText = function (text, x, y, h, align = 'c') {
    const s = h / 6, adv = 5.5 * s;
    const str = String(text).toUpperCase();
    const w = str.length * adv - 1.5 * s;
    let ox = align === 'c' ? x - w / 2 : align === 'r' ? x - w : x;
    const oy = y - h / 2;
    const out = [];
    for (const ch of str) {
      const g = parsed[ch] || parsed['#'];
      for (const pl of g) out.push(pl.map(([gx, gy]) => [ox + gx * s, oy + gy * s]));
      ox += adv;
    }
    return out;
  };
  CL.textWidth = (text, h) => String(text).length * 5.5 * (h / 6) - 1.5 * (h / 6);
})(typeof window !== 'undefined' ? window : globalThis);
