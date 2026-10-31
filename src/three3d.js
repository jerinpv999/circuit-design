/* Copperline 3D board viewer (Three.js r128) */
(function (G) {
  const CL = (G.CL = G.CL || {});
  const BAND = ['#151515', '#7a4a1c', '#c62828', '#ef6c00', '#f2c200', '#2e7d32', '#1565c0', '#7b1fa2', '#8a8a8a', '#f5f5f5'];
  function bandsFor(v) {
    const R = CL.parseSI(v); if (!isFinite(R) || R <= 0) return ['#151515', '#151515', '#151515'];
    let e = Math.floor(Math.log10(R)) - 1; let dd = Math.round(R / Math.pow(10, e));
    if (dd >= 100) { dd = Math.round(dd / 10); e++; }
    const mult = e < 0 ? '#c9a227' : BAND[Math.min(9, e)];
    return [BAND[Math.floor(dd / 10) % 10], BAND[dd % 10], mult];
  }

  class Board3D {
    constructor(container) {
      const THREE = G.THREE;
      this.T = THREE;
      this.container = container;
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false });
      this.renderer.setPixelRatio(Math.min(2, G.devicePixelRatio || 1));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      container.appendChild(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 2000);
      this.scene.add(new THREE.HemisphereLight(0xeef6ff, 0x30281e, 0.75));
      const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(60, 120, 80); this.scene.add(sun);
      const fill = new THREE.DirectionalLight(0xbfd8ff, 0.35); fill.position.set(-80, -40, -60); this.scene.add(fill);
      this.root = new THREE.Group(); this.scene.add(this.root);
      this.orbit = { theta: -0.6, phi: 0.95, r: 140, tx: 0, ty: 0, tz: 0 };
      this.mats = {};
      this.leds = []; this.servos = []; this.lcds = [];
      this.bindControls();
      this.resize();
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container);
      this.running = true;
      const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.render(); };
      loop();
    }
    setBackground(c) { this.scene.background = new this.T.Color(c); }
    mat(key, params) {
      if (!this.mats[key]) this.mats[key] = new this.T.MeshStandardMaterial(params);
      return this.mats[key];
    }
    resize() {
      const w = this.container.clientWidth || 300, h = this.container.clientHeight || 300;
      this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    bindControls() {
      const el = this.renderer.domElement; const o = this.orbit;
      const pts = new Map(); let last = null, pinch = null;
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey }); last = null; pinch = null; });
      el.addEventListener('pointermove', e => {
        const p = pts.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) o.r = CL.clamp(o.r * pinch / d, 20, 900); pinch = d; return;
        }
        if (p.b === 2 || p.b === 1 || p.sh) {
          const s = o.r / 600; const ct = Math.cos(o.theta), st = Math.sin(o.theta);
          o.tx -= (dx * ct + dy * st * Math.cos(o.phi)) * s; o.tz -= (-dx * st + dy * ct * Math.cos(o.phi)) * s;
        } else { o.theta -= dx * 0.008; o.phi = CL.clamp(o.phi - dy * 0.008, 0.05, Math.PI - 0.05); }
      });
      const up = e => { pts.delete(e.pointerId); pinch = null; };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', e => e.preventDefault());
      el.addEventListener('wheel', e => { e.preventDefault(); o.r = CL.clamp(o.r * Math.exp(e.deltaY * 0.0012), 20, 900); }, { passive: false });
    }
    view(name) {
      const o = this.orbit; o.tx = o.ty = o.tz = 0;
      if (name === 'top') { o.phi = 0.06; o.theta = 0; }
      else if (name === 'bottom') { o.phi = Math.PI - 0.06; o.theta = 0; }
      else { o.phi = 0.95; o.theta = -0.6; }
      o.r = this.fitR || 140;
    }
    render() {
      const o = this.orbit, c = this.camera;
      c.position.set(o.tx + o.r * Math.sin(o.phi) * Math.sin(o.theta), o.ty + o.r * Math.cos(o.phi), o.tz + o.r * Math.sin(o.phi) * Math.cos(o.theta));
      c.up.set(0, 1, 0); c.lookAt(o.tx, o.ty, o.tz);
      this.renderer.render(this.scene, c);
    }
    dispose() {
      this.running = false; cancelAnimationFrame(this.raf); this.ro.disconnect();
      this.clear(); this.renderer.dispose(); this.renderer.domElement.remove();
    }
    clear() {
      this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; ms.forEach(m => { if (m.map && m.map.dispose) { m.map.dispose(); m.dispose(); } }); });
      while (this.root.children.length) this.root.remove(this.root.children[0]);
      this.leds = []; this.servos = []; this.lcds = [];
    }

    build(p, opts = {}) {
      const THREE = this.T, B = p.board, t = B.thickness || 1.6;
      this.clear();
      const px = Math.min(18, 4096 / Math.max(B.w, B.h));
      const texF = new THREE.CanvasTexture(CL.boardTexture(p, 'F', px));
      const texB = new THREE.CanvasTexture(CL.boardTexture(p, 'B', px));
      [texF, texB].forEach(tx => { tx.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); tx.encoding = THREE.sRGBEncoding; });
      const edge = new THREE.MeshStandardMaterial({ color: 0xb3a76a, roughness: 0.8 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(B.w, t, B.h), [edge, edge,
        new THREE.MeshStandardMaterial({ map: texF, roughness: 0.55, metalness: 0.05 }),
        new THREE.MeshStandardMaterial({ map: texB, roughness: 0.55, metalness: 0.05 }), edge, edge]);
      this.root.add(board);
      this.fitR = Math.max(B.w, B.h) * 1.7 + 30;
      if (!this.fitted) { this.orbit.r = this.fitR; this.fitted = true; }
      if (opts.components !== false) {
        for (const c of p.components) {
          if (!c.pcb) continue; const fp = CL.footprint(c); if (!fp) continue;
          const g = this.part(c, fp);
          if (!g) continue;
          const back = c.pcb.side === 'B';
          g.position.set(c.pcb.x - B.w / 2, back ? -t / 2 : t / 2, c.pcb.y - B.h / 2);
          g.rotation.y = -(c.pcb.rot || 0) * Math.PI / 2;
          if (back) g.scale.set(-1, -1, 1);
          this.root.add(g);
        }
      }
    }
    setReadings(readings) {
      for (const l of this.leds) {
        const r = readings && readings[l.id];
        let b = 0;
        if (r) {
          if (l.seg != null) b = r.segs ? r.segs[l.seg] || 0 : 0;
          else if (l.board) b = r.ledOn ? 1 : 0;
          else if (l.pin) b = r.pins && r.pins[l.pin] && r.pins[l.pin].v > 2.5 ? 1 : 0;
          else if (l.rgb) { const v = r.rgb || [0, 0, 0]; b = Math.min(1, Math.max(v[0], v[1], v[2])); l.mat.emissive.setRGB(Math.min(1, v[0]), Math.min(1, v[1]), Math.min(1, v[2])); if (l.light) l.light.color.setRGB(Math.min(1, v[0]) + 0.01, Math.min(1, v[1]) + 0.01, Math.min(1, v[2]) + 0.01); }
          else b = r.bright || 0;
        }
        b = Math.min(1, b);
        l.mat.emissiveIntensity = l.rgb ? 1.4 * (b > 0.02 ? 1 : 0) : 0.05 + 1.3 * b;
        if (l.light) l.light.intensity = 1.6 * b;
      }
      for (const s of this.servos) { const r = readings && readings[s.id]; if (r && r.angle != null) s.horn.rotation.y = (r.angle - 90) * Math.PI / 180; }
      for (const d of this.lcds) this.drawLcd(d, readings && readings[d.id]);
    }
    drawLcd(d, r) {
      const lines = r && r.lines ? r.lines : null, lit = !!(r && r.backlight), on = !!(r && r.powered);
      const key = JSON.stringify([lines, lit, on]);
      if (key === d.key) return; d.key = key;
      const ctx = d.cv.getContext('2d'), W = d.cv.width, H = d.cv.height;
      ctx.fillStyle = lit ? '#8fcf4a' : on ? '#4e6b2c' : '#2a3424'; ctx.fillRect(0, 0, W, H);
      const cw = (W - 24) / 16, ch = (H - 20) / 2;
      ctx.fillStyle = lit ? 'rgba(20,40,10,0.08)' : 'rgba(0,0,0,0.12)';
      for (let rr = 0; rr < 2; rr++) for (let q = 0; q < 16; q++) ctx.fillRect(12 + q * cw + 1, 10 + rr * ch + 2, cw - 3, ch - 5);
      if (lines) { ctx.fillStyle = '#16260c'; ctx.font = `bold ${Math.floor(ch * 0.78)}px "IBM Plex Mono", ui-monospace, monospace`; ctx.textBaseline = 'middle';
        lines.slice(0, 2).forEach((ln, rr) => { for (let q = 0; q < Math.min(16, ln.length); q++) { const chr = ln[q]; if (chr === '\u2588') ctx.fillRect(12 + q * cw + 1, 10 + rr * ch + 2, cw - 3, ch - 5); else ctx.fillText(chr, 12 + q * cw + 2, 10 + rr * ch + ch / 2); } }); }
      d.tex.needsUpdate = true;
    }

    part(c, fp) {
      const THREE = this.T, body = fp.body || {}, g = new THREE.Group();
      const M = (color, rough = 0.5, metal = 0) => this.mat(color + rough + metal, { color, roughness: rough, metalness: metal });
      const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
      const cyl = (r, h, m, x = 0, y = 0, z = 0, seg = 20) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); g.add(o); return o; };
      const metal = M('#c9ccd1', 0.3, 0.9), gold = M('#d6ad45', 0.3, 0.9), black = M('#1b1d1f', 0.55), lead = M('#b8bcc2', 0.35, 0.85);
      const pins = (h = 1.6) => fp.pads.forEach(pd => { if (pd.drill) cyl(Math.min(0.3, pd.drill / 2.6), h, lead, pd.x, h / 2 - 0.2, pd.y, 8); });
      const ledMat = col => { const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.05, transparent: true, opacity: 0.85, roughness: 0.15 }); return m; };
      switch (body.kind) {
        case 'axial': case 'diode': case 'fuse': {
          const r = body.d / 2, y = r + 0.6;
          const colr = body.kind === 'axial' ? '#d8c08e' : body.kind === 'diode' ? '#202224' : '#cfe7ee';
          const m = body.kind === 'fuse' ? new THREE.MeshStandardMaterial({ color: colr, transparent: true, opacity: 0.55, roughness: 0.1 }) : M(colr, 0.6);
          const o = cyl(r, body.l, m, 0, y, 0, 24); o.rotation.z = Math.PI / 2;
          if (body.kind === 'axial' && body.bands) {
            const bs = bandsFor(body.bands).concat(['#c9a227']);
            bs.forEach((bc, i) => { const b = cyl(r + 0.03, 0.42, M(bc, 0.5), -body.l / 2 + 0.9 + i * 0.85 + (i === 3 ? 0.6 : 0), y, 0, 24); b.rotation.z = Math.PI / 2; });
          }
          if (body.kind === 'diode') { const b = cyl(r + 0.03, 0.5, M('#d9dde2', 0.4), body.l / 2 - 0.7, y, 0, 24); b.rotation.z = Math.PI / 2; }
          if (body.kind === 'fuse') { [-1, 1].forEach(s => { const e = cyl(r + 0.05, 0.9, metal, s * (body.l / 2 - 0.45), y, 0, 24); e.rotation.z = Math.PI / 2; }); const wire = cyl(0.08, body.l, metal, 0, y, 0, 6); wire.rotation.z = Math.PI / 2; }
          [-1, 1].forEach(s => { const x0 = s * body.pitch / 2; cyl(0.28, y + 0.4, lead, x0, y / 2 - 0.2, 0, 8); const hl = cyl(0.28, body.pitch / 2 - body.l / 2, lead, s * (body.pitch / 2 + body.l / 2) / 2, y, 0, 8); hl.rotation.z = Math.PI / 2; });
          break;
        }
        case 'smdR': box(body.l * 0.7, body.h, body.w, M('#1c1c1c', 0.6), 0, body.h / 2); [-1, 1].forEach(s => box(body.l * 0.15, body.h, body.w, metal, s * body.l * 0.425, body.h / 2)); break;
        case 'smdC': box(body.l * 0.7, body.w * 0.8, body.w, M('#b58b5d', 0.6), 0, body.w * 0.4); [-1, 1].forEach(s => box(body.l * 0.15, body.w * 0.8, body.w, metal, s * body.l * 0.425, body.w * 0.4)); break;
        case 'smdD': box(body.l * 0.8, 1.1, body.w, black, 0, 0.55); box(0.25, 1.12, body.w * 1.01, M('#d9dde2', 0.4), body.l * 0.3, 0.55); break;
        case 'smdLED': { box(body.l, 0.5, body.w, M('#f2f2ee', 0.4), 0, 0.25); const lm = ledMat((CL.LED_COLORS[body.color] || CL.LED_COLORS.red).hex); box(body.l * 0.6, 0.35, body.w * 0.7, lm, 0, 0.65); this.leds.push({ id: c.id, mat: lm }); break; }
        case 'ecap': {
          cyl(body.d / 2, body.h, M('#1f3a7a', 0.45), 0, body.h / 2 + 0.4, 0, 32);
          cyl(body.d / 2 - 0.15, 0.06, metal, 0, body.h + 0.42, 0, 32);
          const stripe = new THREE.Mesh(new THREE.CylinderGeometry(body.d / 2 + 0.02, body.d / 2 + 0.02, body.h * 0.96, 32, 1, true, Math.PI * 0.35, Math.PI * 0.3), M('#c9d4ea', 0.5));
          stripe.position.set(0, body.h / 2 + 0.4, 0); g.add(stripe);
          pins(1.2); break;
        }
        case 'inductor': cyl(body.d / 2, body.h * 0.7, M('#2d5f3a', 0.5), 0, body.h * 0.35 + 0.4, 0, 28); cyl(body.d / 2 * 0.98, 0.5, black, 0, 0.4, 0, 28); pins(1.2); break;
        case 'disc': { const d = cyl(body.w / 2, body.t, M('#d9862a', 0.55), 0, body.h / 2 + 1.5, 0, 28); d.rotation.x = Math.PI / 2; pins(body.h / 2 + 1.5); break; }
        case 'led': {
          const rgb = body.color === 'rgb';
          const col = rgb ? '#f4f6f8' : (CL.LED_COLORS[body.color] || CL.LED_COLORS.red).hex;
          const lm = ledMat(col); if (rgb) { lm.emissive = new THREE.Color(0x000000); lm.opacity = 0.92; }
          cyl(2.9, 1, lm, 0, 1.4, 0, 32);
          cyl(2.5, body.h - 3.4, lm, 0, 1.9 + (body.h - 3.4) / 2, 0, 32);
          const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), lm); dome.position.y = body.h - 1.5; g.add(dome);
          const light = new THREE.PointLight(col, 0, 30); light.position.y = body.h - 2; g.add(light);
          this.leds.push({ id: c.id, mat: lm, light, rgb });
          pins(1.4); break;
        }
        case 'to92': { const o = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 4.6, 28, 1, false, -Math.PI / 2, Math.PI), black); o.position.set(0, 5.2, 0.4); o.rotation.y = Math.PI; g.add(o); fp.pads.forEach(pd => cyl(0.25, 3.2, lead, pd.x, 1.5, 0, 8)); break; }
        case 'to220': { box(10, 9, 4.4, black, 0, 7.6, 0); box(10, 6.5, 1.3, metal, 0, 15.2, 1.55); const h = cyl(1.8, 1.4, M('#0a0a0a', 0.9), 0, 15.6, 1.55, 20); h.rotation.x = Math.PI / 2; fp.pads.forEach(pd => box(0.8, 3.4, 0.5, lead, pd.x, 1.5, 0)); break; }
        case 'dip': {
          box(6.3, 3.2, body.l, black, 0, 2.3, 0);
          const n = cyl(0.7, 0.2, M('#2b2e31', 0.7), 0, 3.95, -body.l / 2 + 1.1, 16);
          fp.pads.forEach(pd => { box(0.5, 2.4, 0.3, lead, pd.x * 0.93, 1.1, pd.y); box(0.7, 0.3, 0.5, lead, pd.x * 0.88, 2.2, pd.y); });
          break;
        }
        case 'header': { box(2.5, 2.5, body.n * 2.54, black, 0, 1.25, 0); fp.pads.forEach(pd => box(0.64, 9, 0.64, gold, 0, 3.5, pd.y)); break; }
        case 'terminal': { box(10, 9, 7.6, M('#2f8a4e', 0.55), 0, 4.6, 0); fp.pads.forEach(pd => { const s = cyl(1.4, 0.4, metal, pd.x, 9.15, 0.6, 16); box(2.6, 2.8, 0.4, M('#123', 0.5), pd.x, 4.2, -3.82); }); pins(1); break; }
        case 'tact': { box(6.2, 3.4, 6.2, black, 0, 1.9, 0); box(6.1, 0.2, 6.1, metal, 0, 3.7, 0); cyl(1.75, 1.5, M('#30343a', 0.6), 0, 4.5, 0, 24); fp.pads.forEach(pd => box(0.7, 2, 0.4, lead, pd.x, 0.6, pd.y)); break; }
        case 'slide': { box(8.6, 3.6, 3.6, black, 0, 2, 0); box(1.4, 3, 1.4, M('#e6e6e6', 0.6), 1.5, 5, 0); pins(1); break; }
        case 'pot': { box(9.5, 5, 9.5, M('#2a4fa8', 0.5), 0, 2.7, 0); cyl(3, 1.2, M('#f1f1ed', 0.5), 0, 5.8, 0, 28); box(0.6, 0.3, 4.2, black, 0, 6.45, 0); pins(1); break; }
        case 'crystal': { box(10.6, 3.6, 4.4, M('#d4d7db', 0.25, 0.85), 0, 2.4, 0); pins(1); break; }
        case 'buzzer': { cyl(6, 9.5, black, 0, 5.2, 0, 36); cyl(1.2, 0.3, M('#050505', 0.9), 0, 10, 0, 16); pins(1); break; }
        case 'sevenseg': {
          box(12.4, 8, 18.8, M('#232527', 0.6), 0, 4.2, 0);
          const col = (CL.LED_COLORS[c.props.color] || CL.LED_COLORS.red).hex;
          const segs = [[0, -6.8, 4.4, 0.9], [2.7, -3.4, 0.9, 5.4], [2.7, 3.4, 0.9, 5.4], [0, 6.8, 4.4, 0.9], [-2.7, 3.4, 0.9, 5.4], [-2.7, -3.4, 0.9, 5.4], [0, 0, 4.4, 0.9]];
          segs.forEach(([x, z, w, d], i) => { const m = ledMat(col); m.opacity = 1; box(w, 0.2, d, m, x, 8.3, z); this.leds.push({ id: c.id, mat: m, seg: i }); });
          const dm = ledMat(col); dm.opacity = 1; cyl(0.5, 0.2, dm, 4.6, 8.3, 7.4, 12); this.leds.push({ id: c.id, mat: dm, seg: 7 });
          pins(1); break;
        }
        case 'mcuboard': {
          fp.pads.forEach(pd => { box(2.5, 2.5, 2.5, black, pd.x, 1.25, pd.y); box(0.64, 10, 0.64, gold, pd.x, 4.4, pd.y); });
          box(18.4, 1.6, 33, M('#1d5fa6', 0.55), 0, 9.2, 0);
          const chip = box(7.2, 1.1, 7.2, M('#16181a', 0.5), 0, 10.55, 2); chip.rotation.y = Math.PI / 4;
          box(8, 3, 6, metal, 0, 11.5, -14.5);
          box(2.5, 1.2, 4.5, M('#cfd2d6', 0.3, 0.8), 6, 10.6, -10);
          const lm = ledMat('#ffb020'); lm.opacity = 1; box(1.6, 0.5, 0.9, lm, 5.5, 10.25, -5); this.leds.push({ id: c.id, mat: lm, pin: 'D13' });
          const pl = ledMat('#30d158'); pl.opacity = 1; pl.emissiveIntensity = 1.5; box(1.6, 0.5, 0.9, pl, 5.5, 10.25, -3.4);
          box(3, 0.8, 4, M('#26292c', 0.6), -5, 10.4, -9);
          break;
        }
        case 'module': {
          const L = body.l, W = body.w, H = 9.2, top = H + 1.6;
          fp.pads.forEach(pd => { box(2.5, 2.5, 2.5, black, pd.x, 1.25, pd.y); box(0.64, H + 1.4, 0.64, gold, pd.x, (H + 1.4) / 2 - 0.2, pd.y); });
          box(W, 1.6, L, M(body.color, 0.55), 0, H + 0.8, 0);
          const zEnd = -L / 2;
          if (body.usb === 'B') { box(12, 10.9, 16, metal, -W / 2 + 10, top + 5.45, zEnd + 6); if (body.jack) box(9, 11, 13.5, black, W / 2 - 8, top + 5.5, zEnd + 5); }
          else box(7.6, 2.6, 5.6, metal, 0, top + 1.3, zEnd + 2.6);
          if (body.chip === 'dip28') { box(7.4, 3.6, 35, black, W / 2 - 14, top + 4.2, 6); for (let i = 0; i < 14; i++) [-1, 1].forEach(s => box(0.5, 2.6, 0.3, lead, W / 2 - 14 + s * 3.8, top + 1.6, 6 - 16.5 + i * 2.54)); }
          else if (body.chip === 'rfcan') { box(16, 2.4, 18, metal, 0, top + 1.2, zEnd + 15); box(18, 0.8, 6, M('#16181a', 0.6), 0, top + 0.4, zEnd + 3.2); }
          else { const ch = box(body.chip === 'qfn' ? 7 : 7.4, body.chip === 'qfn' ? 0.9 : 1.3, body.chip === 'qfn' ? 7 : 7.4, M('#16181a', 0.5), 0, top + 0.65, 2); ch.rotation.y = body.chip === 'qfp' ? Math.PI / 4 : 0; }
          box(3.4, 2.4, 3.4, M('#2a2d30', 0.6), -W / 2 + 4, top + 1.2, L / 2 - 6); cyl(1.1, 0.6, M('#d9c39a', 0.7), -W / 2 + 4, top + 2.6, L / 2 - 6, 14);
          const lm = ledMat('#ffb020'); lm.opacity = 1; box(1.6, 0.6, 0.9, lm, W / 2 - 4, top + 0.3, zEnd + 12); this.leds.push({ id: c.id, mat: lm, board: true });
          const pl = ledMat('#30d158'); pl.opacity = 1; pl.emissiveIntensity = 1.4; box(1.6, 0.6, 0.9, pl, W / 2 - 4, top + 0.3, zEnd + 15);
          break;
        }
        case 'ldr': { const d = cyl(2.6, 1.8, M('#c4873a', 0.4), 0, 4.2, 0, 28); cyl(2.2, 0.05, M('#7a3f12', 0.5), 0, 5.12, 0, 28); fp.pads.forEach(pd => cyl(0.25, 3.4, lead, pd.x, 1.5, 0, 8)); break; }
        case 'ntc': { const s = new THREE.Mesh(new THREE.SphereGeometry(1.5, 18, 12), M('#20262a', 0.4)); s.position.y = 4.5; g.add(s); fp.pads.forEach(pd => cyl(0.22, 3.8, lead, pd.x, 1.7, 0, 8)); break; }
        case 'bridge': box(19, 10, 3.6, black, 0, 6.5, 0); fp.pads.forEach(pd => box(0.8, 3, 0.5, lead, pd.x, 1.3, 0)); break;
        case 'relay': box(19, 15.5, 15.3, M('#2a5bd7', 0.4), 0, 7.75, 0); box(12, 0.1, 6, M('#e9eef5', 0.6), 0, 15.55, 0); break;
        case 'servo': {
          fp.pads.forEach(pd => { box(2.5, 2.5, 2.5, black, pd.x, 1.25, pd.y); box(0.64, 8, 0.64, gold, pd.x, 4, pd.y); });
          box(23, 22.5, 12.2, M('#2c6fd8', 0.45), 0, 19.5, 0); box(32, 2.4, 12.2, M('#2c6fd8', 0.45), 0, 24, 0);
          const horn = new THREE.Group(); horn.position.set(-5.5, 31, 0);
          const hc = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 20), M('#f2f2ee', 0.5)); horn.add(hc);
          const arm = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 4), M('#f2f2ee', 0.5)); arm.position.set(7, 1.6, 0); horn.add(arm);
          g.add(horn); this.servos.push({ id: c.id, horn });
          break;
        }
        case 'lcd': {
          fp.pads.forEach(pd => { if (pd.pin >= 0) { box(2.5, 2.5, 2.5, black, pd.x, 1.25, pd.y); box(0.64, 12, 0.64, gold, pd.x, 6, pd.y); } else cyl(1.6, 11, metal, pd.x, 5.5, pd.y, 12); });
          box(80, 1.6, 36, M('#1f6e3a', 0.55), 0, 11.8, 0);
          box(71, 7, 24.2, M('#15181a', 0.6), 0, 16.1, 0);
          const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
          const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
          const scr = new THREE.Mesh(new THREE.PlaneGeometry(64.5, 14), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.4 }));
          scr.rotation.x = -Math.PI / 2; scr.position.set(0, 19.62, 0); g.add(scr);
          const d = { id: c.id, cv, tex, key: null }; this.lcds.push(d); this.drawLcd(d, null);
          break;
        }
        case 'dht': {
          fp.pads.forEach(pd => box(0.6, 3, 0.4, lead, pd.x, 1.5, pd.y));
          box(15.1, 20, 7.7, M('#f1f2ee', 0.6), 0, 13, 0);
          for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) box(2.6, 1.8, 0.2, M('#7b8086', 0.6), -3.6 + q * 3.6, 10 + r * 3.3, 3.9);
          break;
        }
        case 'hcsr04': {
          fp.pads.forEach(pd => { box(2.5, 2.5, 2.5, black, pd.x, 1.25, pd.y); box(0.64, 6, 0.64, gold, pd.x, 3, pd.y); });
          box(45, 20, 1.6, M('#1f5fbf', 0.5), 0, 14.5, 0);
          [-13, 13].forEach(x => { const t = cyl(8, 12, metal, x, 15, 6.8, 28); t.rotation.x = Math.PI / 2; const m = cyl(6.5, 0.2, M('#2a2d30', 0.9), x, 15, 12.9, 28); m.rotation.x = Math.PI / 2; });
          box(5, 3, 2, metal, 0, 21, 1.6);
          break;
        }
        case 'pir': {
          fp.pads.forEach(pd => { box(2.5, 2.5, 2.5, black, pd.x, 1.25, pd.y); box(0.64, 6, 0.64, gold, pd.x, 3, pd.y); });
          box(32, 24, 1.6, M('#2d7a3d', 0.5), 0, 16.5, 0);
          const dome = new THREE.Mesh(new THREE.SphereGeometry(11.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M('#f4f4ef', 0.35)); dome.rotation.x = Math.PI / 2; dome.position.set(0, 16.5, 0.8); g.add(dome);
          break;
        }
        case 'joystick': {
          fp.pads.forEach(pd => { box(2.5, 2.5, 2.5, black, pd.x, 1.25, pd.y); box(0.64, 8, 0.64, gold, pd.x, 4, pd.y); });
          box(26, 1.6, 34, M('#15181a', 0.55), 0, 8.8, 0);
          box(16, 9, 16, M('#30343a', 0.5), 0, 14.1, -3);
          cyl(1.6, 9, M('#30343a', 0.5), 0, 23, -3, 14);
          const k = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M('#1b1d1f', 0.7)); k.position.set(0, 27, -3); g.add(k);
          break;
        }
        case 'sot223': box(6.5, 1.6, 3.5, black, 0, 0.8, 0.2); box(3, 0.25, 2, metal, 0, 0.12, -3.15); [-2.3, 0, 2.3].forEach(x => box(0.7, 0.25, 1.8, metal, x, 0.12, 2.9)); break;
        case 'l298n': {
          fp.pads.forEach(pd => cyl(0.3, 2, lead, pd.x, 0.8, pd.y, 8));
          box(43, 1.6, 43, M('#c8262a', 0.5), 0, 3.8, 0);
          box(23, 3, 15, M('#111315', 0.55), 0, 6.1, -4);
          for (let i = 0; i < 9; i++) box(1.2, 18, 15, M('#111315', 0.55), -9.6 + i * 2.4, 16.6, -4);
          [[-18, 0, 2], [18, 0, 2], [0, 18, 3]].forEach(([x, y, n]) => box(n === 2 ? 7.6 : 15.2, 10, n === 2 ? 10.2 : 7.6, M('#2a6fd6', 0.45), x, 9.6, y));
          fp.pads.filter(pd => pd.num >= 8).forEach(pd => { box(2.5, 2.5, 2.5, black, pd.x, 5.85, pd.y); box(0.64, 8, 0.64, gold, pd.x, 8.5, pd.y); });
          break;
        }
        default: box(4, 3, 4, black, 0, 1.5, 0);
      }
      return g;
    }
  }
  CL.Board3D = Board3D;
})(typeof window !== 'undefined' ? window : globalThis);
