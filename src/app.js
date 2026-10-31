/* Copperline Studio — React UI */
(function () {
  const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;
  const html = htm.bind(React.createElement);
  const D = CL.DEFS;
  const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
  const fmt = CL.formatSI;

  /* ---------- icons ---------- */
  const IP = {
    play: 'M7 4.5l12 7.5-12 7.5z', pause: 'M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z', stop: 'M6 6h12v12H6z',
    undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11', redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13',
    rotate: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    wire: 'M3 18h7V6h11', cursor: 'M5 3l14 8-6 2-2 6z', route: 'M3 20l6-6h6l6-6', via: 'M12 7a5 5 0 110 10 5 5 0 010-10zM12 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 110 6 3 3 0 010-6', eyeoff: 'M3 3l18 18M10.6 5.1A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.5 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 004.6-1.1',
    sch: 'M2 12h4l2-5 3 10 3-10 2 5h6', board: 'M4 4h16v16H4zM8 9h4v6h4M8 15h.01', cube: 'M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3zM12 21.5V12M20.5 7.3L12 12 3.5 7.3',
    code: 'M9 18l-6-6 6-6M15 6l6 6-6 6', download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14', open: 'M3 7V5h7l2 2h9v3M3 7v12h15l3-9H6.5z', plus: 'M12 5v14M5 12h14',
    menu: 'M4 7h16M4 12h16M4 17h16', panel: 'M4 4h16v16H4zM15 4v16', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', flip: 'M12 3v18M8 7l-4 5 4 5M16 7l4 5-4 5',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', check: 'M4 12l5 5L20 6', x: 'M6 6l12 12M18 6L6 18', copy: 'M9 9h11v11H9zM5 15H4V4h11v1', upload: 'M12 20V9M7 13.5l5-5 5 5M5 4h14', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', chev: 'M9 6l6 6-6 6', help: 'M12 21.5a9.5 9.5 0 110-19 9.5 9.5 0 010 19zM9.2 9.2a2.9 2.9 0 015.6.9c0 1.9-2.8 2.4-2.8 4.3M12 17.3h.01'
  };
  const FILLED = new Set(['play', 'pause', 'stop']);
  const Icon = ({ n }) => html`<svg viewBox="0 0 24 24" fill=${FILLED.has(n) ? 'currentColor' : 'none'} stroke=${FILLED.has(n) ? 'none' : 'currentColor'} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${IP[n]}/></svg>`;
  const Logo = () => html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4" fill="var(--accent)"/><path d="M6 17h4l3-5h5M6 7h5" stroke="var(--accent-ink)" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="18" cy="12" r="2.2" fill="var(--accent-ink)"/><circle cx="12.5" cy="7" r="1.6" fill="none" stroke="var(--accent-ink)" stroke-width="1.6"/></svg>`;

  /* ---------- schematic geometry ---------- */
  const SPECIAL_BOX = { mcu: [-62, -70, 62, 58], sevenseg: [-32, -53, 22, 62], ground: [-11, -2, 11, 18], vcc: [-10, -12, 10, 2], probe: [-2, -19, 19, 2] };
  function localBox(c) {
    const d = D[c.type];
    if (c.type === 'netlabel') { const w = Math.max(20, c.props.name.length * 6.2 + 12), r = (c.rot || 0) % 4; return r === 2 ? [-w - 2, -9, 2, 9] : r === 1 ? [-9, -2, 9, w + 2] : r === 3 ? [-9, -w - 2, 9, 2] : [-2, -9, w + 2, 9]; }
    if (d.box) return d.box;
    if (SPECIAL_BOX[c.type]) return SPECIAL_BOX[c.type];
    let x0 = -16, y0 = -13, x1 = 16, y1 = 13;
    for (const p of d.pins) { x0 = Math.min(x0, p.x * 10); x1 = Math.max(x1, p.x * 10); y0 = Math.min(y0, p.y * 10); y1 = Math.max(y1, p.y * 10); }
    return [x0 - 2, y0 - 2, x1 + 2, y1 + 2];
  }
  function compBox(c) { // rotated, world px
    const d = D[c.type], b = localBox(c);
    if (d.selfOriented) return [c.x * 10 + b[0], c.y * 10 + b[1], c.x * 10 + b[2], c.y * 10 + b[3]];
    const pts = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(([x, y]) => CL.rotQ(x, y, c.rot || 0));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return [c.x * 10 + Math.min(...xs), c.y * 10 + Math.min(...ys), c.x * 10 + Math.max(...xs), c.y * 10 + Math.max(...ys)];
  }
  const simplify = pts => {
    const a = [];
    for (const p of pts) { const l = a[a.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) a.push([p[0], p[1]]); }
    for (let i = a.length - 2; i >= 1; i--) { const p = a[i - 1], q = a[i], r = a[i + 1]; if ((p[0] === q[0] && q[0] === r[0]) || (p[1] === q[1] && q[1] === r[1])) a.splice(i, 1); }
    return a;
  };
  const lpath = (a, b) => { if (a[0] === b[0] || a[1] === b[1]) return [b]; return Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? [[b[0], a[1]], b] : [[a[0], b[1]], b]; };
  const topoKey = p => JSON.stringify([p.components.map(c => [c.id, c.type, c.x, c.y, c.rot, D[c.type] && D[c.type].board ? c.props.code : 0, c.props.name, c.props.net, c.props.color, c.props.model, c.props.vz, c.props.type]), p.wires.map(w => w.pts)]);

  function labelEls(c) {
    return CL.labelAnchors(c).map(l => html`<text key=${l.cls} x=${l.x} y=${l.y} class=${l.cls} text-anchor=${l.ta}>${l.text}</text>`);
  }
  function svgSymbolString(c, st) {
    const d = D[c.type];
    return `<g transform="rotate(${d.selfOriented ? 0 : (c.rot || 0) * 90})">${d.draw(c, st)}</g>`;
  }

  const CompG = React.memo(function CompG({ c, st, selected }) {
    const d = D[c.type];
    const b = localBox(c);
    const rot = d.selfOriented ? 0 : (c.rot || 0) * 90;
    return html`<g class=${'comp' + (d.interactive ? ' interactive' : '')} data-comp=${c.id} transform=${`translate(${c.x * 10} ${c.y * 10})`}>
      <g transform=${`rotate(${rot})`}>
        <rect x=${b[0]} y=${b[1]} width=${b[2] - b[0]} height=${b[3] - b[1]} fill="transparent" class=${selected ? 'selbox' : ''}/>
        <g dangerouslySetInnerHTML=${{ __html: d.draw(c, st) }}/>
      </g>
      ${labelEls(c)}
      ${d.pins.map((p, i) => { const [x, y] = CL.rotQ(p.x * 10, p.y * 10, d.selfOriented ? 0 : c.rot || 0); return html`<circle key=${'p' + i} class="pin" cx=${x} cy=${y} r="4" data-pin=${c.id + ':' + i}/>`; })}
    </g>`;
  });

  const volColor = (v, vmax) => {
    if (!isFinite(v)) return null;
    const t = CL.clamp(Math.abs(v) / (vmax || 1), 0, 1);
    return v >= 0 ? `hsl(${(186 - 165 * t).toFixed(0)} ${(55 + 25 * t).toFixed(0)}% ${(44 + 6 * t).toFixed(0)}%)` : `hsl(222 70% ${(50 + 10 * t).toFixed(0)}%)`;
  };

  /* ---------- Schematic view ---------- */
  function SchematicView(P) {
    const { project, nl, setProject, commit, pushHistory, sel, setSel, placing, setPlacing, readings, sim, view, setView, tool, setTool, live } = P;
    const svgRef = useRef(null);
    const [size, setSize] = useState({ w: 800, h: 600 });
    const [cursor, setCursor] = useState(null);
    const [wire, setWire] = useState(null);
    const [ghostRot, setGhostRot] = useState(0);
    const [tip, setTip] = useState(null);
    const act = useRef(null);
    const pointers = useRef(new Map());
    const wireRef = useRef(wire); wireRef.current = wire;
    const projRef = useRef(project); projRef.current = project;

    useLayoutEffect(() => {
      const el = svgRef.current; if (!el) return;
      const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
      ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
      return () => ro.disconnect();
    }, []);
    const fit = useCallback(() => {
      const p = projRef.current; const el = svgRef.current; if (!el) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      p.components.forEach(c => { const b = compBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); });
      p.wires.forEach(w => w.pts.forEach(([x, y]) => { x0 = Math.min(x0, x * 10); y0 = Math.min(y0, y * 10); x1 = Math.max(x1, x * 10); y1 = Math.max(y1, y * 10); }));
      if (!isFinite(x0)) { x0 = -200; y0 = -150; x1 = 200; y1 = 150; }
      const W = el.clientWidth || 800, H = el.clientHeight || 600;
      const k = CL.clamp(Math.min((W - 80) / (x1 - x0 + 40), (H - 90) / (y1 - y0 + 40)), 0.3, 3.2);
      setView({ k, x: (x0 + x1) / 2 - W / 2 / k, y: (y0 + y1) / 2 - H / 2 / k });
    }, [setView]);
    useEffect(() => { if (!view) fit(); }, [view, fit]);
    useEffect(() => { P.fitRef.current = fit; }, [fit]);

    const V = view || { k: 1, x: -400, y: -300 };
    const toWorld = e => { const r = svgRef.current.getBoundingClientRect(); return [(e.clientX - r.left) / V.k + V.x, (e.clientY - r.top) / V.k + V.y]; };
    const gridOf = w => [Math.round(w[0] / 10), Math.round(w[1] / 10)];

    const connectableAt = (g, p = projRef.current) => {
      for (const c of p.components) { const d = D[c.type]; for (let i = 0; i < d.pins.length; i++) { const q = CL.pinPos(c, i); if (q[0] === g[0] && q[1] === g[1]) return true; } }
      for (const w of p.wires) for (let i = 1; i < w.pts.length; i++) if (CL.onSeg(g, w.pts[i - 1], w.pts[i])) return true;
      return false;
    };
    const finishWire = pts => {
      const s = simplify(pts);
      if (s.length >= 2) commit(p => { p.wires.push({ id: CL.uid('w'), pts: s }); });
      setWire(null);
    };
    const wireClick = (g, dbl) => {
      const w = wireRef.current;
      if (!w) { setWire({ pts: [g] }); return; }
      const last = w.pts[w.pts.length - 1];
      if (g[0] === last[0] && g[1] === last[1]) { finishWire(w.pts); return; }
      const pts = w.pts.concat(lpath(last, g));
      if (dbl || connectableAt(g)) finishWire(pts); else setWire({ pts });
    };

    const startDrag = (id, g) => {
      const p0 = projRef.current;
      const base = clone(p0);
      const c = base.components.find(c => c.id === id);
      const keys = new Set(D[c.type].pins.map((_, i) => CL.pinPos(c, i).join(',')));
      const att = [];
      base.wires.forEach(w => {
        const e0 = keys.has(w.pts[0].join(',')), e1 = keys.has(w.pts[w.pts.length - 1].join(','));
        if (!e0 && !e1) return;
        if (w.pts.length === 2 && !(e0 && e1)) {
          const [a, b] = w.pts;
          if (a[1] === b[1]) { const m = Math.round((a[0] + b[0]) / 2); w.pts = [a, [m, a[1]], [m, b[1]], b]; }
          else if (a[0] === b[0]) { const m = Math.round((a[1] + b[1]) / 2); w.pts = [a, [a[0], m], [b[0], m], b]; }
        }
        if (e0) att.push({ id: w.id, end: 0, horiz: w.pts.length > 1 && w.pts[0][1] === w.pts[1][1] });
        if (e1) { const n = w.pts.length; att.push({ id: w.id, end: 1, horiz: n > 1 && w.pts[n - 1][1] === w.pts[n - 2][1] }); }
      });
      act.current = { kind: 'drag', id, start: g, base, p0, orig: { x: c.x, y: c.y }, att, moved: false };
    };
    const doDrag = g => {
      const a = act.current; const dx = g[0] - a.start[0], dy = g[1] - a.start[1];
      if (!dx && !dy && !a.moved) return;
      a.moved = true;
      const next = clone(a.base);
      const c = next.components.find(c => c.id === a.id); c.x = a.orig.x + dx; c.y = a.orig.y + dy;
      for (const t of a.att) {
        const w = next.wires.find(w => w.id === t.id); if (!w) continue;
        const n = w.pts.length, i = t.end === 0 ? 0 : n - 1, j = t.end === 0 ? 1 : n - 2;
        w.pts[i] = [w.pts[i][0] + dx, w.pts[i][1] + dy];
        const both = a.att.some(o => o.id === t.id && o.end !== t.end);
        if (j > 0 && j < n - 1 && !both) { if (t.horiz) w.pts[j] = [w.pts[j][0], w.pts[j][1] + dy]; else w.pts[j] = [w.pts[j][0] + dx, w.pts[j][1]]; }
        else if (both) w.pts = w.pts.map((q, k) => (k === i ? q : k === 0 || k === n - 1 ? q : [q[0] + (k === j ? 0 : 0), q[1]]));
      }
      if (a.att.some(t => a.att.some(o => o.id === t.id && o.end !== t.end))) {
        next.wires.forEach(w => { const pair = a.att.filter(t => t.id === w.id); if (pair.length === 2) { const bw = a.base.wires.find(x => x.id === w.id); w.pts = bw.pts.map(q => [q[0] + dx, q[1] + dy]); } });
      }
      setProject(next);
    };

    const onPointerDown = e => {
      svgRef.current.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; act.current = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), v: { ...V }, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return; }
      const w = toWorld(e), g = gridOf(w);
      if (e.button === 1 || e.button === 2) { act.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, v: { ...V } }; return; }
      if (placing) {
        const tp = placing;
        const nc = CL.newComponent(tp, g[0], g[1], projRef.current.components); nc.rot = ghostRot;
        commit(p => { p.components.push(clone(nc)); }); setSel({ kind: 'comp', id: nc.id });
        if (!e.shiftKey) setPlacing(null);
        return;
      }
      if (wireRef.current || tool === 'wire') { wireClick(g, e.detail >= 2); return; }
      const pinEl = e.target.closest('[data-pin]');
      if (pinEl) { const [id, i] = pinEl.dataset.pin.split(':'); const c = projRef.current.components.find(c => c.id === id); setWire({ pts: [CL.pinPos(c, +i)] }); return; }
      const compEl = e.target.closest('[data-comp]');
      if (compEl) {
        const id = compEl.dataset.comp; const c = projRef.current.components.find(c => c.id === id);
        setSel({ kind: 'comp', id });
        if (sim && D[c.type].interactive === 'toggle') { const k = D[c.type].toggleProp || 'closed'; live(id, { [k]: !c.props[k] }); act.current = null; return; }
        if (sim && D[c.type].interactive === 'momentary') { live(id, { pressed: true }); act.current = { kind: 'press', id }; return; }
        startDrag(id, g); return;
      }
      const wEl = e.target.closest('[data-wire]');
      if (wEl) { setSel({ kind: 'wire', id: wEl.dataset.wire }); act.current = null; return; }
      setSel(null);
      act.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, v: { ...V } };
    };
    const onPointerMove = e => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const a = act.current;
      if (a && a.kind === 'pinch' && pointers.current.size === 2) {
        const [p, q] = [...pointers.current.values()]; const d = Math.hypot(p.x - q.x, p.y - q.y);
        const k = CL.clamp(a.v.k * d / a.d, 0.25, 5); const r = svgRef.current.getBoundingClientRect();
        const cx = a.cx - r.left, cy = a.cy - r.top; const wx = cx / a.v.k + a.v.x, wy = cy / a.v.k + a.v.y;
        setView({ k, x: wx - cx / k, y: wy - cy / k }); return;
      }
      if (a && a.kind === 'pan') { setView({ k: a.v.k, x: a.v.x - (e.clientX - a.sx) / a.v.k, y: a.v.y - (e.clientY - a.sy) / a.v.k }); return; }
      const w = toWorld(e), g = gridOf(w);
      if (!cursor || cursor[0] !== g[0] || cursor[1] !== g[1]) setCursor(g);
      if (a && a.kind === 'drag') { doDrag(g); return; }
      // net tooltip
      const r = svgRef.current.getBoundingClientRect();
      const wEl = e.target.closest && e.target.closest('[data-wire]'), pEl = e.target.closest && e.target.closest('[data-pin]');
      let net = null, extra = '';
      if (wEl) net = nl.wireNet.get(wEl.dataset.wire);
      else if (pEl) { const [id, i] = pEl.dataset.pin.split(':'); const arr = nl.pinNet.get(id); const c = projRef.current.components.find(c => c.id === id); net = arr && arr[+i]; if (c) extra = `${c.ref}.${D[c.type].pins[+i].n} · `; }
      if (net) setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: `${extra}${net}${sim ? ' · ' + fmt(sim.nodeV(net), 'V') : ''}` });
      else if (tip) setTip(null);
    };
    const onPointerUp = e => {
      pointers.current.delete(e.pointerId);
      const a = act.current;
      if (a && a.kind === 'drag' && a.moved) {
        setProject(p => { const n = clone(p); n.wires = n.wires.map(w => ({ ...w, pts: simplify(w.pts) })).filter(w => w.pts.length >= 2); return n; });
        pushHistory(a.p0);
      }
      if (a && a.kind === 'press') live(a.id, { pressed: false });
      act.current = null;
    };
    const onWheel = e => {
      e.preventDefault();
      const r = svgRef.current.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const k = CL.clamp(V.k * Math.exp(-e.deltaY * 0.0015), 0.25, 5);
      const wx = cx / V.k + V.x, wy = cy / V.k + V.y;
      setView({ k, x: wx - cx / k, y: wy - cy / k });
    };
    useEffect(() => { const el = svgRef.current; el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel); });

    useEffect(() => {
      const onKey = e => {
        if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
        const k = e.key.toLowerCase();
        if (k === 'escape') { if (wireRef.current) finishWire(wireRef.current.pts); setPlacing(null); setTool('select'); }
        else if (k === 'r' && !e.ctrlKey && !e.metaKey) {
          if (placing) setGhostRot(r => (r + 1) % 4);
          else if (sel && sel.kind === 'comp') commit(p => { const c = p.components.find(c => c.id === sel.id); if (c) c.rot = ((c.rot || 0) + 1) % 4; });
        } else if (k === 'w' && !e.ctrlKey && !e.metaKey) setTool(t => (t === 'wire' ? 'select' : 'wire'));
        else if ((k === 'delete' || k === 'backspace') && sel) {
          commit(p => { if (sel.kind === 'comp') p.components = p.components.filter(c => c.id !== sel.id); else if (sel.kind === 'wire') p.wires = p.wires.filter(w => w.id !== sel.id); });
          setSel(null);
        } else if (k === 'd' && (e.ctrlKey || e.metaKey) && sel && sel.kind === 'comp') {
          e.preventDefault();
          const c0 = projRef.current.components.find(c => c.id === sel.id);
          if (c0) { const n = CL.newComponent(c0.type, c0.x + 4, c0.y + 4, projRef.current.components); n.props = clone(c0.props); n.rot = c0.rot; commit(p => { p.components.push(clone(n)); }); setSel({ kind: 'comp', id: n.id }); }
        } else if (k === 'f') fit();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    });

    let vmax = 0;
    if (sim) for (const n of nl.nets.keys()) vmax = Math.max(vmax, Math.abs(sim.nodeV(n)));
    const ghost = placing && cursor ? { ...CL.newComponent(placing, cursor[0], cursor[1], []), rot: ghostRot } : null;
    const preview = wire && cursor ? wire.pts.concat(lpath(wire.pts[wire.pts.length - 1], cursor)) : null;
    const W = size.w / V.k, H = size.h / V.k;
    const hint = placing ? `Click to place ${D[placing].name} · R rotates · Shift+click places several · Esc cancels`
      : wire ? 'Click to add a corner · click a pin or wire to finish · double-click ends · Esc stops'
      : tool === 'wire' ? 'Wire tool: click anywhere to start a wire'
      : sim ? 'Simulating · click switches and buttons to operate them · hover a wire to read its voltage'
      : 'Drag parts to move · click a pin to start a wire · R rotate · Del delete · W wire tool · F fit';

    return html`<div style=${{ position: 'absolute', inset: 0 }}>
      <svg ref=${svgRef} class="sch" onPointerDown=${onPointerDown} onPointerMove=${onPointerMove} onPointerUp=${onPointerUp} onPointerCancel=${onPointerUp}
        onDoubleClick=${() => { if (wireRef.current) finishWire(wireRef.current.pts); }} onContextMenu=${e => e.preventDefault()} style=${{ cursor: tool === 'wire' || wire ? 'crosshair' : placing ? 'copy' : 'default' }}>
        <defs>
          <pattern id="gd" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=${Math.max(0.6, 0.9 / Math.sqrt(V.k))} fill="var(--grid-dot)"/></pattern>
          <pattern id="gm" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="var(--grid-major)" stroke-width=${1 / V.k}/></pattern>
        </defs>
        <g transform=${`scale(${V.k}) translate(${-V.x} ${-V.y})`}>
          <rect x=${V.x} y=${V.y} width=${W} height=${H} fill="url(#gd)"/>
          <rect x=${V.x} y=${V.y} width=${W} height=${H} fill="url(#gm)"/>
          ${project.wires.map(w => {
            const pts = w.pts.map(p => p[0] * 10 + ',' + p[1] * 10).join(' ');
            const net = nl.wireNet.get(w.id);
            const col = sim ? volColor(sim.nodeV(net), vmax) : null;
            const selected = sel && sel.kind === 'wire' && sel.id === w.id;
            return html`<g key=${w.id}><polyline class=${'wire' + (selected ? ' sel' : '')} points=${pts} style=${col && !selected ? { stroke: col } : null}/><polyline class="hit" points=${pts} data-wire=${w.id}/></g>`;
          })}
          ${nl.junctions.map(([x, y]) => html`<circle key=${'j' + x + ',' + y} class="junc" cx=${x * 10} cy=${y * 10} r="2.6"/>`)}
          ${project.components.map(c => html`<${CompG} key=${c.id} c=${c} st=${readings ? readings[c.id] : undefined} selected=${sel && sel.kind === 'comp' && sel.id === c.id}/>`)}
          ${ghost && html`<g class="ghost"><${CompG} c=${ghost} selected=${false}/></g>`}
          ${preview && html`<polyline class="wprev" points=${preview.map(p => p[0] * 10 + ',' + p[1] * 10).join(' ')}/>`}
          ${(wire || tool === 'wire') && cursor && html`<circle class="cursor" cx=${cursor[0] * 10} cy=${cursor[1] * 10} r="4"/>`}
        </g>
      </svg>
      <div class="toolbar">
        <button class=${'btn small' + (tool === 'select' && !placing ? ' on' : '')} onClick=${() => { setTool('select'); setPlacing(null); }} title="Select and move (Esc)"><${Icon} n="cursor"/><span class="hide-sm">Select</span></button>
        <button class=${'btn small' + (tool === 'wire' ? ' on' : '')} onClick=${() => setTool(tool === 'wire' ? 'select' : 'wire')} title="Draw wires (W)"><${Icon} n="wire"/><span class="hide-sm">Wire</span></button>
        <div class="sep"></div>
        <button class="btn small" disabled=${!sel || sel.kind !== 'comp'} onClick=${() => commit(p => { const c = p.components.find(c => c.id === sel.id); if (c) c.rot = ((c.rot || 0) + 1) % 4; })} title="Rotate (R)"><${Icon} n="rotate"/></button>
        <button class="btn small" disabled=${!sel} onClick=${() => { commit(p => { if (sel.kind === 'comp') p.components = p.components.filter(c => c.id !== sel.id); else p.wires = p.wires.filter(w => w.id !== sel.id); }); setSel(null); }} title="Delete (Del)"><${Icon} n="trash"/></button>
        <button class="btn small" onClick=${fit} title="Fit to screen (F)"><${Icon} n="fit"/></button>
      </div>
      ${tip && html`<div class="tip" style=${{ left: tip.x, top: tip.y }}>${tip.text}</div>`}
      <div class="hint">${hint}</div>
    </div>`;
  }

  /* ---------- Palette ---------- */
  const PREVIEWS = {};
  function preview(type) {
    if (PREVIEWS[type]) return PREVIEWS[type];
    const c = CL.newComponent(type, 0, 0, []); c.props.code = '';
    const b = localBox(c), pad = 6;
    const s = `<svg class="sch" viewBox="${b[0] - pad} ${b[1] - pad} ${b[2] - b[0] + 2 * pad} ${b[3] - b[1] + 2 * pad}" preserveAspectRatio="xMidYMid meet">${D[type].draw(c, null)}</svg>`;
    return (PREVIEWS[type] = s);
  }
  function Palette({ placing, setPlacing, setTool }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(() => new Set(CL.CATEGORIES));
    const ql = q.trim().toLowerCase();
    return html`<div>
      <div class="sec"><h3>Components <span class="chip">${Object.keys(D).length}</span></h3>
        <input id="part-search" class="inp search" placeholder="Search parts — resistor, LED, 555…" value=${q} onInput=${e => setQ(e.target.value)}/></div>
      <div class="sec" style=${{ paddingTop: 2 }}>
        ${CL.CATEGORIES.map(cat => {
          const items = Object.values(D).filter(d => d.cat === cat && (!ql || d.name.toLowerCase().includes(ql) || d.type.includes(ql) || cat.toLowerCase().includes(ql)));
          if (!items.length) return null;
          const isOpen = ql || open.has(cat);
          return html`<div class="cat" key=${cat}>
            <button onClick=${() => setOpen(s => { const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n; })}>${cat}<span>${items.length}</span></button>
            ${isOpen && html`<div class="parts">${items.map(d => html`<button key=${d.type} class=${'part' + (placing === d.type ? ' on' : '')} title=${d.name}
                onClick=${() => { setPlacing(placing === d.type ? null : d.type); setTool('select'); }}>
                <div style=${{ width: '100%' }} dangerouslySetInnerHTML=${{ __html: preview(d.type) }}/><span>${d.name}</span></button>`)}</div>`}
          </div>`;
        })}
      </div>
    </div>`;
  }

  /* ---------- Inspector (schematic) ---------- */
  function PropField({ c, k, meta, commit, live }) {
    const v = c.props[k];
    const set = val => (meta.live ? live(c.id, { [k]: val }) : commit(p => { const x = p.components.find(x => x.id === c.id); if (x) { x.props[k] = val; if (meta.apply) meta.apply(x.props, val); } }));
    const id = `prop-${c.id}-${k}`;
    let input;
    if (meta.kind === 'select') input = html`<select id=${id} class="sel" value=${v} onChange=${e => set(e.target.value)}>${meta.options.map(o => html`<option key=${o} value=${o}>${o}</option>`)}</select>`;
    else if (meta.kind === 'slider') input = html`<div class="unit"><input id=${id} type="range" min=${meta.min} max=${meta.max} step=${meta.step} value=${v} onInput=${e => set(+e.target.value)}/><em style=${{ minWidth: 48, textAlign: 'right' }}>${(+v).toFixed(meta.step < 1 ? 1 : 0)} ${meta.unit}</em></div>`;
    else if (meta.kind === 'range') input = html`<div class="unit"><input id=${id} type="range" min="0" max="1" step="0.01" value=${v} onInput=${e => set(+e.target.value)}/><em>${Math.round(v * 100)}%</em></div>`;
    else if (meta.kind === 'bool') input = html`<label class="row"><input id=${id} type="checkbox" checked=${!!v} onChange=${e => set(e.target.checked)}/> ${v ? 'Yes' : 'No'}</label>`;
    else input = html`<${DeferredInput} id=${id} value=${String(v)} unit=${meta.unit} onCommit=${val => set(val)} validate=${meta.kind === 'si' ? (s => isFinite(CL.parseSI(s))) : null}/>`;
    return html`<div class="field"><label for=${id}>${meta.label}</label>${input}</div>`;
  }
  function DeferredInput({ id, value, unit, onCommit, validate }) {
    const [s, setS] = useState(value);
    useEffect(() => setS(value), [value]);
    const ok = !validate || validate(s);
    const done = () => { if (s !== value && ok) onCommit(s); else if (!ok) setS(value); };
    return html`<div class="unit"><input id=${id} class="inp" style=${ok ? null : { borderColor: 'var(--bad)' }} value=${s} onInput=${e => setS(e.target.value)} onBlur=${done} onKeyDown=${e => { if (e.key === 'Enter') e.target.blur(); }}/>${unit && html`<em>${unit}</em>`}</div>`;
  }
  function Readout({ r, c }) {
    if (!r) return null;
    const rows = [];
    if (r.v != null) rows.push(['Voltage', fmt(r.v, 'V')]);
    if (r.i != null) rows.push(['Current', fmt(r.i, 'A')]);
    if (r.p != null) rows.push(['Power', fmt(Math.abs(r.p), 'W')]);
    if (r.vbe != null) rows.push(['V(BE)', fmt(r.vbe, 'V')]);
    if (r.bright != null) rows.push(['Brightness', Math.round(Math.min(1, r.bright) * 100) + '%']);
    if (r.blown) rows.push(['State', 'BLOWN']);
    if (!rows.length) return null;
    return html`<div class="sec"><h3>Live readings <span class="chip ok">SIM</span></h3><dl class="read">${rows.map(([a, b]) => html`<dt key=${a}>${a}</dt><dd>${b}</dd>`)}</dl></div>`;
  }
  function InspectorSch({ project, nl, sel, setSel, commit, live, readings, sim, openCode }) {
    if (sel && sel.kind === 'comp') {
      const c = project.components.find(c => c.id === sel.id);
      if (!c) return null;
      const d = D[c.type];
      const fp = d.fp ? d.fp(c) : null;
      return html`<div>
        <div class="sec"><h3>${d.name}<span class="chip acc">${d.cat}</span></h3>
          <div class="field"><label for="ref-input">Reference</label><${DeferredInput} id="ref-input" value=${c.ref} onCommit=${v => commit(p => { const x = p.components.find(x => x.id === c.id); x.ref = v.trim() || x.ref; })}/></div>
          ${Object.entries(d.meta || {}).map(([k, m]) => html`<${PropField} key=${k} c=${c} k=${k} meta=${m} commit=${commit} live=${live}/>`)}
          <div class="field"><label>Footprint</label><span style=${{ fontFamily: 'var(--mono)', fontSize: 11.5, wordBreak: 'break-all' }}>${fp ? fp.name : 'virtual (no PCB part)'}</span></div>
          <div class="row" style=${{ marginTop: 4 }}>
            <button class="btn small" onClick=${() => commit(p => { const x = p.components.find(x => x.id === c.id); x.rot = ((x.rot || 0) + 1) % 4; })}><${Icon} n="rotate"/>Rotate</button>
            <button class="btn small" onClick=${() => { commit(p => { p.components = p.components.filter(x => x.id !== c.id); }); setSel(null); }}><${Icon} n="trash"/>Delete</button>
            ${d.board && html`<button class="btn small primary" onClick=${() => openCode(c.id)}><${Icon} n="code"/>Edit code</button>`}
          </div>
        </div>
        ${d.board ? html`<${PinTable} r=${readings && readings[c.id]} compact=${true}/>` : html`<${Readout} r=${readings && readings[c.id]} c=${c}/>`}
        <div class="sec"><h3>Pins</h3><ul class="list">${d.pins.map((p, i) => html`<li key=${i}><span style=${{ fontFamily: 'var(--mono)', minWidth: 34 }}>${p.n}</span><span style=${{ color: 'var(--muted)', flex: 1 }}>${(nl.pinNet.get(c.id) || [])[i]}</span>${sim && html`<span style=${{ fontFamily: 'var(--mono)' }}>${fmt(sim.nodeV((nl.pinNet.get(c.id) || [])[i]), 'V')}</span>`}</li>`)}</ul></div>
      </div>`;
    }
    if (sel && sel.kind === 'wire') {
      const w = project.wires.find(w => w.id === sel.id); if (!w) return null;
      const net = nl.wireNet.get(w.id);
      const len = w.pts.reduce((s, p, i) => (i ? s + Math.abs(p[0] - w.pts[i - 1][0]) + Math.abs(p[1] - w.pts[i - 1][1]) : 0), 0);
      return html`<div class="sec"><h3>Wire</h3><div class="kv">Net <b>${net}</b><br/>Segments <b>${w.pts.length - 1}</b> · length <b>${len}</b> grid${sim ? html`<br/>Voltage <b>${fmt(sim.nodeV(net), 'V')}</b>` : ''}</div>
        <div class="row" style=${{ marginTop: 8 }}><button class="btn small" onClick=${() => { commit(p => { p.wires = p.wires.filter(x => x.id !== w.id); }); setSel(null); }}><${Icon} n="trash"/>Delete wire</button></div></div>`;
    }
    const real = project.components.filter(c => !D[c.type].virtual).length;
    return html`<div>
      <div class="sec"><h3>Project</h3>
        <div class="field"><label for="proj-name">Name</label><${DeferredInput} id="proj-name" value=${project.name || ''} onCommit=${v => commit(p => { p.name = v; })}/></div>
        <div class="kv"><b>${real}</b> parts · <b>${project.wires.length}</b> wires · <b>${nl.nets.size}</b> nets</div>
      </div>
      <div class="sec"><h3>Electrical rules <span class=${'chip ' + (nl.warnings.length ? 'warn' : 'ok')}>${nl.warnings.length ? nl.warnings.length + ' issues' : 'clean'}</span></h3>
        ${nl.warnings.length ? html`<ul class="list">${nl.warnings.slice(0, 12).map((w, i) => html`<li key=${i} style=${{ cursor: w.comp ? 'pointer' : 'default' }} onClick=${() => w.comp && setSel({ kind: 'comp', id: w.comp })}><i class=${'dot ' + w.kind}></i>${w.msg}</li>`)}</ul>` : html`<div class="kv">Every pin is connected and there is a ground reference.</div>`}
      </div>
      <div class="sec"><h3>Shortcuts</h3><div class="keys">
        <kbd>W</kbd><span>wire tool</span><kbd>R</kbd><span>rotate part</span><kbd>Del</kbd><span>delete</span><kbd>Ctrl D</kbd><span>duplicate</span>
        <kbd>Ctrl Z</kbd><span>undo</span><kbd>F</kbd><span>fit view</span><kbd>Space</kbd><span>run / pause</span><kbd>Wheel</kbd><span>zoom</span></div></div>
    </div>`;
  }

  function PinTable({ r, compact }) {
    if (!r || !r.pins) return html`<div class="sec"><h3>Pin monitor</h3><div class="kv">Start the simulation to watch pin states.</div></div>`;
    const names = Object.keys(r.pins);
    const half = n => { const p = r.pins[n]; return p.v > (r.vdd || 3) / 2; };
    return html`<div class="sec"><h3>Pin monitor ${r.unpowered ? html`<span class="chip bad">no power</span>` : r.error ? html`<span class="chip bad">error</span>` : html`<span class="chip ok">running</span>`}</h3>
      ${r.board && html`<div class="kv" style=${{ marginBottom: 6 }}>${r.board}</div>`}
      ${r.unpowered && html`<div class="kv" style=${{ color: 'var(--bad)', marginBottom: 6 }}>The chip has no supply. Connect VCC and GND to a 1.8–5.5 V source.</div>`}
      ${r.error && html`<div class="kv" style=${{ color: 'var(--bad)', marginBottom: 6 }}>${r.error}</div>`}
      <table class="pins"><thead><tr><th>Pin</th><th>Mode</th><th></th><th style=${{ textAlign: 'right' }}>Volts</th></tr></thead><tbody>
      ${names.map(n => { const p = r.pins[n]; return html`<tr key=${n}><td>${n}${p.onboard ? html` <span style=${{ color: 'var(--muted)' }}>(LED)</span>` : ''}</td><td style=${{ color: 'var(--muted)' }}>${p.pwm != null ? 'PWM ' + Math.round(p.pwm * 100) + '%' : p.mode === 'INPUT_PULLUP' ? 'PULLUP' : p.mode === 'INPUT_PULLDOWN' ? 'PULLDN' : p.mode === 'DAC' ? 'DAC' : p.mode === 'OUTPUT' ? 'OUT' : 'IN'}</td><td><i class=${'lvl' + (half(n) ? ' on' : '')}></i></td><td style=${{ textAlign: 'right' }}>${p.v.toFixed(2)}</td></tr>`; })}
      </tbody></table></div>`;
  }

  /* ---------- PCB view ---------- */
  function route45(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < 1e-6 || ay < 1e-6 || Math.abs(ax - ay) < 1e-6) return [b];
    const d = Math.min(ax, ay); return [[a[0] + Math.sign(dx) * d, a[1] + Math.sign(dy) * d], b];
  }
  function PCBView(P) {
    const { project, nl, an, setProject, commit, pushHistory, pcbSel, setPcbSel, view, setView, tool, setTool, active, setActive, vis, markers, hlNet, setHlNet } = P;
    const cvRef = useRef(null), wrapRef = useRef(null), offRef = useRef({});
    const [size, setSize] = useState({ w: 800, h: 600 });
    const [route, setRoute] = useState(null);
    const [cur, setCur] = useState(null);
    const act = useRef(null);
    const pointers = useRef(new Map());
    const projRef = useRef(project); projRef.current = project;
    const B = project.board;
    const grid = B.grid || 0.635;
    useLayoutEffect(() => {
      const el = wrapRef.current; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
      ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect();
    }, []);
    const fit = useCallback(() => {
      const el = wrapRef.current; if (!el) return; const W = el.clientWidth, H = el.clientHeight; const b = projRef.current.board;
      let x1 = b.w, y1 = b.h; projRef.current.components.forEach(c => { if (c.pcb) { x1 = Math.max(x1, c.pcb.x + 8); y1 = Math.max(y1, c.pcb.y + 8); } });
      const s = CL.clamp(Math.min((W - 60) / x1, (H - 70) / y1), 1, 60);
      setView({ s, ox: (W - x1 * s) / 2, oy: (H - y1 * s) / 2 + 14 });
    }, [setView]);
    useEffect(() => { if (!view && size.w > 50) fit(); }, [view, fit, size.w]);
    useEffect(() => { P.fitRef.current = fit; }, [fit]);
    const Vw = view || { s: 8, ox: 40, oy: 40 };
    const toMM = e => { const r = cvRef.current.getBoundingClientRect(); return [(e.clientX - r.left - Vw.ox) / Vw.s, (e.clientY - r.top - Vw.oy) / Vw.s]; };
    const snap = ([x, y]) => [Math.round(x / grid) * grid, Math.round(y / grid) * grid];
    const padAt = (x, y, layer) => an.pads.find(pd => CL.inPad(pd, x, y, 0.15) && (!layer || pd.layers.includes(layer)));
    const viaAt = (x, y) => B.vias.find(v => Math.hypot(v.x - x, v.y - y) <= v.d / 2 + 0.1);
    const traceAt = (x, y) => { let best = null, bd = Infinity; for (const t of B.traces) { if (!vis[t.layer]) continue; for (let i = 1; i < t.pts.length; i++) { const d = CL.distPtSeg(x, y, t.pts[i - 1][0], t.pts[i - 1][1], t.pts[i][0], t.pts[i][1]); if (d < t.w / 2 + 3 / Vw.s && d < bd) { bd = d; best = t; } } } return best; };
    const compAt = (x, y) => { let best = null, ba = Infinity; for (const c of project.components) { if (!c.pcb) continue; const fp = CL.footprint(c); if (!fp) continue; const odd = (c.pcb.rot || 0) % 2; const w = odd ? fp.size[1] : fp.size[0], h = odd ? fp.size[0] : fp.size[1]; if (Math.abs(x - c.pcb.x) <= w / 2 && Math.abs(y - c.pcb.y) <= h / 2 && w * h < ba) { ba = w * h; best = c; } } return best; };

    const finishRoute = (r = route) => {
      if (r && r.pts.length >= 2) { const pts = r.pts.filter((p, i) => !i || Math.hypot(p[0] - r.pts[i - 1][0], p[1] - r.pts[i - 1][1]) > 1e-6); if (pts.length >= 2) commit(p => { p.board.traces.push({ id: CL.uid('t'), net: r.net, layer: r.layer, w: p.board.traceWidth, pts: pts.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]) }); }); }
      setRoute(null);
    };
    const placeViaInRoute = () => {
      if (!route) return;
      const last = route.pts[route.pts.length - 1];
      const cu = CL.copperLayers(B); const nextLayer = route.layer === cu[0] ? cu[cu.length - 1] : cu[0];
      const r = route;
      commit(p => {
        if (r.pts.length >= 2) p.board.traces.push({ id: CL.uid('t'), net: r.net, layer: r.layer, w: p.board.traceWidth, pts: r.pts.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]) });
        p.board.vias.push({ id: CL.uid('v'), x: +last[0].toFixed(3), y: +last[1].toFixed(3), d: p.board.viaD, drill: p.board.viaDrill, net: r.net });
      });
      setActive(nextLayer);
      setRoute({ net: r.net, layer: nextLayer, pts: [last] });
    };

    const onDown = e => {
      cvRef.current.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; act.current = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), v: { ...Vw }, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return; }
      const [x, y] = toMM(e);
      if (e.button === 1 || e.button === 2) { if (route && e.button === 2) { finishRoute(); return; } act.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, v: { ...Vw } }; return; }
      if (tool === 'route') {
        if (!route) {
          const pd = padAt(x, y, active); const v = viaAt(x, y); const t = traceAt(x, y);
          if (pd) setRoute({ net: pd.net, layer: active, pts: [[pd.x, pd.y]] });
          else if (v) setRoute({ net: v.net, layer: active, pts: [[v.x, v.y]] });
          else if (t) { const s = snap([x, y]); setRoute({ net: t.net, layer: t.layer, pts: [s] }); setActive(t.layer); }
          return;
        }
        const last = route.pts[route.pts.length - 1];
        const pd = padAt(x, y, route.layer);
        const target = pd && pd.net === route.net ? [pd.x, pd.y] : snap([x, y]);
        const pts = route.pts.concat(route45(last, target));
        if ((pd && pd.net === route.net) || e.detail >= 2) finishRoute({ ...route, pts }); else setRoute({ ...route, pts });
        return;
      }
      if (tool === 'via') {
        const s = snap([x, y]); const t = traceAt(x, y); const pd = padAt(x, y);
        commit(p => { p.board.vias.push({ id: CL.uid('v'), x: s[0], y: s[1], d: p.board.viaD, drill: p.board.viaDrill, net: (t && t.net) || (pd && pd.net) || hlNet || null }); });
        return;
      }
      if (tool === 'delete') {
        const v = viaAt(x, y); if (v) { commit(p => { p.board.vias = p.board.vias.filter(q => q.id !== v.id); }); return; }
        const t = traceAt(x, y); if (t) { commit(p => { p.board.traces = p.board.traces.filter(q => q.id !== t.id); }); return; }
        return;
      }
      const t = traceAt(x, y);
      const c = compAt(x, y);
      if (c) { setPcbSel({ kind: 'comp', id: c.id }); act.current = { kind: 'move', id: c.id, start: [x, y], orig: { x: c.pcb.x, y: c.pcb.y }, p0: projRef.current, moved: false }; return; }
      if (t) { setPcbSel({ kind: 'trace', id: t.id }); return; }
      const v = viaAt(x, y); if (v) { setPcbSel({ kind: 'via', id: v.id }); return; }
      setPcbSel(null);
      act.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, v: { ...Vw } };
    };
    const onMove = e => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const a = act.current;
      if (a && a.kind === 'pinch' && pointers.current.size === 2) {
        const [p, q] = [...pointers.current.values()]; const d = Math.hypot(p.x - q.x, p.y - q.y); const s = CL.clamp(a.v.s * d / a.d, 1, 80);
        const r = cvRef.current.getBoundingClientRect(); const mx = a.cx - r.left, my = a.cy - r.top;
        setView({ s, ox: mx - (mx - a.v.ox) * s / a.v.s, oy: my - (my - a.v.oy) * s / a.v.s }); return;
      }
      if (a && a.kind === 'pan') { setView({ s: a.v.s, ox: a.v.ox + e.clientX - a.sx, oy: a.v.oy + e.clientY - a.sy }); return; }
      const [x, y] = toMM(e);
      if (a && a.kind === 'move') {
        const nx = Math.round((a.orig.x + x - a.start[0]) / grid) * grid, ny = Math.round((a.orig.y + y - a.start[1]) / grid) * grid;
        if (!a.moved && Math.hypot(x - a.start[0], y - a.start[1]) < 0.3) return;
        a.moved = true;
        setProject(p => { const n = { ...p, components: p.components.map(c => (c.id === a.id ? { ...c, pcb: { ...c.pcb, x: +nx.toFixed(3), y: +ny.toFixed(3) } } : c)) }; return n; });
        return;
      }
      setCur([x, y]);
      const pd = padAt(x, y);
      const n = pd ? pd.net : null;
      if (n !== hlNet && !route) setHlNet(n);
    };
    const onUp = e => {
      pointers.current.delete(e.pointerId);
      const a = act.current;
      if (a && a.kind === 'move' && a.moved) pushHistory(a.p0);
      act.current = null;
    };
    useEffect(() => {
      const el = cvRef.current;
      const wheel = e => { e.preventDefault(); const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const s = CL.clamp(Vw.s * Math.exp(-e.deltaY * 0.0015), 1, 80); setView({ s, ox: mx - (mx - Vw.ox) * s / Vw.s, oy: my - (my - Vw.oy) * s / Vw.s }); };
      el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel);
    });
    useEffect(() => {
      const onKey = e => {
        if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
        const k = e.key.toLowerCase();
        if (k === 'escape') { if (route) finishRoute(); else setTool('select'); }
        else if (k === 'v' && route) placeViaInRoute();
        else if (k === 'x') setTool('route');
        else if (k === 's' && !e.ctrlKey && !e.metaKey) setTool('select');
        else if (k === 'l') { const cu = CL.copperLayers(B); const i = cu.indexOf(active); const nl2 = cu[(i + 1) % cu.length]; setActive(nl2); if (route) setRoute(r => ({ ...r, layer: nl2 })); }
        else if (k === 'f' && pcbSel && pcbSel.kind === 'comp') commit(p => { const c = p.components.find(c => c.id === pcbSel.id); c.pcb.side = c.pcb.side === 'B' ? 'F' : 'B'; });
        else if (k === 'f') fit();
        else if (k === 'r' && !e.ctrlKey && !e.metaKey && pcbSel && pcbSel.kind === 'comp') commit(p => { const c = p.components.find(c => c.id === pcbSel.id); c.pcb.rot = ((c.pcb.rot || 0) + 1) % 4; });
        else if ((k === 'delete' || k === 'backspace') && pcbSel) {
          commit(p => { if (pcbSel.kind === 'trace') p.board.traces = p.board.traces.filter(t => t.id !== pcbSel.id); else if (pcbSel.kind === 'via') p.board.vias = p.board.vias.filter(v => v.id !== pcbSel.id); });
          setPcbSel(null);
        }
      };
      window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    });

    // draw
    useEffect(() => {
      const cv = cvRef.current; if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(size.w * dpr)), h = Math.max(1, Math.floor(size.h * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const ctx = cv.getContext('2d');
      let preview = null;
      if (route && cur) { const last = route.pts[route.pts.length - 1]; const pd = padAt(cur[0], cur[1], route.layer); const tgt = pd && pd.net === route.net ? [pd.x, pd.y] : snap(cur); preview = { layer: route.layer, w: B.traceWidth, pts: route.pts.concat(route45(last, tgt)) }; }
      CL.drawPCB(ctx, project, { pads: an.pads, xf: { s: Vw.s * dpr, ox: Vw.ox * dpr, oy: Vw.oy * dpr }, vis, active, hl: route ? route.net : hlNet, rats: an.rats, w, h, off: offRef.current.c || (offRef.current.c = document.createElement('canvas')),
        selected: pcbSel && pcbSel.kind === 'comp' ? pcbSel.id : null, selTrace: pcbSel && pcbSel.kind === 'trace' ? pcbSel.id : null, markers, preview });
    });

    const hint = tool === 'route' ? (route ? `Routing ${route.net || 'unnamed net'} on ${route.layer} · click to add corners · V via + layer swap · L change layer · click a pad to finish · Esc ends` : 'Route: click a pad, via or track to start a trace on the active layer')
      : tool === 'via' ? 'Via: click to drop a via (it takes the net of the track or pad under it)' : tool === 'delete' ? 'Delete: click a track or via to remove it'
      : 'Drag footprints · R rotate · F flip to other side · X route · Del removes the selected track';
    return html`<div ref=${wrapRef} style=${{ position: 'absolute', inset: 0 }}>
      <canvas ref=${cvRef} class="full" onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp} onContextMenu=${e => e.preventDefault()} style=${{ cursor: tool === 'select' ? 'default' : 'crosshair' }}></canvas>
      <div class="toolbar">
        ${[['select', 'cursor', 'Select'], ['route', 'route', 'Route'], ['via', 'via', 'Via'], ['delete', 'trash', 'Delete']].map(([t, ic, lab]) => html`<button key=${t} class=${'btn small' + (tool === t ? ' on' : '')} onClick=${() => { finishRoute(); setTool(t); }} title=${lab}><${Icon} n=${ic}/><span class="hide-sm">${lab}</span></button>`)}
        <div class="sep"></div>
        ${CL.copperLayers(B).map(l => html`<button key=${l} class=${'btn small' + (active === l ? ' on' : '')} onClick=${() => { setActive(l); if (route) setRoute(r => ({ ...r, layer: l })); }} title=${'Active layer ' + l}><i style=${{ width: 10, height: 10, borderRadius: 2, background: CL.LAYER_COLORS[l], display: 'inline-block' }}></i>${l.replace('.Cu', '')}</button>`)}
        <div class="sep"></div>
        <button class="btn small" onClick=${fit} title="Fit board (F)"><${Icon} n="fit"/></button>
      </div>
      <div class="hint">${hint}${cur ? html` · <span style=${{ fontFamily: 'var(--mono)' }}>X ${cur[0].toFixed(2)} Y ${cur[1].toFixed(2)} mm</span>` : ''}</div>
    </div>`;
  }

  function LayersPanel({ project, commit, vis, setVis, active, setActive, an, drc, runDRC, autoroute, clearRoutes }) {
    const B = project.board;
    const cu = CL.copperLayers(B);
    const rows = cu.map(l => [l, 'copper']).concat([['F.SilkS', 'silkscreen'], ['B.SilkS', 'silkscreen'], ['Edge.Cuts', 'outline'], ['Drill', 'holes'], ['Ratsnest', 'airwires']]);
    const nets = [...new Set(an.pads.map(p => p.net).filter(Boolean))].sort();
    const total = an.rats.length + project.board.traces.length;
    const setB = (k, v) => commit(p => { p.board[k] = v; });
    const num = (k, label, unit, step = 0.05) => html`<div class="field"><label for=${'b-' + k}>${label}</label><${DeferredInput} id=${'b-' + k} value=${String(B[k])} unit=${unit} validate=${s => isFinite(+s) && +s > 0} onCommit=${v => setB(k, +v)}/></div>`;
    return html`<div>
      <div class="sec"><h3>Layers <span class="chip">${B.layers}-layer</span></h3>
        ${rows.map(([l, kind]) => html`<div key=${l} class=${'layer' + (active === l ? ' active' : '')} onClick=${() => kind === 'copper' && setActive(l)}>
          <button class="eye" onClick=${e => { e.stopPropagation(); setVis(v => ({ ...v, [l]: !(v[l] !== false) })); }} aria-label=${'Toggle ' + l}><${Icon} n=${vis[l] !== false ? 'eye' : 'eyeoff'}/></button>
          <i class="sw" style=${{ background: l === 'Ratsnest' ? '#e8eef2' : CL.LAYER_COLORS[l] }}></i><span>${l}</span><em>${kind}</em></div>`)}
      </div>
      <div class="sec"><h3>Routing</h3>
        <div class="kv" style=${{ marginBottom: 6 }}><b>${an.rats.length}</b> connections left · <b>${B.traces.length}</b> tracks · <b>${B.vias.length}</b> vias</div>
        <div class="meter" style=${{ marginBottom: 10 }}><i style=${{ width: (an.rats.length ? Math.max(4, 100 * (1 - an.rats.length / Math.max(1, an.rats.length + B.traces.length))) : 100) + '%' }}></i></div>
        <div class="row">
          <button class="btn small primary" data-tour="autoroute" onClick=${autoroute}><${Icon} n="bolt"/>Autoroute</button>
          <button class="btn small" onClick=${runDRC}><${Icon} n="check"/>Run DRC</button>
          <button class="btn small" onClick=${clearRoutes}><${Icon} n="trash"/>Clear tracks</button>
        </div>
        ${drc && html`<div class="kv" style=${{ marginTop: 8 }}>DRC: <span class=${'chip ' + (drc.issues.filter(i => i.sev === 'error').length ? 'bad' : drc.issues.length ? 'warn' : 'ok')}>${drc.issues.filter(i => i.sev === 'error').length} errors · ${drc.issues.filter(i => i.sev !== 'error').length} warnings</span></div>`}
      </div>
      <div class="sec"><h3>Board setup</h3>
        <div class="field"><label for="b-layers">Stack-up</label><select id="b-layers" class="sel" value=${B.layers} onChange=${e => commit(p => { p.board.layers = +e.target.value; const cu2 = CL.copperLayers(p.board); p.board.traces = p.board.traces.filter(t => cu2.includes(t.layer)); Object.keys(p.board.pour || {}).forEach(k => { if (!cu2.includes(k)) delete p.board.pour[k]; }); })}><option value="2">2 layers</option><option value="4">4 layers</option></select></div>
        ${num('w', 'Width', 'mm', 1)}${num('h', 'Height', 'mm', 1)}
        ${num('traceWidth', 'Track width', 'mm')}${num('clearance', 'Clearance', 'mm')}
        ${num('viaD', 'Via pad', 'mm')}${num('viaDrill', 'Via drill', 'mm')}
        <div class="field"><label for="b-grid">Grid</label><select id="b-grid" class="sel" value=${B.grid || 0.635} onChange=${e => setB('grid', +e.target.value)}>${[0.25, 0.5, 0.635, 1.27, 2.54].map(g => html`<option key=${g} value=${g}>${g} mm</option>`)}</select></div>
      </div>
      <div class="sec"><h3>Copper pours</h3>
        ${cu.map(l => html`<div class="field" key=${l}><label for=${'pour-' + l}>${l}</label><select id=${'pour-' + l} class="sel" value=${(B.pour && B.pour[l]) || ''} onChange=${e => commit(p => { p.board.pour = p.board.pour || {}; if (e.target.value) p.board.pour[l] = e.target.value; else delete p.board.pour[l]; })}><option value="">none</option>${nets.map(n => html`<option key=${n} value=${n}>${n}</option>`)}</select></div>`)}
      </div>
    </div>`;
  }

  function InspectorPCB({ project, commit, pcbSel, setPcbSel, an }) {
    const B = project.board;
    if (pcbSel && pcbSel.kind === 'comp') {
      const c = project.components.find(c => c.id === pcbSel.id); if (!c || !c.pcb) return null;
      const d = D[c.type], fp = d.fp(c);
      const upd = f => commit(p => { const x = p.components.find(x => x.id === c.id); f(x); });
      return html`<div class="sec"><h3>${c.ref}<span class="chip acc">${d.name}</span></h3>
        <div class="field"><label>Footprint</label><span style=${{ fontFamily: 'var(--mono)', fontSize: 11.5, wordBreak: 'break-all' }}>${fp.name}</span></div>
        ${d.meta && d.meta.package && html`<div class="field"><label for="pcb-pkg">Package</label><select id="pcb-pkg" class="sel" value=${c.props.package} onChange=${e => upd(x => { x.props.package = e.target.value; })}>${d.meta.package.options.map(o => html`<option key=${o}>${o}</option>`)}</select></div>`}
        <div class="field"><label for="pcb-x">X</label><${DeferredInput} id="pcb-x" value=${String(c.pcb.x)} unit="mm" validate=${s => isFinite(+s)} onCommit=${v => upd(x => { x.pcb.x = +v; })}/></div>
        <div class="field"><label for="pcb-y">Y</label><${DeferredInput} id="pcb-y" value=${String(c.pcb.y)} unit="mm" validate=${s => isFinite(+s)} onCommit=${v => upd(x => { x.pcb.y = +v; })}/></div>
        <div class="field"><label>Rotation</label><span>${(c.pcb.rot || 0) * 90}°</span></div>
        <div class="field"><label for="pcb-side">Side</label><select id="pcb-side" class="sel" value=${c.pcb.side || 'F'} onChange=${e => upd(x => { x.pcb.side = e.target.value; })}><option value="F">Top (F)</option><option value="B">Bottom (B)</option></select></div>
        <div class="row"><button class="btn small" onClick=${() => upd(x => { x.pcb.rot = ((x.pcb.rot || 0) + 1) % 4; })}><${Icon} n="rotate"/>Rotate</button>
          <button class="btn small" onClick=${() => upd(x => { x.pcb.side = x.pcb.side === 'B' ? 'F' : 'B'; })}><${Icon} n="flip"/>Flip side</button></div>
        <div class="kv" style=${{ marginTop: 10 }}>Pads</div>
        <ul class="list">${an.pads.filter(p => p.comp.id === c.id).map(p => html`<li key=${p.num}><span style=${{ fontFamily: 'var(--mono)', minWidth: 22 }}>${p.num}</span><span style=${{ color: 'var(--muted)' }}>${p.net || 'no net'}</span><span style=${{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11 }}>${p.smd ? 'SMD' : 'Ø' + p.drill}</span></li>`)}</ul>
      </div>`;
    }
    if (pcbSel && pcbSel.kind === 'trace') {
      const t = B.traces.find(t => t.id === pcbSel.id); if (!t) return null;
      const len = t.pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - t.pts[i - 1][0], p[1] - t.pts[i - 1][1]) : 0), 0);
      const upd = f => commit(p => { const x = p.board.traces.find(x => x.id === t.id); f(x); });
      return html`<div class="sec"><h3>Track<span class="chip acc">${t.net || 'no net'}</span></h3>
        <div class="field"><label for="tr-layer">Layer</label><select id="tr-layer" class="sel" value=${t.layer} onChange=${e => upd(x => { x.layer = e.target.value; })}>${CL.copperLayers(B).map(l => html`<option key=${l}>${l}</option>`)}</select></div>
        <div class="field"><label for="tr-w">Width</label><${DeferredInput} id="tr-w" value=${String(t.w)} unit="mm" validate=${s => +s > 0} onCommit=${v => upd(x => { x.w = +v; })}/></div>
        <div class="kv">Length <b>${len.toFixed(2)} mm</b> · ${t.pts.length - 1} segments</div>
        <div class="row" style=${{ marginTop: 8 }}><button class="btn small" onClick=${() => { commit(p => { p.board.traces = p.board.traces.filter(x => x.id !== t.id); }); setPcbSel(null); }}><${Icon} n="trash"/>Delete track</button></div></div>`;
    }
    if (pcbSel && pcbSel.kind === 'via') {
      const v = B.vias.find(v => v.id === pcbSel.id); if (!v) return null;
      return html`<div class="sec"><h3>Via<span class="chip acc">${v.net || 'no net'}</span></h3><div class="kv">Pad <b>${v.d} mm</b> · drill <b>${v.drill} mm</b><br/>at ${v.x.toFixed(2)}, ${v.y.toFixed(2)} mm</div>
        <div class="row" style=${{ marginTop: 8 }}><button class="btn small" onClick=${() => { commit(p => { p.board.vias = p.board.vias.filter(x => x.id !== v.id); }); setPcbSel(null); }}><${Icon} n="trash"/>Delete via</button></div></div>`;
    }
    const holes = an.pads.filter(p => p.drill).length + B.vias.length;
    const smd = an.pads.filter(p => p.smd).length;
    const offBoard = project.components.filter(c => c.pcb && (c.pcb.x > B.w || c.pcb.y > B.h || c.pcb.x < 0 || c.pcb.y < 0)).length;
    return html`<div>
      <div class="sec"><h3>Board</h3><div class="kv"><b>${B.w} × ${B.h} mm</b> · ${B.layers} copper layers · ${B.thickness} mm FR-4<br/>${an.pads.length} pads (${smd} SMD) · ${holes} drilled holes<br/>Min track ${B.traceWidth} mm · clearance ${B.clearance} mm</div>
        ${offBoard ? html`<div class="kv" style=${{ marginTop: 8, color: 'var(--warn)' }}>${offBoard} footprint${offBoard > 1 ? 's are' : ' is'} parked outside the outline. Drag ${offBoard > 1 ? 'them' : 'it'} onto the board.</div>` : null}</div>
      <div class="sec"><h3>Shortcuts</h3><div class="keys"><kbd>X</kbd><span>route track</span><kbd>V</kbd><span>via while routing</span><kbd>L</kbd><span>next copper layer</span><kbd>R</kbd><span>rotate footprint</span><kbd>F</kbd><span>flip side / fit</span><kbd>Esc</kbd><span>finish route</span></div></div>
    </div>`;
  }

  /* ---------- 3D ---------- */
  function View3D({ project, readings, opts, apiRef }) {
    const ref = useRef(null), b3 = useRef(null);
    useEffect(() => {
      if (!window.THREE) return;
      const b = new CL.Board3D(ref.current); b3.current = b; apiRef.current = b;
      return () => { b.dispose(); b3.current = null; };
    }, []);
    useEffect(() => {
      const b = b3.current; if (!b) return;
      const id = setTimeout(() => { b.setBackground(getComputedStyle(document.documentElement).getPropertyValue('--stage-dark').trim() || '#0c1216'); b.build(project, opts); b.setReadings(readings); }, 60);
      return () => clearTimeout(id);
    }, [project, opts.components]);
    useEffect(() => { if (b3.current) b3.current.setReadings(readings); }, [readings]);
    if (!window.THREE) return html`<div class="empty">The 3D engine didn't load. Check your connection and reload.</div>`;
    return html`<div style=${{ position: 'absolute', inset: 0 }}><div ref=${ref} style=${{ position: 'absolute', inset: 0 }}></div>
      <div class="toolbar">${['iso', 'top', 'bottom'].map(v => html`<button key=${v} class="btn small" onClick=${() => b3.current && b3.current.view(v)}>${v === 'iso' ? 'Perspective' : v === 'top' ? 'Top' : 'Bottom'}</button>`)}</div>
      <div class="hint">Drag to orbit · right-drag or Shift-drag to pan · wheel to zoom${readings ? ' · LEDs follow the live simulation' : ''}</div></div>`;
  }
  const MASKS = [['#1d6b45', 'Green'], ['#173f8a', 'Blue'], ['#8c1d24', 'Red'], ['#141414', 'Black'], ['#efefe9', 'White'], ['#4b2a7b', 'Purple'], ['#c58f17', 'Yellow']];
  function Panel3D({ project, commit, opts, setOpts }) {
    const B = project.board;
    return html`<div>
      <div class="sec"><h3>Solder mask</h3><div class="swatches">${MASKS.map(([c, n]) => html`<button key=${c} title=${n} aria-label=${n} class=${B.mask === c ? 'on' : ''} style=${{ background: c }} onClick=${() => commit(p => { p.board.mask = c; p.board.silk = c === '#efefe9' ? '#1b1b1b' : '#f4f4ef'; })}></button>`)}</div></div>
      <div class="sec"><h3>Fabrication</h3>
        <div class="field"><label for="fin">Surface finish</label><select id="fin" class="sel" value=${B.finish} onChange=${e => commit(p => { p.board.finish = e.target.value; })}><option value="ENIG">ENIG (gold)</option><option value="HASL">HASL (tin)</option></select></div>
        <div class="field"><label for="thk">Thickness</label><select id="thk" class="sel" value=${B.thickness} onChange=${e => commit(p => { p.board.thickness = +e.target.value; })}>${[0.8, 1.0, 1.2, 1.6, 2.0].map(t => html`<option key=${t} value=${t}>${t} mm</option>`)}</select></div>
        <div class="field"><label for="silkc">Silkscreen</label><select id="silkc" class="sel" value=${B.silk} onChange=${e => commit(p => { p.board.silk = e.target.value; })}><option value="#f4f4ef">White</option><option value="#1b1b1b">Black</option><option value="#f2d64b">Yellow</option></select></div>
      </div>
      <div class="sec"><h3>View</h3><label class="row"><input id="show-comp" type="checkbox" checked=${opts.components !== false} onChange=${e => setOpts(o => ({ ...o, components: e.target.checked }))}/> Show components</label></div>
    </div>`;
  }

  /* ---------- Code ---------- */
  function CodeView({ project, commit, mcuId, setMcuId, startSim, running, readings }) {
    const mcus = project.components.filter(c => D[c.type].board);
    const mcu = mcus.find(m => m.id === mcuId) || mcus[0];
    const board = mcu ? CL.BOARDS[D[mcu.type].board] : null;
    const [draft, setDraft] = useState(mcu ? mcu.props.code : '');
    const [status, setStatus] = useState(null);
    const taRef = useRef(null), gutRef = useRef(null);
    useEffect(() => { setDraft(mcu ? mcu.props.code : ''); setStatus(null); }, [mcu && mcu.id]);
    if (!mcu) return html`<div class="empty" style=${{ padding: 30 }}><b>No microcontroller in this design.</b><br/>Add a board from the Microcontroller section of the palette (Arduino Uno, Nano, Mega, ESP32, Raspberry Pi Pico, STM32 Blue Pill or ATtiny85), wire it up, then write its sketch here.</div>`;
    const upload = () => {
      const rt = new CL.McuRuntime(draft, { read: () => 0, vdd: () => board.logic, serial: () => {} }, board);
      if (rt.error) { setStatus({ ok: false, msg: rt.error }); return; }
      setStatus({ ok: true, msg: `Compiled · ${draft.split('\n').length} lines · uploaded to ${mcu.ref}` });
      commit(p => { const m = p.components.find(c => c.id === mcu.id); m.props.code = draft; });
      if (!running) setTimeout(startSim, 30);
    };
    const onKey = e => {
      if (e.key === 'Tab') { e.preventDefault(); const t = e.target, s = t.selectionStart, en = t.selectionEnd; const v = draft.slice(0, s) + '  ' + draft.slice(en); setDraft(v); requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; }); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's')) { e.preventDefault(); upload(); }
    };
    const lines = draft.split('\n').length;
    const dirty = draft !== mcu.props.code;
    return html`<div class="code">
      <div class="codebar">
        <select id="mcu-pick" class="sel" value=${mcu.id} onChange=${e => setMcuId(e.target.value)}>${mcus.map(m => html`<option key=${m.id} value=${m.id}>${m.ref} · ${CL.BOARDS[D[m.type].board].name}</option>`)}</select>
        <select id="sketch-pick" class="sel" value="" onChange=${e => { if (e.target.value) { setDraft(CL.SKETCHES[e.target.value].code); setStatus(null); } }}><option value="">Load example sketch…</option>
          <optgroup label=${'For the ' + board.name}>${Object.entries(CL.SKETCHES).filter(([k, s]) => s.boards === 'any' || (s.boards || []).includes(board.type)).map(([k, s]) => html`<option key=${k} value=${k}>${s.name}</option>`)}</optgroup>
          <optgroup label="Other boards">${Object.entries(CL.SKETCHES).filter(([k, s]) => !(s.boards === 'any' || (s.boards || []).includes(board.type))).map(([k, s]) => html`<option key=${k} value=${k}>${s.name}</option>`)}</optgroup></select>
        <span class="spacer"></span>
        ${dirty ? html`<span class="chip warn">not uploaded</span>` : html`<span class="chip">in sync</span>`}
        <button class="btn primary" data-tour="upload" onClick=${upload}><${Icon} n="upload"/>Upload & run</button>
      </div>
      <div style=${{ display: 'grid', gridTemplateRows: 'minmax(0,1fr) auto', minHeight: 0 }}>
        <div class="editor">
          <div class="gutter" ref=${gutRef}>${Array.from({ length: lines }, (_, i) => i + 1).join('\n')}</div>
          <textarea id="sketch" ref=${taRef} spellcheck="false" value=${draft} onInput=${e => setDraft(e.target.value)} onKeyDown=${onKey} onScroll=${e => { if (gutRef.current) gutRef.current.scrollTop = e.target.scrollTop; }} aria-label="Sketch source"></textarea>
        </div>
        ${status && html`<div style=${{ padding: '6px 12px', borderTop: '1px solid var(--line)', fontSize: 13, color: status.ok ? 'var(--ok)' : 'var(--bad)', fontFamily: 'var(--mono)' }}>${status.msg}</div>`}
      </div>
    </div>`;
  }
  function ApiRef({ board }) {
    const B = board || CL.BOARDS.arduino_uno, f = B.features || [];
    const adcMax = Math.pow(2, B.adcBits) - 1;
    const fns = [['pinMode(pin, mode)', 'INPUT, OUTPUT, INPUT_PULLUP' + (B.pulldown ? ', INPUT_PULLDOWN' : '')], ['digitalWrite(pin, v) · digitalRead(pin)', `HIGH / LOW · threshold ${(B.logic / 2).toFixed(2)} V`],
      ['analogRead(pin)', `→ 0–${adcMax} over 0–${B.adcRef === 'vcc' ? 'VCC' : B.adcRef + ' V'}`], ['analogWrite(pin, 0–255)', `${B.pwmFreq} Hz PWM${B.pwm === 'all' ? ' on any output' : ''}`],
      ['tone(pin, Hz, ms) · noTone(pin)', 'square wave'], ['delay · delayMicroseconds', 'advance simulated time'], ['millis() · micros()', 'simulated clock'],
      ['attachInterrupt(n, fn, mode)', 'n = digitalPinToInterrupt(pin) · RISING, FALLING, CHANGE'], ['pulseIn(pin, HIGH, timeout)', 'pulse width in µs'], ['shiftOut / shiftIn', 'bit-banged, for 74HC595'],
      ['Serial.print / println / printf', 'to the Serial tab']];
    if (f.includes('res')) fns.push(['analogReadResolution(bits)', 'up to 12 bits']);
    if (f.includes('ledc')) fns.push(['ledcAttach(pin, freq, bits) · ledcWrite', 'ESP32 LEDC PWM'], ['dacWrite(25 or 26, 0–255)', 'true analog output']);
    const libs = [['Servo', 'attach, write(angle), writeMicroseconds'], ['LiquidCrystal_I2C', 'init, backlight, setCursor, print, clear'], ['DHT', 'begin, readTemperature, readHumidity'], ['Wire', 'accepted; I²C devices are linked by wiring']];
    return html`<div>
      <div class="sec"><h3>${B.name}</h3><div class="kv"><b>${B.chip}</b> · ${B.clock} · ${B.logic} V logic${B.selfPowered ? '' : ' (from VCC)'}<br/>${B.summary}</div></div>
      <div class="sec"><h3>Sketch API</h3><div class="api">${fns.map(([a, b]) => html`<div key=${a}><b>${a}</b><br/>${b}</div>`)}</div></div>
      <div class="sec"><h3>Libraries</h3><div class="api">${libs.map(([a, b]) => html`<div key=${a}><b>#include &lt;${a}.h&gt;</b><br/>${b}</div>`)}</div></div>
      <div class="sec"><h3>How it runs</h3><div class="kv">Sketches use Arduino-style C. Each upload is translated and stepped against the circuit solver, so a pin you write changes node voltages on the next time-step and every <b>delay()</b> moves the simulation clock. Integer division follows JavaScript, so wrap it in <b>floor()</b> when it matters.</div></div>
      <div class="sec"><h3>Shortcuts</h3><div class="keys"><kbd>Ctrl Enter</kbd><span>upload & run</span><kbd>Tab</kbd><span>indent</span></div></div>
    </div>`;
  }

  /* ---------- Dock: scope / serial / checks ---------- */
  const WINDOWS = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
  function Scope({ simRef, scopeRef, frame, windowS, setWindowS, probes }) {
    const ref = useRef(null);
    const sim = simRef.current;
    useEffect(() => {
      const cv = ref.current; if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(1, cv.clientWidth * dpr), H = Math.max(1, cv.clientHeight * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const ctx = cv.getContext('2d');
      ctx.fillStyle = (getComputedStyle(cv).getPropertyValue('--scope-bg') || '').trim() || '#0d1517'; ctx.fillRect(0, 0, W, H);
      const L = 44 * dpr, R = 10 * dpr, T = 10 * dpr, Bm = 20 * dpr, pw = W - L - R, ph = H - T - Bm;
      const sc = scopeRef.current;
      const t1 = sim ? sim.t : windowS, t0 = t1 - windowS;
      let vmin = Infinity, vmax = -Infinity;
      for (const id in sc.ch) { const ch = sc.ch[id]; for (let i = 0; i < ch.t.length; i++) if (ch.t[i] >= t0) { vmin = Math.min(vmin, ch.v[i]); vmax = Math.max(vmax, ch.v[i]); } }
      if (!isFinite(vmin)) { vmin = 0; vmax = 5; }
      if (vmax - vmin < 0.2) { const m = (vmax + vmin) / 2; vmin = m - 0.5; vmax = m + 0.5; }
      const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
      const div = steps.find(s => s * 8 >= (vmax - vmin) * 1.1) || 50;
      const mid = Math.round(((vmax + vmin) / 2) / div) * div;
      const lo = mid - 4 * div;
      const X = t => L + (t - t0) / windowS * pw, Y = v => T + ph - (v - lo) / (8 * div) * ph;
      ctx.strokeStyle = 'rgba(120,200,190,0.14)'; ctx.lineWidth = 1;
      ctx.beginPath(); for (let i = 0; i <= 10; i++) { const x = L + pw * i / 10; ctx.moveTo(x, T); ctx.lineTo(x, T + ph); } for (let j = 0; j <= 8; j++) { const y = T + ph * j / 8; ctx.moveTo(L, y); ctx.lineTo(L + pw, y); } ctx.stroke();
      ctx.strokeStyle = 'rgba(120,200,190,0.35)'; ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + pw, Y(0)); ctx.stroke();
      ctx.fillStyle = '#7f9a9b'; ctx.font = `${10.5 * dpr}px 'IBM Plex Mono', monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let j = 0; j <= 8; j += 2) ctx.fillText(fmt(lo + j * div, 'V', 2), L - 5 * dpr, T + ph - ph * j / 8);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`${fmt(windowS / 10, 's', 2)}/div   ${fmt(div, 'V', 2)}/div`, L + 4 * dpr, T + ph + 5 * dpr);
      ctx.lineWidth = 1.6 * dpr; ctx.lineJoin = 'round';
      for (const pr of probes) {
        const ch = sc.ch[pr.id]; if (!ch) continue;
        ctx.strokeStyle = pr.color; ctx.beginPath(); let started = false;
        for (let i = 0; i < ch.t.length; i++) { if (ch.t[i] < t0) continue; const x = X(ch.t[i]), y = Y(ch.v[i]); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }, [frame, windowS, probes.length]);
    return html`<div class="scope"><div class="scopecv"><canvas ref=${ref}></canvas></div>
      <div class="legend">
        <div class="row" style=${{ marginBottom: 6 }}><label for="tb" style=${{ fontFamily: 'var(--ui)' }}>Window</label><select id="tb" class="sel" style=${{ background: '#142024', color: '#d7e5e3', borderColor: '#24363b' }} value=${windowS} onChange=${e => { setWindowS(+e.target.value); scopeRef.current.ch = {}; }}>${WINDOWS.map(w => html`<option key=${w} value=${w}>${fmt(w, 's', 2)}</option>`)}</select></div>
        ${probes.length ? probes.map(pr => { const ch = scopeRef.current.ch[pr.id]; const v = ch && ch.v.length ? ch.v[ch.v.length - 1] : null; return html`<div key=${pr.id} class="ch"><i style=${{ background: pr.color }}></i>${pr.ref}<b>${v == null ? '—' : fmt(v, 'V')}</b></div>`; })
          : html`<p>Place a Scope Probe (Instruments) on a wire or pin to plot it here.</p>`}
      </div></div>`;
  }

  /* ---------- Export ---------- */
  function schematicSVG(p, nl) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    p.components.forEach(c => { const b = compBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); });
    p.wires.forEach(w => w.pts.forEach(([x, y]) => { x0 = Math.min(x0, x * 10); y0 = Math.min(y0, y * 10); x1 = Math.max(x1, x * 10); y1 = Math.max(y1, y * 10); }));
    if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 100; y1 = 100; }
    x0 -= 30; y0 -= 30; x1 += 30; y1 += 30;
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let body = '';
    p.wires.forEach(w => { body += `<polyline class="wire" points="${w.pts.map(q => q[0] * 10 + ',' + q[1] * 10).join(' ')}"/>`; });
    nl.junctions.forEach(([x, y]) => { body += `<circle class="junc" cx="${x * 10}" cy="${y * 10}" r="2.6"/>`; });
    p.components.forEach(c => {
      const d = D[c.type];
      body += `<g transform="translate(${c.x * 10} ${c.y * 10})">${svgSymbolString(c, null)}`;
      CL.labelAnchors(c).forEach(l => { body += `<text x="${l.x}" y="${l.y}" class="${l.cls}" text-anchor="${l.ta}">${esc(l.text)}</text>`; });
      body += '</g>';
    });
    const css = `.s{fill:none;stroke:#22343a;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.s.w{stroke-width:2.3}.s.w2{stroke-width:3.6}.s.acc{stroke:#b85a1a}.f{fill:#22343a}.b{fill:#fff;stroke:#22343a;stroke-width:1.5}.b.dark{fill:#17191b}.b.mcu{fill:#dde9f2}.b.inst{fill:#e2e8e8}.icbody{fill:#1b1f22}.chiplbl{fill:#c9d2d4;font:600 6px monospace;text-anchor:middle}.chiplbl.b2{fill:#5a6b70}.t,.lbl{font:600 8px monospace;fill:#22343a}.pinlbl{font:500 6.2px monospace;fill:#5a6b70}.pinlbl.b3{font:700 7px sans-serif;fill:#22343a;letter-spacing:.08em}.brdlbl{font:700 8px sans-serif;fill:#fff;text-anchor:middle;letter-spacing:.1em}.lcdtxt{font:600 10px monospace;fill:#16260c}.mlbl{font:700 12px sans-serif;fill:#22343a;text-anchor:middle}.ref{font:600 9px sans-serif;fill:#1b292d}.val{font:500 7.6px monospace;fill:#5a6b70}.wire{fill:none;stroke:#17707b;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}.junc{fill:#17707b}.glow{display:none}`;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${(x1 - x0) * 2}" height="${(y1 - y0) * 2}" style="--seg-off:#eee;--sym-fill:#fff"><style>${css}</style><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#fbfcf9"/>${body}<text x="${x1 - 8}" y="${y1 - 8}" text-anchor="end" class="val">${esc(p.name || '')} · Copperline Studio</text></svg>\n`;
  }
  const SAVEABLE = /\.(csv|json|svg|txt|zip|md|html)$/i;
  function ExportDialog({ project, nl, onClose, dl, toast }) {
    const files = useMemo(() => {
      const base = (project.name || 'copperline').replace(/[^\w-]+/g, '_');
      const out = [];
      const g = CL.exportGerbers(project);
      Object.entries(g).forEach(([n, c]) => out.push({ group: 'Fabrication · Gerber X2 + Excellon', name: n, content: c }));
      out.push({ group: 'Assembly', name: `${base}-BOM.csv`, content: CL.exportBOM(project) });
      out.push({ group: 'Assembly', name: `${base}-CPL.csv`, content: CL.exportCPL(project) });
      out.push({ group: 'Netlists & simulation', name: `${base}.net`, content: CL.exportKicadNet(project) });
      out.push({ group: 'Netlists & simulation', name: `${base}.cir`, content: CL.exportSpice(project, project.sim.dt, Math.max(0.01, project.sim.timebase || 0.01)) });
      out.push({ group: 'Design files', name: `${base}.copperline.json`, content: JSON.stringify(project, null, 1) });
      out.push({ group: 'Design files', name: `${base}-schematic.svg`, content: schematicSVG(project, nl) });
      return out;
    }, [project, nl]);
    const [cur, setCur] = useState(files[0].name);
    const f = files.find(x => x.name === cur) || files[0];
    const groups = [...new Set(files.map(x => x.group))];
    const save = async (filename, data) => {
      if (!dl) {
        try {
          const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          toast('Downloaded ' + filename);
        } catch (e) { toast('Saving is not available here. Use Copy instead.'); }
        return;
      }
      try { await dl.save({ filename, data }); toast('Saved ' + filename); }
      catch (e) { if (e && e.code === 'declined') return; toast(e && e.code === 'rate_limited' ? 'Another save is in progress' : 'Could not save: ' + ((e && e.message) || 'unavailable')); }
    };
    const zipAll = async (filter, name) => {
      if (!window.JSZip) { toast('The zip library did not load.'); return; }
      const z = new JSZip();
      const sel = files.filter(filter);
      sel.forEach(x => z.file(x.name, x.content));
      const B = project.board;
      z.file('README.txt', `${project.name || 'Copperline project'}\nGenerated by Copperline Studio ${new Date().toISOString().slice(0, 10)}\n\nBoard: ${B.w} x ${B.h} mm, ${B.layers} copper layers, ${B.thickness} mm FR-4\nFinish: ${B.finish}  Mask colour: ${B.mask}\nMin track ${B.traceWidth} mm, clearance ${B.clearance} mm, via ${B.viaD}/${B.viaDrill} mm\nUnits: millimetres. Origin: bottom-left board corner. Gerber RS-274X with X2 attributes, Excellon drill (decimal, metric).\n\nFiles:\n${sel.map(x => ' - ' + x.name).join('\n')}\n`);
      const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      save(name, blob);
    };
    const copy = async () => {
      try { await navigator.clipboard.writeText(f.content); toast('Copied ' + f.name); }
      catch (e) { const pre = document.getElementById('export-pre'); const r = document.createRange(); r.selectNodeContents(pre); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); toast('Text selected. Press Ctrl+C to copy.'); }
    };
    const base = (project.name || 'copperline').replace(/[^\w-]+/g, '_');
    return html`<div class="modal" onPointerDown=${e => { if (e.target.classList.contains('modal')) onClose(); }}>
      <div class="sheet" role="dialog" aria-label="Export">
        <header><h2>Export</h2><span class="chip">${project.board.w}×${project.board.h} mm · ${project.board.layers} layers</span><span class="spacer"></span>
          <button class="btn primary" onClick=${() => zipAll(x => x.group.startsWith('Fabrication') || x.group === 'Assembly', `${base}-fabrication.zip`)}><${Icon} n="download"/>Fabrication package (.zip)</button>
          <button class="btn ghost" onClick=${onClose} aria-label="Close"><${Icon} n="x"/></button></header>
        <div class="cols">
          <div class="filelist">
            ${groups.map(gname => html`<div key=${gname}><h4>${gname}</h4>${files.filter(x => x.group === gname).map(x => html`<div key=${x.name} class=${'file' + (x.name === cur ? ' on' : '')} onClick=${() => setCur(x.name)}><code>${x.name}</code><em>${(x.content.length / 1024).toFixed(1)} kB</em></div>`)}</div>`)}
            <div style=${{ padding: '10px 6px' }} class="row">
              <button class="btn small" onClick=${() => zipAll(x => x.group.startsWith('Fabrication'), `${base}-gerbers.zip`)}>Gerbers only (.zip)</button>
              <button class="btn small" onClick=${() => zipAll(() => true, `${base}-all.zip`)}>Everything (.zip)</button>
            </div>
          </div>
          <div class="preview">
            <div class="pvbar"><code style=${{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>${f.name}</code><span class="spacer"></span>
              <button class="btn small" onClick=${copy}><${Icon} n="copy"/>Copy</button>
              <button class="btn small" onClick=${() => (SAVEABLE.test(f.name) || !dl) ? save(f.name, f.content) : zipAll(x => x.name === f.name, f.name.replace(/\.[^.]+$/, '') + '.zip')}><${Icon} n="download"/>${(SAVEABLE.test(f.name) || !dl) ? 'Save' : 'Save (.zip)'}</button></div>
            <pre id="export-pre">${f.content.length > 60000 ? f.content.slice(0, 60000) + '\n… (truncated in preview, full file is exported)' : f.content}</pre>
          </div>
        </div>
      </div></div>`;
  }


  /* ---------- Guided tour ---------- */
  function buildTourSteps(T) {
    const comp = type => () => { const c = T.project().components.find(x => x.type === type); return c ? document.querySelector(`[data-comp="${c.id}"]`) : null; };
    return [
      { intro: true, title: 'New to Copperline?', body: 'Take a two-minute guided tour. It walks through drawing a circuit, simulating it, programming the microcontroller, laying out the board and exporting files for manufacturing.' },
      { mode: 'schematic', target: 'header .tabs', title: 'Four views of one design', body: 'Schematic, PCB, 3D and Code all show the same project. A part you add on the schematic appears on the board and in 3D automatically.' },
      { mode: 'schematic', target: '.side.left', title: 'Component palette', body: `${Object.keys(D).length} parts in ${CL.CATEGORIES.length} groups: passives, semiconductors, sources, ICs, logic, seven microcontroller boards (Arduino Uno, Nano, Mega, ESP32, Raspberry Pi Pico, STM32, ATtiny85), sensors, outputs, meters and connectors.`, tip: 'Click a part, then click the sheet to place it. Press R to rotate it first. Search finds parts by name.' },
      { mode: 'schematic', target: '.stage', title: 'The schematic sheet', body: 'This is the Junction controller: a microcontroller running a traffic light, with a push button, a speed knob and a PWM fan driver.', tip: 'Click any pin to start a wire and click another pin to finish it. Drag parts to move them; their wires follow. Scroll to zoom.' },
      { mode: 'schematic', target: '.side.right', title: 'Inspector', body: 'Select a part to edit its values, see its pins and nets, and read live voltage and current while the simulation runs. With nothing selected it shows the electrical rules check.' },
      { mode: 'schematic', target: '[data-tour="simulate"]', before: () => T.ensureRunning(), title: 'Simulation is running', body: 'The circuit is solved continuously. LEDs light up, wires change colour with voltage, and the clock shows simulated time.', tip: 'Press Space to pause or resume, and the square button to reset.' },
      { mode: 'schematic', target: comp('button'), before: () => T.ensureRunning(), title: 'Operate the circuit', body: 'Switches and buttons work while simulating. This push button asks the controller for a pedestrian crossing.', tip: 'Click SW1 while the green light is on. Hover any wire to read its voltage.' },
      { mode: 'schematic', target: '.dock', before: () => T.dock('scope'), title: 'Oscilloscope', body: 'Scope probes on the schematic plot here. CH1 is the PWM signal from pin D9; CH2 is the fan transistor switching the motor.', tip: 'Change the Window to zoom in time. Add more probes from the Instruments group.' },
      { mode: 'code', target: '.editor', title: 'Program the microcontroller', body: 'Every board runs Arduino-style sketches with the Servo, LCD and DHT libraries, interrupts, pulseIn and shiftOut. Every delay moves the simulation clock.', tip: 'Pick “Load example sketch → Blink” to try a different program.' },
      { mode: 'code', target: '[data-tour="upload"]', title: 'Upload & run', body: 'Uploading compiles the sketch and restarts the simulation with it. Mistakes appear under the editor and nothing is uploaded. The pin monitor on the right shows every pin live.', tip: 'Shortcut: Ctrl + Enter.' },
      { mode: 'code', target: '.dock', before: () => T.dock('serial'), title: 'Serial monitor', body: 'Serial.print and Serial.println output appears here, so you can debug the sketch exactly as you would on real hardware.' },
      { mode: 'pcb', target: '.stage', title: 'Printed circuit board', body: 'Each physical part has a footprint. Copper tracks join the pads on the top (red) and bottom (blue) layers, with a ground pour on the bottom. White lines would show connections still to route.', tip: 'Press X and click a pad to route by hand. V drops a via and switches layer.' },
      { mode: 'pcb', target: '[data-tour="autoroute"]', title: 'Autoroute and check', body: 'The autorouter finds paths for every remaining connection. Run DRC to check spacing, shorts, unrouted nets and parts outside the board; problems are listed under Checks.', tip: 'Board setup below sets size, 2 or 4 layers, track width and clearance.' },
      { mode: '3d', target: '.stage', title: '3D board', body: 'A live model of the board. Resistors show their colour bands, and LEDs light up in step with the simulation.', tip: 'Drag to orbit, right-drag to pan, scroll to zoom.' },
      { mode: '3d', target: '.swatches', title: 'Board appearance', body: 'Choose the solder mask colour, gold (ENIG) or tin (HASL) finish, thickness and silkscreen colour, just as you would on a manufacturer’s order form.' },
      { mode: 'schematic', target: '[data-tour="export"]', title: 'Export for manufacturing', body: 'Export produces Gerber files for each layer, the Excellon drill file, BOM and pick-and-place CSVs, KiCad and SPICE netlists, a schematic SVG and the project file. One button zips the fabrication package.' },
      { mode: 'schematic', target: '[data-tour="tour"]', title: 'You’re ready', body: 'Open another design from Examples, or start fresh with the + button. Your work saves automatically in this browser.', tip: 'Replay this tour any time from the Tour button.' }
    ];
  }
  function Tour({ steps, index, setIndex, onClose }) {
    const step = steps[index];
    const [rect, setRect] = useState(null);
    const [cardH, setCardH] = useState(200);
    const cardRef = useRef(null);
    const nextRef = useRef(null);
    useEffect(() => { if (step.before) step.before(); }, [index]);
    useEffect(() => {
      const measure = () => {
        let el = null;
        try { el = typeof step.target === 'function' ? step.target() : step.target ? document.querySelector(step.target) : null; } catch (e) { el = null; }
        if (el) { const r = el.getBoundingClientRect(); if (r.width > 4 && r.height > 4) { setRect(p => (p && Math.abs(p.x - r.left) < 1 && Math.abs(p.y - r.top) < 1 && Math.abs(p.w - r.width) < 1 && Math.abs(p.h - r.height) < 1 ? p : { x: r.left, y: r.top, w: r.width, h: r.height })); return; } }
        setRect(null);
      };
      measure();
      const id = setInterval(measure, 200);
      window.addEventListener('resize', measure);
      return () => { clearInterval(id); window.removeEventListener('resize', measure); };
    }, [index]);
    useLayoutEffect(() => { if (cardRef.current) { const h = cardRef.current.offsetHeight; if (Math.abs(h - cardH) > 2) setCardH(h); } });
    useEffect(() => { if (nextRef.current) nextRef.current.focus({ preventScroll: true }); }, [index]);
    useEffect(() => {
      const onKey = e => {
        if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
        else if (e.key === 'ArrowRight' && index < steps.length - 1) setIndex(index + 1);
        else if (e.key === 'ArrowLeft' && index > 1) setIndex(index - 1);
      };
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }, [index]);
    const vw = window.innerWidth, vh = window.innerHeight, W = Math.min(340, vw - 32), gap = 14, m = 12;
    let pos;
    if (step.intro) pos = { left: Math.max(m, vw - W - 20), top: Math.max(m, vh - cardH - 24) };
    else if (!rect) pos = { left: (vw - W) / 2, top: Math.max(m, (vh - cardH) / 2) };
    else {
      const cx = rect.x + rect.w / 2;
      const fitsBelow = rect.y + rect.h + gap + cardH < vh - m, fitsAbove = rect.y - gap - cardH > m;
      const fitsRight = rect.x + rect.w + gap + W < vw - m, fitsLeft = rect.x - gap - W > m;
      const big = rect.w > vw * 0.5 && rect.h > vh * 0.45;
      if (big) pos = { left: rect.x + rect.w - W - 16, top: rect.y + 16 };
      else if (fitsBelow) pos = { left: cx - W / 2, top: rect.y + rect.h + gap };
      else if (fitsAbove) pos = { left: cx - W / 2, top: rect.y - gap - cardH };
      else if (fitsRight) pos = { left: rect.x + rect.w + gap, top: rect.y + rect.h / 2 - cardH / 2 };
      else if (fitsLeft) pos = { left: rect.x - gap - W, top: rect.y + rect.h / 2 - cardH / 2 };
      else pos = { left: (vw - W) / 2, top: (vh - cardH) / 2 };
      pos.left = CL.clamp(pos.left, m, vw - W - m); pos.top = CL.clamp(pos.top, m, vh - cardH - m);
    }
    const total = steps.length - 1;
    const last = index === steps.length - 1;
    return html`<div class="tour" role="dialog" aria-label="Guided tour" aria-live="polite">
      ${!step.intro && (rect ? html`<div class="tour-spot" style=${{ left: rect.x - 5, top: rect.y - 5, width: rect.w + 10, height: rect.h + 10 }}></div>` : html`<div class="tour-dim"></div>`)}
      <div class=${'tour-card' + (step.intro ? ' intro' : '')} ref=${cardRef} style=${{ left: pos.left, top: pos.top, width: W }}>
        ${!step.intro && html`<div class="tour-step">Step ${index} of ${total}</div>`}
        <h4>${step.title}</h4>
        <p>${step.body}</p>
        ${step.tip && html`<div class="tour-tip"><b>Try it</b> ${step.tip}</div>`}
        <div class="tour-nav">
          ${step.intro ? html`<span class="spacer"></span><button class="btn ghost small" onClick=${onClose}>Not now</button><button ref=${nextRef} class="btn primary small" onClick=${() => setIndex(1)}>Start the tour</button>`
            : html`<div class="tour-bar" aria-hidden="true"><i style=${{ width: (100 * index / total) + '%' }}></i></div>
              <button class="btn ghost small" onClick=${onClose}>${last ? 'Close' : 'Skip'}</button>
              ${index > 1 && html`<button class="btn small" onClick=${() => setIndex(index - 1)} aria-label="Previous step">Back</button>`}
              <button ref=${nextRef} class="btn primary small" onClick=${() => (last ? onClose() : setIndex(index + 1))}>${last ? 'Finish' : 'Next'}</button>`}
        </div>
      </div>
    </div>`;
  }

  /* ---------- App ---------- */
  function initialProject() {
    const saved = store.get('copperline.project');
    if (saved) { try { const p = JSON.parse(saved); if (p && p.components && p.board) return CL.ensurePlacement(p); } catch (e) { /* ignore */ } }
    return CL.buildExample('traffic');
  }
  function App() {
    const [project, setProject] = useState(initialProject);
    const projRef = useRef(project); projRef.current = project;
    const [mode, setMode] = useState('schematic');
    const [sel, setSel] = useState(null);
    const [pcbSel, setPcbSel] = useState(null);
    const [placing, setPlacing] = useState(null);
    const [tool, setTool] = useState('select');
    const [pcbTool, setPcbTool] = useState('select');
    const [activeLayer, setActiveLayer] = useState('F.Cu');
    const [vis, setVis] = useState({ 'F.Cu': true, 'B.Cu': true, 'In1.Cu': true, 'In2.Cu': true, 'F.SilkS': true, 'B.SilkS': true, 'Edge.Cuts': true, Drill: true, Ratsnest: true });
    const [schView, setSchView] = useState(null);
    const [pcbView, setPcbView] = useState(null);
    const [running, setRunning] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [frame, setFrame] = useState(0);
    const [dock, setDock] = useState('scope');
    const [dockOpen, setDockOpen] = useState(true);
    const [windowS, setWindowS] = useState(project.sim && project.sim.timebase || 0.01);
    const [toastMsg, setToastMsg] = useState(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [leftOpen, setLeftOpen] = useState(false);
    const [rightOpen, setRightOpen] = useState(false);
    const [mcuId, setMcuId] = useState(null);
    const [drc, setDrc] = useState(null);
    const [hlNet, setHlNet] = useState(null);
    const [opts3d, setOpts3d] = useState({ components: true });
    const [dl, setDl] = useState(null);
    const [tourIdx, setTourIdx] = useState(() => (store.get('copperline.tour') ? -1 : 0));
    const simRef = useRef(null);
    const scopeRef = useRef({ ch: {}, lastT: -1 });
    const serialRef = useRef('');
    const hist = useRef({ past: [], future: [] });
    const fitRef = useRef(null);
    const api3d = useRef(null);
    const fileRef = useRef(null);
    const perf = useRef({ ratio: 1 });

    const toast = useCallback(m => { setToastMsg(m); clearTimeout(toast.t); toast.t = setTimeout(() => setToastMsg(null), 2600); }, []);
    useEffect(() => { let alive = true; (async () => { try { const d = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (alive) setDl(d); } catch (e) { /* none */ } })(); return () => { alive = false; }; }, []);

    const pushHistory = useCallback(prev => { const h = hist.current; h.past.push(prev); if (h.past.length > 120) h.past.shift(); h.future = []; }, []);
    const commit = useCallback(fn => {
      setProject(prev => { const next = clone(prev); fn(next); CL.ensurePlacement(next); pushHistory(prev); return next; });
    }, [pushHistory]);
    const live = useCallback((id, patch) => setProject(p => ({ ...p, components: p.components.map(c => (c.id === id ? { ...c, props: { ...c.props, ...patch } } : c)) })), []);
    const undo = useCallback(() => { const h = hist.current; if (!h.past.length) return; h.future.push(projRef.current); setProject(h.past.pop()); }, []);
    const redo = useCallback(() => { const h = hist.current; if (!h.future.length) return; h.past.push(projRef.current); setProject(h.future.pop()); }, []);
    const replaceProject = useCallback((p, msg) => { pushHistory(projRef.current); stopSim(); setProject(CL.ensurePlacement(p)); setSel(null); setPcbSel(null); setSchView(null); setPcbView(null); setDrc(null); setWindowS(p.sim && p.sim.timebase || 0.01); if (msg) toast(msg); }, []);

    const nl = useMemo(() => CL.buildNetlist(project), [project]);
    const an = useMemo(() => (mode === 'pcb' || mode === '3d' ? CL.analyze(project, nl) : null), [project, nl, mode]);

    // autosave
    useEffect(() => { const id = setTimeout(() => store.set('copperline.project', JSON.stringify(project)), 700); return () => clearTimeout(id); }, [project]);

    /* simulation */
    const startSim = useCallback(() => {
      const p = projRef.current;
      serialRef.current = ''; scopeRef.current = { ch: {}, lastT: -1 };
      const s = new CL.Sim(p, { dt: (p.sim && p.sim.dt) || 1e-4, serial: (ref, txt) => { serialRef.current += txt; if (serialRef.current.length > 30000) serialRef.current = serialRef.current.slice(-20000); } });
      s.key = topoKey(p);
      simRef.current = s; setRunning(true); setFrame(f => f + 1);
      if (s.errors.length) toast(s.errors[0]);
    }, [toast]);
    function stopSim() { simRef.current = null; setRunning(false); setFrame(f => f + 1); }
    const toggleRun = useCallback(() => { if (!simRef.current) startSim(); else setRunning(r => !r); }, [startSim]);
    useEffect(() => {
      const s = simRef.current; if (!s) return;
      const k = topoKey(project);
      if (k !== s.key) {
        const was = running;
        const ns = new CL.Sim(project, { dt: (project.sim && project.sim.dt) || 1e-4, serial: (ref, txt) => { serialRef.current += txt; } });
        ns.key = k; simRef.current = ns; scopeRef.current = { ch: {}, lastT: -1 };
        if (!was) setRunning(false);
      } else s.setProject(project);
    }, [project]);
    useEffect(() => {
      if (!running) return;
      let raf, last = performance.now(), lastPaint = 0;
      const tick = now => {
        raf = requestAnimationFrame(tick);
        const s = simRef.current; if (!s) return;
        const real = Math.min(0.1, (now - last) / 1000); last = now;
        const target = s.t + real * speed; const t0 = performance.now();
        const sc = scopeRef.current, win = windowS;
        while (s.t < target - 1e-12 && performance.now() - t0 < 13) {
          if (!s.step()) { setRunning(false); toast(s.failed || 'Simulation stopped'); break; }
          if (s.probes.length && s.t - sc.lastT >= win / 700) {
            sc.lastT = s.t;
            for (const pr of s.probes) { let ch = sc.ch[pr.id]; if (!ch) ch = sc.ch[pr.id] = { t: [], v: [] }; ch.t.push(s.t); ch.v.push(s.V(pr.node)); if (ch.t.length > 1800) { ch.t.splice(0, 500); ch.v.splice(0, 500); } }
          }
        }
        const achieved = (s.t - (target - real * speed)) / Math.max(1e-9, real * speed);
        perf.current.ratio = perf.current.ratio * 0.9 + 0.1 * Math.min(1, achieved);
        if (now - lastPaint > 40) { s.readAll(); setFrame(f => f + 1); lastPaint = now; }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [running, speed, windowS]);

    const sim = simRef.current;
    const readings = sim ? sim.readings : null;

    /* global keys */
    useEffect(() => {
      const onKey = e => {
        const tag = document.activeElement && document.activeElement.tagName;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && tag !== 'TEXTAREA' && tag !== 'INPUT') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && tag !== 'TEXTAREA' && tag !== 'INPUT') { e.preventDefault(); redo(); }
        else if (e.key === ' ' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(tag)) { e.preventDefault(); toggleRun(); }
      };
      window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    }, [undo, redo, toggleRun]);

    const openCode = id => { setMcuId(id); setMode('code'); };
    const tourSteps = useMemo(() => buildTourSteps({
      project: () => projRef.current,
      ensureRunning: () => { if (!simRef.current) startSim(); else setRunning(true); },
      dock: k => { setDock(k); setDockOpen(true); }
    }), [startSim]);
    const setTourStep = i => {
      if (i === 1 && !projRef.current.components.some(c => c.type === 'mcu' && c.props.code && c.props.code.includes('Junction'))) replaceProject(CL.buildExample('traffic'), 'Loaded the Junction controller example for the tour. Undo brings your design back.');
      const st = tourSteps[i];
      if (st && st.mode) { setMode(st.mode); setLeftOpen(false); setRightOpen(false); }
      setPlacing(null); setExportOpen(false);
      setTourIdx(i);
    };
    const closeTour = () => { setTourIdx(-1); store.set('copperline.tour', 'done'); };
    const autoroute = () => {
      const t0 = performance.now();
      const r = CL.autoroute(projRef.current);
      commit(p => { p.board.traces = p.board.traces.concat(r.traces); p.board.vias = p.board.vias.concat(r.vias); });
      toast(r.total ? `Autorouter: ${r.routed} of ${r.total} connections routed${r.failed ? `, ${r.failed} need manual routing` : ''} (${Math.round(performance.now() - t0)} ms)` : 'Nothing left to route');
    };
    const runDRC = () => { const r = CL.runDRC(projRef.current); setDrc(r); setDock('checks'); setDockOpen(true); toast(`DRC finished: ${r.issues.filter(i => i.sev === 'error').length} errors, ${r.issues.filter(i => i.sev !== 'error').length} warnings`); };
    const clearRoutes = () => { commit(p => { p.board.traces = []; p.board.vias = []; }); setDrc(null); };
    const openFile = e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { try { const p = JSON.parse(rd.result); if (!p.components || !p.wires || !p.board) throw new Error('not a Copperline project'); p.sim = p.sim || { dt: 1e-4, timebase: 0.01 }; replaceProject(p, 'Opened ' + f.name); } catch (err) { toast('Could not open ' + f.name + ': ' + err.message); } };
      rd.readAsText(f); e.target.value = '';
    };
    const newProject = () => replaceProject({ name: 'Untitled circuit', version: 1, components: [], wires: [], board: { ...CL.defaultBoard(), w: 60, h: 40 }, sim: { dt: 1e-4, timebase: 0.01 } }, 'New blank project');
    const setDt = dt => { commit(p => { p.sim = { ...(p.sim || {}), dt }; }); if (simRef.current) setTimeout(startSim, 60); };

    const probes = sim ? sim.probes : project.components.filter(c => c.type === 'probe').map(c => ({ id: c.id, ref: c.ref, color: c.props.color }));
    const tabs = [['schematic', 'sch', 'Schematic'], ['pcb', 'board', 'PCB'], ['3d', 'cube', '3D'], ['code', 'code', 'Code']];

    let left = null, stage = null, right = null;
    if (mode === 'schematic') {
      left = html`<${Palette} placing=${placing} setPlacing=${t => { setPlacing(t); setLeftOpen(false); }} setTool=${setTool}/>`;
      stage = html`<${SchematicView} project=${project} nl=${nl} setProject=${setProject} commit=${commit} pushHistory=${pushHistory} sel=${sel} setSel=${setSel} placing=${placing} setPlacing=${setPlacing}
        readings=${readings} sim=${sim} view=${schView} setView=${setSchView} tool=${tool} setTool=${setTool} live=${live} fitRef=${fitRef}/>`;
      right = html`<${InspectorSch} project=${project} nl=${nl} sel=${sel} setSel=${setSel} commit=${commit} live=${live} readings=${readings} sim=${sim} openCode=${openCode}/>`;
    } else if (mode === 'pcb') {
      left = html`<${LayersPanel} project=${project} commit=${commit} vis=${vis} setVis=${setVis} active=${activeLayer} setActive=${setActiveLayer} an=${an} drc=${drc} runDRC=${runDRC} autoroute=${autoroute} clearRoutes=${clearRoutes}/>`;
      stage = html`<${PCBView} project=${project} nl=${nl} an=${an} setProject=${setProject} commit=${commit} pushHistory=${pushHistory} pcbSel=${pcbSel} setPcbSel=${setPcbSel} view=${pcbView} setView=${setPcbView}
        tool=${pcbTool} setTool=${setPcbTool} active=${CL.copperLayers(project.board).includes(activeLayer) ? activeLayer : 'F.Cu'} setActive=${setActiveLayer} vis=${vis} markers=${drc ? drc.issues.filter(i => !i.msg.startsWith('Unrouted')) : null} hlNet=${hlNet} setHlNet=${setHlNet} fitRef=${fitRef}/>`;
      right = html`<${InspectorPCB} project=${project} commit=${commit} pcbSel=${pcbSel} setPcbSel=${setPcbSel} an=${an}/>`;
    } else if (mode === '3d') {
      left = html`<${Panel3D} project=${project} commit=${commit} opts=${opts3d} setOpts=${setOpts3d}/>`;
      stage = html`<${View3D} project=${project} readings=${readings} opts=${opts3d} apiRef=${api3d}/>`;
      right = html`<${InspectorPCB} project=${project} commit=${commit} pcbSel=${null} setPcbSel=${() => {}} an=${an}/>`;
    } else {
      const bm = project.components.filter(c => D[c.type].board), bsel = bm.find(x => x.id === mcuId) || bm[0];
      left = html`<${ApiRef} board=${bsel ? CL.BOARDS[D[bsel.type].board] : null}/>`;
      stage = html`<${CodeView} project=${project} commit=${commit} mcuId=${mcuId} setMcuId=${setMcuId} startSim=${startSim} running=${running} readings=${readings}/>`;
      const mcus = project.components.filter(c => D[c.type].board); const m = mcus.find(x => x.id === mcuId) || mcus[0];
      right = html`<${PinTable} r=${m && readings ? readings[m.id] : null}/>`;
    }

    const checks = [];
    if (sim) sim.errors.forEach(e => checks.push({ sev: 'error', msg: 'Simulator: ' + e }));
    if (sim && sim.mcus) sim.mcus.forEach(m => { if (m.rt && m.rt.error) checks.push({ sev: 'error', msg: `${m.ref}: ${m.rt.error}` }); });
    nl.warnings.forEach(w => checks.push({ sev: w.kind === 'error' ? 'error' : 'warn', msg: 'ERC: ' + w.msg }));
    if (drc) drc.issues.forEach(i => checks.push({ sev: i.sev, msg: 'DRC: ' + i.msg }));

    return html`<div class="app">
      <header class="top">
        <button class="btn ghost menu-btn" onClick=${() => { setLeftOpen(o => !o); setRightOpen(false); }} aria-label="Toggle left panel"><${Icon} n="menu"/></button>
        <div class="brand"><${Logo}/>Copperline<small>circuit · board · firmware</small></div>
        <nav class="tabs" aria-label="Workspace">${tabs.map(([k, ic, lab]) => html`<button key=${k} class=${mode === k ? 'on' : ''} onClick=${() => { setMode(k); setLeftOpen(false); setRightOpen(false); }}><${Icon} n=${ic}/>${lab}</button>`)}</nav>
        <div class="grp">
          <button data-tour="simulate" class=${'btn ' + (running ? '' : 'run')} onClick=${toggleRun} title="Run / pause (Space)"><${Icon} n=${running ? 'pause' : 'play'}/>${running ? 'Pause' : sim ? 'Resume' : 'Simulate'}</button>
          <button class="btn" disabled=${!sim} onClick=${stopSim} title="Stop and reset"><${Icon} n="stop"/></button>
          <span class="simclock">${sim ? html`<b>${fmt(sim.t, 's')}</b><br/>${running ? (perf.current.ratio > 0.97 ? 'real time' : Math.round(perf.current.ratio * 100) + '% speed') : 'paused'}` : html`<b>idle</b><br/>${project.components.filter(c => !D[c.type].virtual).length} parts`}</span>
          <select id="speed" class="sel hide-sm" value=${speed} onChange=${e => setSpeed(+e.target.value)} title="Simulation speed">${[[0.001, '×0.001'], [0.01, '×0.01'], [0.1, '×0.1'], [1, '×1'], [10, '×10']].map(([v, l]) => html`<option key=${v} value=${v}>${l}</option>`)}</select>
          <select id="dt" class="sel hide-sm" value=${(project.sim && project.sim.dt) || 1e-4} onChange=${e => setDt(+e.target.value)} title="Time step">${[1e-6, 5e-6, 1e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3].map(v => html`<option key=${v} value=${v}>dt ${fmt(v, 's', 2)}</option>`)}</select>
        </div>
        <span class="spacer"></span>
        <div class="grp">
          <button class="btn ghost" onClick=${undo} title="Undo (Ctrl+Z)" aria-label="Undo"><${Icon} n="undo"/></button>
          <button class="btn ghost" onClick=${redo} title="Redo (Ctrl+Y)" aria-label="Redo"><${Icon} n="redo"/></button>
          <select id="examples" class="sel" value="" onChange=${e => { const k = e.target.value; if (k) replaceProject(CL.buildExample(k), 'Loaded ' + CL.EXAMPLES[k].name); }} title="Open an example">
            <option value="">Examples…</option>${Object.entries(CL.EXAMPLES).map(([k, x]) => html`<option key=${k} value=${k}>${x.name}</option>`)}</select>
          <button class="btn hide-sm" onClick=${newProject} title="New project"><${Icon} n="plus"/></button>
          <button class="btn hide-sm" onClick=${() => fileRef.current.click()} title="Open project (.json)"><${Icon} n="open"/></button>
          <input ref=${fileRef} type="file" accept=".json,application/json" hidden onChange=${openFile}/>
          <button class="btn hide-sm" data-tour="tour" onClick=${() => setTourStep(1)} title="Guided tour"><${Icon} n="help"/>Tour</button>
          <button class="btn primary" data-tour="export" onClick=${() => setExportOpen(true)}><${Icon} n="download"/>Export</button>
          <button class="btn ghost menu-btn" onClick=${() => { setRightOpen(o => !o); setLeftOpen(false); }} aria-label="Toggle inspector"><${Icon} n="panel"/></button>
        </div>
      </header>
      <div class="work">
        <aside class=${'side left' + (leftOpen ? ' open' : '')}>${left}</aside>
        <main class=${'stage' + (mode === 'pcb' || mode === '3d' ? ' dark' : '')}><${Boundary} key=${mode}>${stage}<//></main>
        <aside class=${'side right' + (rightOpen ? ' open' : '')}>${right}</aside>
      </div>
      <section class=${'dock' + (dockOpen ? '' : ' closed')}>
        <div class="dockbar">
          <nav class="tabs">${[['scope', 'Oscilloscope'], ['serial', 'Serial monitor'], ['checks', `Checks${checks.length ? ' · ' + checks.length : ''}`]].map(([k, l]) => html`<button key=${k} class=${dock === k && dockOpen ? 'on' : ''} onClick=${() => { setDock(k); setDockOpen(true); }}>${l}</button>`)}</nav>
          <span class="spacer"></span>
          ${dock === 'serial' && dockOpen && html`<button class="btn small ghost" onClick=${() => { serialRef.current = ''; setFrame(f => f + 1); }}>Clear</button>`}
          <button class="btn small ghost" onClick=${() => setDockOpen(o => !o)}>${dockOpen ? 'Hide' : 'Show'}</button>
        </div>
        <div class="dockbody">
          ${dock === 'scope' && html`<${Scope} simRef=${simRef} scopeRef=${scopeRef} frame=${frame} windowS=${windowS} setWindowS=${setWindowS} probes=${probes}/>`}
          ${dock === 'serial' && html`<${SerialPane} text=${serialRef.current} frame=${frame} hasMcu=${project.components.some(c => D[c.type].board)}/>`}
          ${dock === 'checks' && html`<div class="checks">${checks.length ? html`<ul class="list">${checks.map((c, i) => html`<li key=${i}><i class=${'dot ' + c.sev}></i>${c.msg}</li>`)}</ul>` : html`<div class="empty">No problems found. Run DRC from the PCB tab to check clearances and unrouted nets.</div>`}</div>`}
        </div>
      </section>
      ${exportOpen && html`<${ExportDialog} project=${project} nl=${nl} onClose=${() => setExportOpen(false)} dl=${dl} toast=${toast}/>`}
      ${tourIdx >= 0 && html`<${Tour} steps=${tourSteps} index=${tourIdx} setIndex=${setTourStep} onClose=${closeTour}/>`}
      ${toastMsg && html`<div class="toast" role="status">${toastMsg}</div>`}
    </div>`;
  }
  function SerialPane({ text, frame, hasMcu }) {
    const ref = useRef(null);
    useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [frame, text.length]);
    return html`<pre class="serial" ref=${ref}>${text || (hasMcu ? 'Serial output appears here when the sketch runs. Press Simulate.' : 'Add a microcontroller to use the serial monitor.')}</pre>`;
  }

  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err) { console.error(err); }
    render() {
      if (!this.state.err) return this.props.children;
      return html`<div class="empty" style=${{ padding: 30 }}><b>This view hit a problem:</b> ${String(this.state.err.message || this.state.err)}<br/><br/>
        <button class="btn" onClick=${() => this.setState({ err: null })}>Try again</button> <button class="btn" onClick=${() => { store.set('copperline.project', ''); location.reload(); }}>Reset to the example project</button></div>`;
    }
  }
  try {
    ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
  } catch (e) {
    document.getElementById('root').textContent = 'Copperline failed to start: ' + e.message;
  }
})();
