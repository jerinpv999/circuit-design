/* Copperline PCB: pads, connectivity, ratsnest, DRC, maze autorouter, layered renderer */
(function (G) {
  const CL = (G.CL = G.CL || {});

  CL.LAYER_COLORS = {
    'F.Cu': '#e2603c', 'In1.Cu': '#d8b23a', 'In2.Cu': '#a35ad6', 'B.Cu': '#3f86e6',
    'F.SilkS': '#efe9d6', 'B.SilkS': '#b8a6f0', 'F.Mask': '#c74b8c', 'B.Mask': '#4bb4a0', 'Edge.Cuts': '#f2c94c', 'Drill': '#8b97a3'
  };
  CL.copperLayers = board => (board.layers === 4 ? ['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu'] : ['F.Cu', 'B.Cu']);
  CL.defaultBoard = () => ({ w: 80, h: 55, layers: 2, thickness: 1.6, traceWidth: 0.3, clearance: 0.2, viaD: 0.8, viaDrill: 0.4,
    mask: '#1d6b45', silk: '#f4f4ef', finish: 'ENIG', pour: { 'B.Cu': 'GND' }, traces: [], vias: [] });

  /* place any component that has a footprint but no pcb position, in a staging column right of the board */
  CL.ensurePlacement = function (p) {
    const B = p.board;
    let sx = B.w + 6, sy = 4, colW = 0;
    for (const c of p.components) {
      const d = CL.DEFS[c.type];
      if (!d || !d.fp) { if (c.pcb) delete c.pcb; continue; }
      if (c.pcb) continue;
      const fp = d.fp(c);
      const [w, h] = fp.size;
      if (sy + h > B.h + 30) { sy = 4; sx += colW + 3; colW = 0; }
      c.pcb = { x: +(sx + w / 2).toFixed(2), y: +(sy + h / 2).toFixed(2), rot: 0, side: 'F' };
      sy += h + 3; colW = Math.max(colW, w);
    }
    return p;
  };

  /* world-space pads with nets */
  CL.boardPads = function (p, nl) {
    nl = nl || CL.buildNetlist(p);
    const cu = CL.copperLayers(p.board);
    const pads = [];
    for (const c of p.components) {
      if (!c.pcb) continue;
      const fp = CL.footprint(c); if (!fp) continue;
      const nets = nl.pinNet.get(c.id) || [];
      for (const pd of fp.pads) {
        const [x, y] = CL.fpXform(c, pd.x, pd.y);
        const odd = (c.pcb.rot || 0) % 2 === 1;
        const net = pd.pin >= 0 ? nets[pd.pin] : (pd.hidden && nl.nets.has(pd.hidden) ? pd.hidden : (pd.hidden === 'VCC' && nl.nets.has('5V') ? '5V' : null));
        pads.push({ comp: c, ref: c.ref, num: pd.num, x, y, w: odd ? pd.h : pd.w, h: odd ? pd.w : pd.h, shape: pd.shape, drill: pd.drill,
          smd: !pd.drill, layers: pd.drill ? cu : [c.pcb.side === 'B' ? 'B.Cu' : 'F.Cu'], net, pin: pd.pin });
      }
    }
    return pads;
  };

  const inPad = (pd, x, y, grow = 0) => pd.shape === 'circle' ? Math.hypot(x - pd.x, y - pd.y) <= pd.w / 2 + grow
    : Math.abs(x - pd.x) <= pd.w / 2 + grow && Math.abs(y - pd.y) <= pd.h / 2 + grow;
  CL.inPad = inPad;
  /* capsule approximation of a pad */
  const padCapsule = pd => {
    if (pd.shape === 'circle' || Math.abs(pd.w - pd.h) < 1e-6) return { a: [pd.x, pd.y], b: [pd.x, pd.y], r: Math.min(pd.w, pd.h) / 2 };
    if (pd.w > pd.h) { const d = (pd.w - pd.h) / 2; return { a: [pd.x - d, pd.y], b: [pd.x + d, pd.y], r: pd.h / 2 }; }
    const d = (pd.h - pd.w) / 2; return { a: [pd.x, pd.y - d], b: [pd.x, pd.y + d], r: pd.w / 2 };
  };

  /* copper connectivity: returns { clusterOf(item), clusters } */
  CL.connectivity = function (p, pads) {
    const B = p.board;
    const items = [];
    pads.forEach(pd => items.push({ k: 'pad', o: pd }));
    B.traces.forEach(t => items.push({ k: 'tr', o: t }));
    B.vias.forEach(v => items.push({ k: 'via', o: v }));
    const par = items.map((_, i) => i);
    const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
    const nP = pads.length, nT = B.traces.length;
    for (let ti = 0; ti < nT; ti++) {
      const t = B.traces[ti], idx = nP + ti;
      for (let k = 0; k < t.pts.length; k++) {
        const [x, y] = t.pts[k];
        pads.forEach((pd, pi) => { if (pd.layers.includes(t.layer) && inPad(pd, x, y, t.w / 2 * 0.5)) uni(idx, pi); });
        B.vias.forEach((v, vi) => { if (Math.hypot(v.x - x, v.y - y) <= v.d / 2) uni(idx, nP + nT + vi); });
        if (k === 0 || k === t.pts.length - 1) {
          for (let tj = 0; tj < nT; tj++) {
            if (tj === ti) continue; const u = B.traces[tj]; if (u.layer !== t.layer) continue;
            for (let s = 1; s < u.pts.length; s++) if (CL.distPtSeg(x, y, u.pts[s - 1][0], u.pts[s - 1][1], u.pts[s][0], u.pts[s][1]) <= (u.w + t.w) / 4) { uni(idx, nP + tj); break; }
          }
        }
      }
    }
    B.vias.forEach((v, vi) => pads.forEach((pd, pi) => { if (!pd.smd && inPad(pd, v.x, v.y)) uni(nP + nT + vi, pi); }));
    return { items, find, nP, nT };
  };

  /* ratsnest + shorts */
  CL.analyze = function (p, nl) {
    nl = nl || CL.buildNetlist(p);
    const pads = CL.boardPads(p, nl);
    const con = CL.connectivity(p, pads);
    const byNet = new Map();
    pads.forEach((pd, i) => { if (!pd.net) return; if (!byNet.has(pd.net)) byNet.set(pd.net, []); byNet.get(pd.net).push(i); });
    const rats = [];
    for (const [net, idxs] of byNet) {
      if (idxs.length < 2) continue;
      const groups = new Map();
      idxs.forEach(i => { const r = con.find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(pads[i]); });
      const gl = [...groups.values()];
      if (gl.length < 2) continue;
      const inTree = [gl[0]], rest = gl.slice(1);
      while (rest.length) {
        let best = null;
        for (const g of inTree) for (let ri = 0; ri < rest.length; ri++) for (const a of g) for (const b of rest[ri]) {
          const d = Math.hypot(a.x - b.x, a.y - b.y); if (!best || d < best.d) best = { d, a, b, ri };
        }
        rats.push({ net, a: best.a, b: best.b, x1: best.a.x, y1: best.a.y, x2: best.b.x, y2: best.b.y });
        inTree.push(rest[best.ri]); rest.splice(best.ri, 1);
      }
    }
    // shorts: one copper cluster touching pads of different nets
    const clusterNets = new Map();
    pads.forEach((pd, i) => { if (!pd.net) return; const r = con.find(i); if (!clusterNets.has(r)) clusterNets.set(r, new Set()); clusterNets.get(r).add(pd.net); });
    const shorts = [];
    for (const [r, s] of clusterNets) if (s.size > 1) { const pd = pads.find((q, i) => con.find(i) === r); shorts.push({ nets: [...s], x: pd.x, y: pd.y }); }
    return { pads, rats, shorts, con, nl };
  };

  /* ---------- DRC ---------- */
  CL.runDRC = function (p, nl) {
    const B = p.board, clr = B.clearance;
    const an = CL.analyze(p, nl);
    const issues = [];
    an.shorts.forEach(s => issues.push({ sev: 'error', msg: `Short circuit between nets ${s.nets.join(' and ')}`, x: s.x, y: s.y }));
    const cu = CL.copperLayers(B);
    for (const layer of cu) {
      const shapes = [];
      an.pads.forEach(pd => { if (pd.layers.includes(layer)) { const c = padCapsule(pd); shapes.push({ net: pd.net, ...c, what: `${pd.ref}.${pd.num}` }); } });
      B.traces.forEach(t => { if (t.layer !== layer) return; for (let i = 1; i < t.pts.length; i++) shapes.push({ net: t.net, a: t.pts[i - 1], b: t.pts[i], r: t.w / 2, what: `track (${t.net})` }); });
      B.vias.forEach(v => shapes.push({ net: v.net, a: [v.x, v.y], b: [v.x, v.y], r: v.d / 2, what: `via (${v.net})` }));
      for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
        const s = shapes[i], q = shapes[j];
        if (s.net && s.net === q.net) continue;
        if (!s.net && !q.net) continue;
        const bx = Math.max(Math.min(s.a[0], s.b[0]) - s.r, Math.min(q.a[0], q.b[0]) - q.r), ex = Math.min(Math.max(s.a[0], s.b[0]) + s.r, Math.max(q.a[0], q.b[0]) + q.r);
        if (ex - bx < -clr) continue;
        const d = CL.distSegSeg(s.a, s.b, q.a, q.b) - s.r - q.r;
        if (d < clr - 1e-4) issues.push({ sev: d < 0 ? 'error' : 'warn', msg: `${layer}: ${s.what} to ${q.what} is ${Math.max(0, d).toFixed(3)} mm (min ${clr} mm)`, x: (s.a[0] + q.a[0]) / 2, y: (s.a[1] + q.a[1]) / 2 });
      }
    }
    const inside = (x, y, m) => x >= m && y >= m && x <= B.w - m && y <= B.h - m;
    an.pads.forEach(pd => { if (!inside(pd.x, pd.y, 0.3)) issues.push({ sev: 'warn', msg: `${pd.ref} pad ${pd.num} is outside the board outline`, x: pd.x, y: pd.y }); });
    B.traces.forEach(t => t.pts.forEach(([x, y]) => { if (!inside(x, y, 0.2)) issues.push({ sev: 'error', msg: `Track on ${t.layer} leaves the board outline`, x, y }); }));
    an.pads.forEach(pd => { if (pd.drill && Math.min(pd.w, pd.h) - pd.drill < 0.25) issues.push({ sev: 'warn', msg: `${pd.ref}.${pd.num}: annular ring below 0.125 mm`, x: pd.x, y: pd.y }); });
    an.rats.forEach(r => issues.push({ sev: 'warn', msg: `Unrouted: ${r.net} from ${r.a.ref}.${r.a.num} to ${r.b.ref}.${r.b.num}`, x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 }));
    return { issues: issues.slice(0, 400), an };
  };

  /* ---------- maze autorouter ---------- */
  class Heap {
    constructor() { this.k = []; this.v = []; }
    push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const pa = (i - 1) >> 1; if (k[pa] <= key) break; k[i] = k[pa]; v[i] = v[pa]; i = pa; } k[i] = key; v[i] = val; }
    pop() { const k = this.k, v = this.v; const top = v[0]; const lk = k.pop(), lv = v.pop(); const n = k.length; if (n) { let i = 0; while (true) { let l = 2 * i + 1; if (l >= n) break; if (l + 1 < n && k[l + 1] < k[l]) l++; if (k[l] >= lk) break; k[i] = k[l]; v[i] = v[l]; i = l; } k[i] = lk; v[i] = lv; } return top; }
    get size() { return this.k.length; }
  }
  CL.autoroute = function (p, opts = {}) {
    const B = p.board, res = opts.res || 0.25, tw = B.traceWidth, clr = B.clearance;
    const layers = CL.copperLayers(B);
    const L = layers.length, W = Math.ceil(B.w / res), H = Math.ceil(B.h / res), WH = W * H;
    const nl = CL.buildNetlist(p);
    const an = CL.analyze(p, nl);
    const netId = new Map(); let nid = 1;
    const idOf = n => { if (!n) return -1; if (!netId.has(n)) netId.set(n, nid++); return netId.get(n); };
    const occ = Array.from({ length: L }, () => new Int32Array(WH));
    const li = l => layers.indexOf(l);
    const markCapsule = (l, a, b, r, id) => {
      const g = occ[l], R = r + clr + tw / 2 + res * 0.35;
      const x0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R) / res)), x1 = Math.min(W - 1, Math.ceil((Math.max(a[0], b[0]) + R) / res));
      const y0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - R) / res)), y1 = Math.min(H - 1, Math.ceil((Math.max(a[1], b[1]) + R) / res));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const cx = (x + 0.5) * res, cy = (y + 0.5) * res;
        if (CL.distPtSeg(cx, cy, a[0], a[1], b[0], b[1]) <= R) {
          const i = y * W + x, cur = g[i];
          if (cur === 0) g[i] = id; else if (cur !== id) g[i] = -1;
        }
      }
    };
    const markPad = (pd) => { const id = idOf(pd.net) ; const c = padCapsule(pd);
      for (const l of pd.layers) { const k = li(l); if (k < 0) continue;
        if (pd.shape === 'rect') { // rect: cover rectangle exactly
          const g = occ[k], R = clr + tw / 2 + res * 0.35;
          const x0 = Math.max(0, Math.floor((pd.x - pd.w / 2 - R) / res)), x1 = Math.min(W - 1, Math.ceil((pd.x + pd.w / 2 + R) / res));
          const y0 = Math.max(0, Math.floor((pd.y - pd.h / 2 - R) / res)), y1 = Math.min(H - 1, Math.ceil((pd.y + pd.h / 2 + R) / res));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x, cur = g[i]; if (cur === 0) g[i] = id; else if (cur !== id) g[i] = -1; }
        } else markCapsule(k, c.a, c.b, c.r, id);
      } };
    an.pads.forEach(markPad);
    B.traces.forEach(t => { const k = li(t.layer); if (k < 0) return; for (let i = 1; i < t.pts.length; i++) markCapsule(k, t.pts[i - 1], t.pts[i], t.w / 2, idOf(t.net)); });
    B.vias.forEach(v => { for (let k = 0; k < L; k++) markCapsule(k, [v.x, v.y], [v.x, v.y], v.d / 2, idOf(v.net)); });
    // board edge keep-out
    const edge = Math.ceil((0.3 + tw / 2) / res);
    for (let k = 0; k < L; k++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < edge || y < edge || x >= W - edge || y >= H - edge) occ[k][y * W + x] = -1;

    const pass = (k, i, id) => { const o = occ[k][i]; return o === 0 || o === id; };
    const viaR = Math.max(0, Math.ceil((B.viaD / 2 - tw / 2) / res));
    const viaOk = (i, id) => { const x = i % W, y = (i / W) | 0; for (let k = 0; k < L; k++) for (let dy = -viaR; dy <= viaR; dy++) for (let dx = -viaR; dx <= viaR; dx++) { if (dx * dx + dy * dy > viaR * viaR + 1) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || !pass(k, yy * W + xx, id)) return false; } return true; };
    const g = new Float32Array(L * WH), from = new Int32Array(L * WH), gen = new Uint32Array(L * WH);
    let curGen = 0;
    const dirs = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
    const cell = (x, y) => Math.min(H - 1, Math.max(0, Math.floor(y / res))) * W + Math.min(W - 1, Math.max(0, Math.floor(x / res)));

    const route = (pa, pb, id) => {
      curGen++;
      const heap = new Heap();
      const tx = pb.x / res, ty = pb.y / res;
      const tCell = cell(pb.x, pb.y);
      const tLayers = new Set(pb.layers.map(li).filter(k => k >= 0));
      const hfn = i => { const x = i % W, y = (i / W) | 0; const dx = Math.abs(x + 0.5 - tx), dy = Math.abs(y + 0.5 - ty); return 10 * Math.max(dx, dy) + 4 * Math.min(dx, dy); };
      const sCell = cell(pa.x, pa.y);
      for (const l of pa.layers) { const k = li(l); if (k < 0) continue; const s = k * WH + sCell; gen[s] = curGen; g[s] = 0; from[s] = -1; heap.push(hfn(sCell), s); }
      let found = -1, n = 0;
      while (heap.size && n++ < 600000) {
        const s = heap.pop(); const k = (s / WH) | 0, i = s - k * WH;
        if (i === tCell && tLayers.has(k)) { found = s; break; }
        const gs = g[s], x = i % W, y = (i / W) | 0;
        for (let d = 0; d < 8; d++) {
          const [dx, dy, c0] = dirs[d];
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx; if (!pass(k, j, id)) continue;
          if (dx && dy && (!pass(k, y * W + xx, id) || !pass(k, yy * W + x, id))) continue;
          let c = c0; if (L > 1 && dx && dy === 0 && k % 2 === 1) c += 4; if (L > 1 && dy && dx === 0 && k % 2 === 0) c += 4;
          const t = k * WH + j, ng = gs + c;
          if (gen[t] !== curGen || ng < g[t]) { gen[t] = curGen; g[t] = ng; from[t] = s; heap.push(ng + hfn(j), t); }
        }
        if (L > 1 && viaOk(i, id)) for (let k2 = 0; k2 < L; k2++) {
          if (k2 === k) continue; const t = k2 * WH + i, ng = gs + 80;
          if (gen[t] !== curGen || ng < g[t]) { gen[t] = curGen; g[t] = ng; from[t] = s; heap.push(ng + hfn(i), t); }
        }
      }
      if (found < 0) return null;
      const path = [];
      for (let s = found; s >= 0; s = from[s]) path.push(s);
      path.reverse();
      return path.map(s => { const k = (s / WH) | 0, i = s - k * WH; return { k, x: (i % W + 0.5) * res, y: (((i / W) | 0) + 0.5) * res }; });
    };

    const newTraces = [], newVias = [];
    const conns = an.rats.map(r => ({ ...r, d: Math.hypot(r.x2 - r.x1, r.y2 - r.y1) })).sort((a, b) => a.d - b.d);
    let routed = 0, failed = [];
    for (const r of conns) {
      const id = idOf(r.net);
      const path = route(r.a, r.b, id);
      if (!path) { failed.push(r); continue; }
      routed++;
      // split into layer runs
      let run = [path[0]];
      const flush = () => {
        if (run.length < 2) return;
        const pts = [[run[0].x, run[0].y]];
        for (let i = 1; i < run.length - 1; i++) {
          const a = run[i - 1], b = run[i], c = run[i + 1];
          if (Math.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) > 1e-9) pts.push([b.x, b.y]);
        }
        pts.push([run[run.length - 1].x, run[run.length - 1].y]);
        newTraces.push({ id: CL.uid('t'), net: r.net, layer: layers[run[0].k], w: tw, pts: pts.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]) });
      };
      for (let i = 1; i < path.length; i++) {
        if (path[i].k !== path[i - 1].k) { flush(); newVias.push({ id: CL.uid('v'), x: path[i].x, y: path[i].y, d: B.viaD, drill: B.viaDrill, net: r.net }); run = [path[i]]; }
        else run.push(path[i]);
      }
      flush();
      // snap ends to pad centres
      const startT = newTraces.slice().reverse().find(t => t.net === r.net && Math.hypot(t.pts[0][0] - path[0].x, t.pts[0][1] - path[0].y) < 1e-6);
      if (startT) startT.pts.unshift([r.a.x, r.a.y]);
      const endT = newTraces.slice().reverse().find(t => t.net === r.net && Math.hypot(t.pts[t.pts.length - 1][0] - path[path.length - 1].x, t.pts[t.pts.length - 1][1] - path[path.length - 1].y) < 1e-6);
      if (endT) endT.pts.push([r.b.x, r.b.y]);
      // mark
      path.forEach((q, i) => { if (i) { const pr = path[i - 1]; if (pr.k === q.k) markCapsule(q.k, [pr.x, pr.y], [q.x, q.y], tw / 2, id); } });
      newVias.forEach(v => { if (v.net === r.net) for (let k = 0; k < L; k++) markCapsule(k, [v.x, v.y], [v.x, v.y], v.d / 2, id); });
    }
    return { traces: newTraces, vias: newVias, routed, failed: failed.length, total: conns.length };
  };

  /* ---------- rendering ---------- */
  /* xf: {s, ox, oy, flipY?:H} maps mm -> px */
  function mk(xf) {
    const X = x => x * xf.s + xf.ox;
    const Y = xf.flipH != null ? y => (xf.flipH - y) * xf.s + xf.oy : y => y * xf.s + xf.oy;
    return { X, Y, s: xf.s };
  }
  function padPath(ctx, pd, T, grow = 0) {
    const w = (pd.w + 2 * grow) * T.s, h = (pd.h + 2 * grow) * T.s, x = T.X(pd.x), y = T.Y(pd.y);
    ctx.beginPath();
    if (pd.shape === 'circle') ctx.arc(x, y, w / 2, 0, Math.PI * 2);
    else if (pd.shape === 'oval') { const r = Math.min(w, h) / 2; if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, r); else ctx.rect(x - w / 2, y - h / 2, w, h); }
    else ctx.rect(x - w / 2, y - h / 2, w, h);
  }
  function traceStroke(ctx, t, T, grow = 0) {
    ctx.lineWidth = (t.w + 2 * grow) * T.s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); t.pts.forEach(([x, y], i) => (i ? ctx.lineTo(T.X(x), T.Y(y)) : ctx.moveTo(T.X(x), T.Y(y)))); ctx.stroke();
  }
  function drawCopperLayer(ctx, p, pads, layer, color, T, hl) {
    const B = p.board;
    const pourNet = B.pour && B.pour[layer];
    ctx.save();
    if (pourNet) {
      ctx.fillStyle = color; ctx.globalAlpha = 0.42;
      ctx.fillRect(T.X(0.3), Math.min(T.Y(0.3), T.Y(B.h - 0.3)), (B.w - 0.6) * T.s, (B.h - 0.6) * T.s);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
      pads.forEach(pd => { if (pd.layers.includes(layer) && pd.net !== pourNet) { padPath(ctx, pd, T, B.clearance + 0.1); ctx.fill(); } });
      B.traces.forEach(t => { if (t.layer === layer && t.net !== pourNet) traceStroke(ctx, t, T, B.clearance + 0.1); });
      B.vias.forEach(v => { if (v.net !== pourNet) { ctx.beginPath(); ctx.arc(T.X(v.x), T.Y(v.y), (v.d / 2 + B.clearance + 0.1) * T.s, 0, 7); ctx.fill(); } });
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = color; ctx.strokeStyle = color;
    B.traces.forEach(t => { if (t.layer !== layer) return; ctx.globalAlpha = hl && t.net !== hl ? 0.55 : 1; traceStroke(ctx, t, T); });
    ctx.globalAlpha = 1;
    pads.forEach(pd => { if (pd.layers.includes(layer)) { padPath(ctx, pd, T); ctx.fill(); } });
    B.vias.forEach(v => { ctx.beginPath(); ctx.arc(T.X(v.x), T.Y(v.y), v.d / 2 * T.s, 0, 7); ctx.fill(); });
    ctx.restore();
  }
  function silkItems(p, side) {
    const out = [];
    for (const c of p.components) {
      if (!c.pcb || (c.pcb.side || 'F') !== side) continue;
      const fp = CL.footprint(c); if (!fp) continue;
      for (const s of fp.silk) {
        if (s.t === 'l') out.push(s.pts.map(([x, y]) => CL.fpXform(c, x, y)));
        else { const a0 = s.t === 'arc' ? s.a0 : 0, a1 = s.t === 'arc' ? s.a1 : Math.PI * 2, n = 36; const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push(CL.fpXform(c, s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a))); } out.push(pts); }
      }
      const fh = fp.size[1];
      const odd = (c.pcb.rot || 0) % 2;
      const [lx, ly] = odd ? [c.pcb.x + fp.size[1] / 2 + 1.2, c.pcb.y] : [c.pcb.x, c.pcb.y - fh / 2 - 1.1];
      const strokes = CL.strokeText(c.ref, lx, ly, 1.0, odd ? 'l' : 'c');
      strokes.forEach(pl => out.push(side === 'B' ? pl.map(([x, y]) => [2 * lx - x, y]) : pl));
    }
    return out;
  }
  CL.silkItems = silkItems;

  CL.drawPCB = function (ctx, p, o) {
    const { pads, xf, vis, active, hl, rats, w, h } = o;
    const T = mk(xf), B = p.board;
    ctx.fillStyle = o.bg || '#0c1216'; ctx.fillRect(0, 0, w, h);
    // grid
    if (T.s > 4) {
      ctx.fillStyle = 'rgba(160,190,200,0.13)';
      const step = T.s > 14 ? 1.27 : 2.54;
      const x0 = Math.floor(-xf.ox / T.s / step) * step, y0 = Math.floor(-xf.oy / T.s / step) * step;
      for (let x = x0; T.X(x) < w; x += step) for (let y = y0; T.Y(y) < h; y += step) ctx.fillRect(T.X(x) - 0.75, T.Y(y) - 0.75, 1.5, 1.5);
    }
    ctx.fillStyle = '#16291f'; ctx.fillRect(T.X(0), T.Y(0), B.w * T.s, B.h * T.s);
    const cu = CL.copperLayers(B);
    const order = cu.slice().reverse().filter(l => l !== active).concat(cu.includes(active) ? [active] : []);
    const off = o.off || (o.off = document.createElement('canvas'));
    if (off.width !== w || off.height !== h) { off.width = w; off.height = h; }
    const octx = off.getContext('2d');
    for (const l of order) {
      if (!vis[l]) continue;
      octx.clearRect(0, 0, w, h);
      drawCopperLayer(octx, p, pads, l, CL.LAYER_COLORS[l], T, hl);
      ctx.globalAlpha = l === active ? 0.92 : 0.5;
      ctx.drawImage(off, 0, 0);
      ctx.globalAlpha = 1;
    }
    // highlight net
    if (hl) {
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
      pads.forEach(pd => { if (pd.net === hl) { padPath(ctx, pd, T, 0.15); ctx.stroke(); } });
      ctx.restore();
    }
    // drills
    if (vis.Drill) {
      ctx.fillStyle = '#0a0f12';
      pads.forEach(pd => { if (pd.drill) { ctx.beginPath(); ctx.arc(T.X(pd.x), T.Y(pd.y), pd.drill / 2 * T.s, 0, 7); ctx.fill(); } });
      B.vias.forEach(v => { ctx.beginPath(); ctx.arc(T.X(v.x), T.Y(v.y), v.drill / 2 * T.s, 0, 7); ctx.fill(); });
    }
    // silk
    for (const side of ['B', 'F']) {
      const lname = side + '.SilkS'; if (!vis[lname]) continue;
      ctx.strokeStyle = CL.LAYER_COLORS[lname]; ctx.lineWidth = Math.max(1, 0.15 * T.s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.globalAlpha = side === 'F' ? 0.95 : 0.6;
      for (const pl of silkItems(p, side)) { ctx.beginPath(); pl.forEach(([x, y], i) => (i ? ctx.lineTo(T.X(x), T.Y(y)) : ctx.moveTo(T.X(x), T.Y(y)))); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    if (vis['Edge.Cuts']) { ctx.strokeStyle = CL.LAYER_COLORS['Edge.Cuts']; ctx.lineWidth = Math.max(1.5, 0.15 * T.s); ctx.strokeRect(T.X(0), T.Y(0), B.w * T.s, B.h * T.s); }
    // ratsnest
    if (rats && vis.Ratsnest !== false) {
      ctx.strokeStyle = 'rgba(235,240,245,0.75)'; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); rats.forEach(r => { ctx.moveTo(T.X(r.x1), T.Y(r.y1)); ctx.lineTo(T.X(r.x2), T.Y(r.y2)); }); ctx.stroke();
    }
    // selection
    if (o.selected) {
      const c = p.components.find(c => c.id === o.selected);
      if (c && c.pcb) { const fp = CL.footprint(c); const odd = c.pcb.rot % 2; const sw = (odd ? fp.size[1] : fp.size[0]) + 1, sh = (odd ? fp.size[0] : fp.size[1]) + 1;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]); ctx.strokeRect(T.X(c.pcb.x - sw / 2), T.Y(c.pcb.y - sh / 2), sw * T.s, sh * T.s); ctx.setLineDash([]); }
    }
    if (o.selTrace) { const t = B.traces.find(t => t.id === o.selTrace); if (t) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.setLineDash([4, 3]); traceStroke(ctx, { ...t, w: t.w + 0.3 }, T); ctx.setLineDash([]); } }
    // DRC markers
    if (o.markers) { ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 1.5; o.markers.forEach(m => { const x = T.X(m.x), y = T.Y(m.y); ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke(); }); }
    // route preview
    if (o.preview) {
      const pv = o.preview; ctx.strokeStyle = CL.LAYER_COLORS[pv.layer]; ctx.globalAlpha = 0.85;
      traceStroke(ctx, { pts: pv.pts, w: pv.w }, T); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); traceStroke(ctx, { pts: pv.pts, w: 0.02 }, T); ctx.setLineDash([]);
    }
  };

  /* texture of one board face for the 3D view */
  CL.boardTexture = function (p, side, pxPerMm, lit) {
    const B = p.board, s = pxPerMm;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(B.w * s); cv.height = Math.ceil(B.h * s);
    const ctx = cv.getContext('2d');
    const T = mk(side === 'B' ? { s, ox: 0, oy: 0, flipH: B.h } : { s, ox: 0, oy: 0 });
    const pads = CL.boardPads(p);
    const mask = B.mask;
    ctx.fillStyle = mask; ctx.fillRect(0, 0, cv.width, cv.height);
    const off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height;
    const o = off.getContext('2d');
    const layer = side === 'B' ? 'B.Cu' : 'F.Cu';
    drawCopperLayer(o, p, pads, layer, '#ffffff', T, null);
    ctx.globalAlpha = 0.22; ctx.drawImage(off, 0, 0); ctx.globalAlpha = 1;
    // pad openings
    const fin = B.finish === 'HASL' ? '#c9ced4' : '#d8b04a';
    ctx.fillStyle = fin;
    pads.forEach(pd => { if (pd.layers.includes(layer)) { padPath(ctx, pd, T, 0.05); ctx.fill(); } });
    // silk
    ctx.strokeStyle = B.silk; ctx.lineWidth = 0.15 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pl of silkItems(p, side)) { ctx.beginPath(); pl.forEach(([x, y], i) => (i ? ctx.lineTo(T.X(x), T.Y(y)) : ctx.moveTo(T.X(x), T.Y(y)))); ctx.stroke(); }
    if (side === 'F') { const t = CL.strokeText((p.name || 'COPPERLINE').slice(0, 24), 1.5, B.h - 2.2, 1.4, 'l'); t.forEach(pl => { ctx.beginPath(); pl.forEach(([x, y], i) => (i ? ctx.lineTo(T.X(x), T.Y(y)) : ctx.moveTo(T.X(x), T.Y(y)))); ctx.stroke(); }); }
    // drills
    ctx.fillStyle = '#07090a';
    pads.forEach(pd => { if (pd.drill) { ctx.beginPath(); ctx.arc(T.X(pd.x), T.Y(pd.y), pd.drill / 2 * s, 0, 7); ctx.fill(); } });
    B.vias.forEach(v => { ctx.fillStyle = fin; ctx.beginPath(); ctx.arc(T.X(v.x), T.Y(v.y), v.d / 2 * s * 0.8, 0, 7); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#07090a'; ctx.beginPath(); ctx.arc(T.X(v.x), T.Y(v.y), v.drill / 2 * s, 0, 7); ctx.fill(); });
    return cv;
  };
})(typeof window !== 'undefined' ? window : globalThis);
