/* Copperline netlist extraction from schematic */
(function (G) {
  const CL = (G.CL = G.CL || {});

  function onSeg(p, a, b) {
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cross) > 1e-9) return false;
    return p[0] >= Math.min(a[0], b[0]) - 1e-9 && p[0] <= Math.max(a[0], b[0]) + 1e-9 && p[1] >= Math.min(a[1], b[1]) - 1e-9 && p[1] <= Math.max(a[1], b[1]) + 1e-9;
  }
  CL.onSeg = onSeg;

  CL.buildNetlist = function (project) {
    const D = CL.DEFS;
    const comps = project.components, wires = project.wires;
    const parent = new Map();
    const find = k => {
      let r = k;
      while (true) { const p = parent.get(r); if (p === undefined) { parent.set(r, r); break; } if (p === r) break; r = p; }
      let c = k; while (c !== r) { const n = parent.get(c); parent.set(c, r); c = n; }
      return r;
    };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
    const key = p => p[0] + ',' + p[1];
    const degree = new Map();
    const bump = (k, n = 1) => degree.set(k, (degree.get(k) || 0) + n);

    for (const w of wires) {
      for (let i = 0; i < w.pts.length; i++) {
        find(key(w.pts[i]));
        if (i) union(key(w.pts[i - 1]), key(w.pts[i]));
        bump(key(w.pts[i]), i === 0 || i === w.pts.length - 1 ? 1 : 2);
      }
    }
    for (const w of wires) {
      const ends = [w.pts[0], w.pts[w.pts.length - 1]];
      for (const e of ends) {
        for (const w2 of wires) {
          if (w2 === w) continue;
          for (let i = 1; i < w2.pts.length; i++) {
            const a = w2.pts[i - 1], b = w2.pts[i];
            if (onSeg(e, a, b)) {
              union(key(e), key(a));
              const isVertex = (e[0] === a[0] && e[1] === a[1]) || (e[0] === b[0] && e[1] === b[1]);
              if (!isVertex) bump(key(e), 2);
              break;
            }
          }
        }
      }
    }
    const pinKeys = new Map();
    for (const c of comps) {
      const d = D[c.type]; if (!d) continue;
      const ks = d.pins.map((_, i) => { const k = key(CL.pinPos(c, i)); find(k); bump(k, 1); return k; });
      pinKeys.set(c.id, ks);
    }
    // internally tied pins (MCU has two GND pins)
    for (const c of comps) {
      const d = D[c.type]; if (!d || !d.board) continue;
      const ks = pinKeys.get(c.id), first = {};
      d.pins.forEach((p, i) => { if (p.n in first) union(ks[first[p.n]], ks[i]); else first[p.n] = i; });
    }
    const labelOf = new Map(); // root -> name
    const byName = new Map();
    for (const c of comps) {
      const d = D[c.type]; if (!d || !d.net) continue;
      const name = String(d.net(c) || '').trim(); if (!name) continue;
      const k = pinKeys.get(c.id)[0];
      if (byName.has(name)) union(byName.get(name), k); else byName.set(name, k);
    }
    for (const [name, k] of byName) {
      const r = find(k);
      const prev = labelOf.get(r);
      if (!prev || name === 'GND') labelOf.set(r, name);
    }
    const rootName = new Map();
    for (const [r, n] of labelOf) rootName.set(find(r), n);
    let auto = 1;
    const nets = new Map();
    const pinNet = new Map();
    const getNet = r => {
      if (!rootName.has(r)) { let n; do { n = 'N$' + auto++; } while (byName.has(n)); rootName.set(r, n); }
      const name = rootName.get(r);
      if (!nets.has(name)) nets.set(name, { name, pins: [], wires: [], labelled: labelOf.has(r) || [...labelOf.keys()].some(k => find(k) === r) });
      return nets.get(name);
    };
    for (const c of comps) {
      const ks = pinKeys.get(c.id); if (!ks) continue;
      const arr = ks.map((k, i) => { const n = getNet(find(k)); n.pins.push({ c, i }); return n.name; });
      pinNet.set(c.id, arr);
    }
    const wireNet = new Map();
    for (const w of wires) { const n = getNet(find(key(w.pts[0]))); n.wires.push(w.id); wireNet.set(w.id, n.name); }
    const junctions = [];
    for (const [k, d] of degree) if (d >= 3) junctions.push(k.split(',').map(Number));
    // ERC
    const warnings = [];
    for (const c of comps) {
      const d = D[c.type]; if (!d || d.virtual) continue;
      pinNet.get(c.id).forEach((n, i) => {
        const net = nets.get(n);
        if (net.pins.some(p => p.c.type === 'noconnect')) return;
        const real = net.pins.filter(p => !(D[p.c.type].virtual && p.c.type !== 'voltmeter')).length;
        if (real <= 1 && net.wires.length === 0 && !d.board) warnings.push({ kind: 'warn', msg: `${c.ref} pin ${d.pins[i].n} is not connected`, comp: c.id });
      });
    }
    if (!nets.has('GND') && comps.some(c => !D[c.type].virtual)) warnings.push({ kind: 'error', msg: 'No ground reference. Add a Ground symbol so the simulator has a 0 V node.' });
    return { nets, pinNet, wireNet, junctions, warnings };
  };
})(typeof window !== 'undefined' ? window : globalThis);
