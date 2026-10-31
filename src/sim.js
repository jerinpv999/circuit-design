/* Copperline simulator: modified nodal analysis, Newton-Raphson, backward-Euler transient */
(function (G) {
  const CL = (G.CL = G.CL || {});
  const VT = 0.025852, VT0 = VT;
  const GMIN = 1e-12;
  const safeExp = x => (x < 80 ? Math.exp(x) : Math.exp(80) * (1 + x - 80));
  function pnjlim(vnew, vold, vt, vcrit) {
    if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
      if (vold > 0) { const arg = 1 + (vnew - vold) / vt; vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit; }
      else vnew = vt * Math.log(Math.max(vnew / vt, 1e-30));
    }
    return vnew;
  }
  const num = (v, d) => { const x = CL.parseSI(v); return isFinite(x) ? x : d; };
  const DIODES = { '1N4148': [2.52e-9, 1.752], '1N4007': [7.03e-9, 1.808], '1N5819': [1e-5, 1.1] };

  class Sim {
    constructor(project, opts = {}) {
      this.project = project;
      this.dt = opts.dt || 1e-4;
      this.t = 0;
      this.nl = CL.buildNetlist(project);
      this.errors = [];
      this.probes = [];
      this.readings = {};
      this.serial = opts.serial || (() => {});
      this.build();
    }
    comp(id) { return this.compMap.get(id); }
    setProject(p) { this.project = p; this.compMap = new Map(p.components.map(c => [c.id, c])); }
    build() {
      const nl = this.nl;
      this.compMap = new Map(this.project.components.map(c => [c.id, c]));
      this.nodeIdx = new Map();
      let n = 0;
      for (const name of nl.nets.keys()) { if (name === 'GND') this.nodeIdx.set(name, -1); else this.nodeIdx.set(name, n++); }
      this.nNodes = n;
      let br = 0;
      const newBranch = () => n + br++;
      this.elements = [];
      this.mcus = []; this.boards = []; this.lcds = []; this.dhts = [];
      const self = this;
      const netCount = name => { const net = nl.nets.get(name); return net ? net.pins.length + net.wires.length : 0; };
      for (const c of this.project.components) {
        const d = CL.DEFS[c.type]; if (!d) continue;
        const pn = nl.pinNet.get(c.id);
        const nd = pn.map(name => this.nodeIdx.get(name));
        const el = d.board ? this.makeBoard(c, nd, pn) : this.makeElement(c, nd, newBranch, pn, netCount);
        if (el) { el.id = c.id; this.elements.push(el); }
        if (c.type === 'probe') this.probes.push({ id: c.id, node: nd[0], ref: c.ref, color: c.props.color });
      }
      this.N = n + br;
      this.A = new Float64Array(this.N * this.N);
      this.b = new Float64Array(this.N);
      this.x = new Float64Array(this.N);
      this.nonlinear = this.elements.some(e => e.nl);
      this.hasGnd = nl.nets.has('GND');
      if (!this.hasGnd && this.elements.length) this.errors.push('No ground symbol: add one so voltages have a reference.');
    }
    V(i) { return i < 0 ? 0 : this.x[i]; }
    nodeV(name) { const i = this.nodeIdx.get(name); return i === undefined ? 0 : this.V(i); }

    /* stamping helpers */
    addG(a, b, g) {
      const A = this.A, N = this.N;
      if (a >= 0) A[a * N + a] += g;
      if (b >= 0) A[b * N + b] += g;
      if (a >= 0 && b >= 0) { A[a * N + b] -= g; A[b * N + a] -= g; }
    }
    addI(a, b, i) { if (a >= 0) this.b[a] -= i; if (b >= 0) this.b[b] += i; }
    addV(p, n, k, v) {
      const A = this.A, N = this.N;
      if (p >= 0) { A[p * N + k] += 1; A[k * N + p] += 1; }
      if (n >= 0) { A[n * N + k] -= 1; A[k * N + n] -= 1; }
      this.b[k] += v;
    }
    addA(r, c, v) { if (r >= 0 && c >= 0) this.A[r * this.N + c] += v; }
    addB(r, v) { if (r >= 0) this.b[r] += v; }

    makeElement(c, nd, newBranch, pn, netCount) {
      const sim = this, P = () => sim.comp(c.id).props;
      const [a, b] = nd;
      const resistorLike = (getR, extra = {}) => Object.assign({
        stamp() { sim.addG(a, b, 1 / Math.max(1e-6, getR())); },
        accept() {},
        read() { const v = sim.V(a) - sim.V(b), i = v / Math.max(1e-6, getR()); return { v, i, p: v * i }; }
      }, extra);
      switch (c.type) {
        case 'resistor': return resistorLike(() => num(P().resistance, 1e3));
        case 'lamp': return resistorLike(() => num(P().resistance, 30), { read() { const v = sim.V(a) - sim.V(b), i = v / num(P().resistance, 30); return { v, i, p: v * i, bright: Math.min(1, Math.abs(v * i) / 0.6) }; } });
        case 'buzzer': return resistorLike(() => num(P().resistance, 40), { read() { const v = sim.V(a) - sim.V(b); return { v, i: v / num(P().resistance, 40), on: Math.abs(v) > 1.5 }; } });
        case 'motor': {
          const R = () => num(P().resistance, 20);
          let angle = 0;
          return { stamp() { sim.addG(a, b, 1 / R()); }, accept(dt) { const i = (sim.V(a) - sim.V(b)) / R(); angle += i * 2200 * dt; },
            read() { const v = sim.V(a) - sim.V(b); return { v, i: v / R(), angle }; } };
        }
        case 'switch': return resistorLike(() => (P().closed ? 0.02 : 1e9), { read() { const v = sim.V(a) - sim.V(b); return { v, i: v / (P().closed ? 0.02 : 1e9) }; } });
        case 'button': return resistorLike(() => (P().pressed ? 0.02 : 1e9), { read() { const v = sim.V(a) - sim.V(b); return { v, i: v / (P().pressed ? 0.02 : 1e9) }; } });
        case 'fuse': {
          let blown = false, over = 0;
          const R = () => (blown ? 1e9 : 0.05);
          return { stamp() { sim.addG(a, b, 1 / R()); },
            accept(dt) { const i = Math.abs((sim.V(a) - sim.V(b)) / R()); if (!blown && i > num(P().rating, 0.5)) { over += dt; if (over > 2e-3) { blown = true; sim.errors.push(`${c.ref} blew at ${CL.formatSI(i, 'A')}`); } } else over = 0; },
            read() { const v = sim.V(a) - sim.V(b); return { v, i: v / R(), blown }; } };
        }
        case 'voltmeter': return resistorLike(() => 1e7, { read() { return { v: sim.V(a) - sim.V(b) }; } });
        case 'crystal': return resistorLike(() => 1e10);
        case 'pot': {
          const w = nd[2];
          const parts = () => { const R = num(P().resistance, 1e4), pos = CL.clamp(+P().position || 0, 0, 1); return [Math.max(1, R * pos), Math.max(1, R * (1 - pos))]; };
          return { stamp() { const [ra, rb] = parts(); sim.addG(a, w, 1 / ra); sim.addG(w, b, 1 / rb); }, accept() {},
            read() { const [ra] = parts(); return { v: sim.V(w) - sim.V(a), i: (sim.V(a) - sim.V(w)) / ra }; } };
        }
        case 'capacitor': case 'ecap': {
          let vprev = 0, inow = 0;
          const C = () => num(P().capacitance, 1e-7);
          return { stamp(dt) { const g = C() / dt; sim.addG(a, b, g); sim.addI(a, b, -g * vprev); },
            accept(dt) { const v = sim.V(a) - sim.V(b); inow = C() / dt * (v - vprev); vprev = v; },
            read() { return { v: vprev, i: inow }; } };
        }
        case 'inductor': {
          let iprev = 0;
          const L = () => Math.max(1e-9, num(P().inductance, 1e-2));
          return { stamp(dt) { const g = dt / L(); sim.addG(a, b, g); sim.addI(a, b, iprev); },
            accept(dt) { iprev += dt / L() * (sim.V(a) - sim.V(b)); }, read() { return { v: sim.V(a) - sim.V(b), i: iprev }; } };
        }
        case 'diode': case 'zener': case 'led': {
          let Is, n, vz = null;
          if (c.type === 'led') { const col = CL.LED_COLORS[P().color] || CL.LED_COLORS.red; n = 2; Is = 0.01 / Math.exp(col.vf / (n * VT)); }
          else if (c.type === 'zener') { Is = 1e-14; n = 1; vz = num(P().vz, 5.1); }
          else { [Is, n] = DIODES[P().model] || DIODES['1N4148']; }
          return this.diode(a, b, Is, n, vz);
        }
        case 'sevenseg': {
          const col = CL.LED_COLORS[P().color] || CL.LED_COLORS.red;
          const n = 2, Is = 0.01 / Math.exp(col.vf / (n * VT));
          const ca = P().type === 'common anode';
          const com = nd[8];
          const ds = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ca ? this.diode(com, nd[i], Is, n, null) : this.diode(nd[i], com, Is, n, null));
          return { nl: true, stamp(dt) { ds.forEach(d => d.stamp(dt)); }, accept(dt) { ds.forEach(d => d.accept(dt)); },
            read() { return { segs: ds.map(d => d.read().bright) }; } };
        }
        case 'npn': case 'pnp': {
          const M = (CL.BJT_MODELS || {})[c.type] || {};
          return this.bjt(nd[0], c.type === 'npn' ? nd[1] : nd[2], c.type === 'npn' ? nd[2] : nd[1], c.type === 'pnp', () => num(P().beta, 150), () => ((M[P().model] || {}).n || 1));
        }
        case 'nmos': case 'pmos': {
          const M = (CL.MOS_MODELS || {})[c.type] || {};
          return this.mosfet(nd[0], c.type === 'nmos' ? nd[1] : nd[2], c.type === 'nmos' ? nd[2] : nd[1], c.type === 'pmos', () => num(P().vth, 2.1), () => ((M[P().model] || {}).k || 0.25));
        }
        case 'dcsource': case 'battery': case 'acsource': case 'funcgen': {
          const k = newBranch();
          const val = t => {
            const p = P();
            if (c.type === 'dcsource' || c.type === 'battery') return num(p.voltage, 5);
            if (c.type === 'acsource') return num(p.offset, 0) + num(p.amplitude, 1) * Math.sin(2 * Math.PI * num(p.frequency, 50) * t);
            const f = num(p.frequency, 1e3), A = num(p.amplitude, 1), o = num(p.offset, 0), ph = (t * f) % 1;
            switch (p.waveform) {
              case 'sine': return o + A * Math.sin(2 * Math.PI * ph);
              case 'triangle': return o + A * (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph);
              case 'sawtooth': return o + A * (2 * ph - 1);
              default: return o + (ph < (+p.duty || 0.5) ? A : -A);
            }
          };
          return { stamp(dt, t) { sim.addV(a, b, k, val(t)); }, accept() {}, read() { const i = -sim.x[k]; const v = sim.V(a) - sim.V(b); return { v, i, p: v * i }; } };
        }
        case 'isource': {
          return { stamp() { sim.addI(b, a, num(P().current, 0.01)); }, accept() {}, read() { return { v: sim.V(a) - sim.V(b), i: num(P().current, 0.01) }; } };
        }
        case 'ammeter': {
          const k = newBranch();
          return { stamp() { sim.addV(a, b, k, 0); }, accept() {}, read() { return { i: sim.x[k] }; } };
        }
        case 'opamp': {
          const [inn, inp, out, vp, vn] = nd;
          const k = newBranch();
          const vpFloat = netCount(pn[3]) <= 1, vnFloat = netCount(pn[4]) <= 1;
          return { nl: true,
            stamp() {
              const A = num(P().gain, 1e5);
              const vcc = vpFloat ? 12 : sim.V(vp), vee = vnFloat ? -12 : sim.V(vn);
              const mid = (vcc + vee) / 2, half = Math.max(0.05, (vcc - vee) / 2 - 0.02);
              const vd = sim.V(inp) - sim.V(inn);
              const u = CL.clamp(A * vd / half, -40, 40);
              const th = Math.tanh(u), g0 = mid + half * th, dg = A * (1 - th * th);
              const N = sim.N;
              if (out >= 0) { sim.A[out * N + k] += 1; sim.A[k * N + out] += 1; }
              sim.addA(k, inp, -dg); sim.addA(k, inn, dg);
              sim.b[k] += g0 - dg * vd;
            }, accept() {}, read() { return { v: sim.V(out), i: sim.x[k] }; } };
        }
        case 'reg7805': case 'ams1117': {
          const [vin, out, gnd] = nd;
          const k = newBranch(), drop = c.type === 'ams1117' ? 1.1 : 2, dflt = c.type === 'ams1117' ? 3.3 : 5;
          const smin = (x, y) => (x + y - Math.sqrt((x - y) * (x - y) + 1e-4)) / 2;
          const smax = (x, y) => (x + y + Math.sqrt((x - y) * (x - y) + 1e-4)) / 2;
          const yf = x => smax(smin(x - drop, num(P().vout, dflt)), 0);
          return { nl: true,
            stamp() {
              const x0 = sim.V(vin) - sim.V(gnd), y0 = yf(x0), h = 1e-6;
              const dy = (yf(x0 + h) - yf(x0 - h)) / (2 * h);
              const N = sim.N;
              // branch equation: Vout - Vgnd - y(Vin - Vgnd) = 0
              sim.addA(k, out, 1); sim.addA(k, gnd, -1 + dy); sim.addA(k, vin, -dy);
              sim.b[k] += y0 - dy * x0;
              // currents: out node supplies x_k; input draws the same; gnd carries none
              if (out >= 0) sim.A[out * N + k] += 1;
              if (vin >= 0) sim.A[vin * N + k] -= 1;
            }, accept() {}, read() { return { v: sim.V(out) - sim.V(gnd), i: -sim.x[k] }; } };
        }
        case 'and': case 'nand': case 'or': case 'nor': case 'xor': case 'not': {
          const out = c.type === 'not' ? nd[1] : nd[2];
          let level = 0;
          const fn = { and: (x, y) => x && y, nand: (x, y) => !(x && y), or: (x, y) => x || y, nor: (x, y) => !(x || y), xor: (x, y) => x !== y, not: x => !x }[c.type];
          const evalOut = () => { const A = sim.V(nd[0]) > 2.5, B = c.type === 'not' ? false : sim.V(nd[1]) > 2.5; level = fn(A, B) ? 5 : 0; };
          return { stamp() { sim.addG(out, -1, 1 / 50); sim.addI(-1, out, level / 50); }, accept() { evalOut(); }, read() { return { v: sim.V(out), level }; } };
        }
        case 'ldr': return resistorLike(() => { const p = P(), L = CL.clamp(+p.light || 0, 0, 100) / 100, rd = num(p.dark, 1e6), rb = num(p.bright, 1e3); return Math.exp(Math.log(rd) + L * (Math.log(rb) - Math.log(rd))); });
        case 'ntc': return resistorLike(() => { const p = P(), T = (+p.temperature) + 273.15; return num(p.r25, 1e4) * Math.exp(num(p.beta, 3950) * (1 / T - 1 / 298.15)); });
        case 'bridge': {
          const [ac1, ac2, pl, mi] = nd, [Is, n] = DIODES['1N4007'];
          const ds = [this.diode(ac1, pl, Is, n, null), this.diode(ac2, pl, Is, n, null), this.diode(mi, ac1, Is, n, null), this.diode(mi, ac2, Is, n, null)];
          return { nl: true, stamp(dt) { ds.forEach(x => x.stamp(dt)); }, accept(dt) { ds.forEach(x => x.accept(dt)); }, read() { return { v: sim.V(pl) - sim.V(mi) }; } };
        }
        case 'rgbled': {
          const ca = P().type === 'common anode', com = nd[3], vfs = [1.8, 2.1, 3.0];
          const ds = [0, 1, 2].map(i => { const Is = 0.01 / Math.exp(vfs[i] / (2 * VT)); return ca ? this.diode(com, nd[i], Is, 2, null) : this.diode(nd[i], com, Is, 2, null); });
          return { nl: true, stamp(dt) { ds.forEach(x => x.stamp(dt)); }, accept(dt) { ds.forEach(x => x.accept(dt)); }, read() { return { rgb: ds.map(x => x.read().bright) }; } };
        }
        case 'relay': {
          const [a1, a2, com, nc, no] = nd; let on = false;
          const coil = () => (P().coil === '12V' ? { R: 400, pull: 9, drop: 1.2 } : { R: 70, pull: 3.75, drop: 0.5 });
          return { stamp() { const k = coil(); sim.addG(a1, a2, 1 / k.R); sim.addG(com, no, on ? 20 : 1e-9); sim.addG(com, nc, on ? 1e-9 : 20); },
            accept() { const k = coil(), v = Math.abs(sim.V(a1) - sim.V(a2)); if (!on && v >= k.pull) on = true; else if (on && v < k.drop) on = false; },
            read() { const k = coil(), v = sim.V(a1) - sim.V(a2); return { on, v, i: v / k.R }; } };
        }
        case 'servo': {
          const [sig, vp, gnd] = nd; let angle = 90, target = 90, pk = 0, acc = 0, inPulse = false, width = null, lastPulse = -1;
          const moving = () => Math.abs(target - angle) > 0.5;
          return { stamp() { sim.addG(sig, gnd, 1e-6); sim.addG(vp, gnd, 1 / (moving() ? 25 : 500)); },
            accept(dt, t) {
              const vs = sim.V(sig) - sim.V(gnd);
              pk = Math.max(vs, pk * Math.exp(-dt / 0.5));
              const f = pk > 1 ? CL.clamp(vs / pk, 0, 1) : 0;
              if (f > 0.02) { if (!inPulse) { inPulse = true; acc = 0; } acc += f * dt; }
              else if (inPulse) { inPulse = false; width = acc * 1e6; lastPulse = t; if (width > 400 && width < 2700) target = CL.clamp((width - 544) / (2400 - 544) * 180, 0, 180); }
              if (sim.V(vp) - sim.V(gnd) >= 4 && t - lastPulse < 0.1) { const s = 600 * dt; angle += CL.clamp(target - angle, -s, s); }
            },
            read() { const v = sim.V(vp) - sim.V(gnd); return { angle, target, width, powered: v >= 4, i: v / (moving() ? 25 : 500) }; } };
        }
        case 'lcd_i2c': {
          const [gnd, vcc, sda, scl] = nd;
          const el = { peripheral: 'lcd', nets: { sda: pn[2], scl: pn[3] }, addr: () => parseInt(P().address, 16) || 0x27, powered: () => sim.V(vcc) - sim.V(gnd) >= 3,
            stamp() { sim.addG(vcc, gnd, 1 / 250); sim.addG(sda, vcc, 1 / 10000); sim.addG(scl, vcc, 1 / 10000); },
            accept() {},
            read() {
              const powered = el.powered(); let lines = null, backlight = true;
              if (powered) for (const b of sim.boards) {
                if (!b.rt || !b.i2cMatch(el)) continue;
                const dv = b.rt.lcds[el.addr()];
                if (dv) { lines = dv.ready ? (dv.on ? dv.buf.slice(0, 2) : ['', '']) : null; backlight = dv.ready ? dv.bl : true; }
              }
              if (powered && !lines) lines = ['█'.repeat(16), ''];
              return { powered, lines, backlight: powered && backlight, i: (sim.V(vcc) - sim.V(gnd)) / 250 };
            } };
          sim.lcds.push(el); return el;
        }
        case 'dht22': {
          const [vcc, , gnd] = nd;
          const el = { peripheral: 'dht', nets: { data: pn[1] }, powered: () => sim.V(vcc) - sim.V(gnd) >= 3, value: () => ({ t: +P().temperature, h: +P().humidity }),
            stamp() { sim.addG(vcc, gnd, 1 / 3300); }, accept() {}, read() { return { powered: el.powered(), t: +P().temperature, h: +P().humidity }; } };
          sim.dhts.push(el); return el;
        }
        case 'hcsr04': {
          const [vcc, trig, echo, gnd] = nd; let prev = 0, ts = -1, w = 0, busy = -1;
          const powered = () => sim.V(vcc) - sim.V(gnd) >= 4.5;
          const frac = (t0, t1) => (ts < 0 ? 0 : CL.clamp((Math.min(t1, ts + w) - Math.max(t0, ts)) / (t1 - t0), 0, 1));
          return { stamp(dt, t) { sim.addG(vcc, gnd, 1 / 330); sim.addG(trig, gnd, 1e-5); if (!powered()) return; const f = frac(t - dt, t); if (f > 0) sim.addG(echo, vcc, f / 100); if (f < 1) sim.addG(echo, gnd, (1 - f) / 100); },
            accept(dt, t) { const hi = sim.V(trig) - sim.V(gnd) > 2 ? 1 : 0; if (hi && !prev && powered() && t > busy) { const d = +P().distance; w = d > 400 ? 0.038 : 2 * (d / 100) / 343; ts = t + 0.0004; busy = ts + w + 0.01; } prev = hi; },
            read() { return { powered: powered(), echo: ts >= 0 && sim.t >= ts && sim.t < ts + w, distance: +P().distance }; } };
        }
        case 'pir': {
          const [vcc, out, gnd] = nd; let last = -1e9;
          const powered = () => sim.V(vcc) - sim.V(gnd) >= 4.5;
          const on = () => powered() && (P().motion || sim.t - last < (+P().hold || 2));
          return { stamp() { sim.addG(vcc, gnd, 1 / 50000); sim.addG(out, gnd, 1 / 100); if (on()) sim.addI(gnd, out, 3.3 / 100); },
            accept(dt, t) { if (P().motion) last = t; }, read() { return { on: on(), powered: powered() }; } };
        }
        case 'joystick': {
          const [gnd, vcc, vrx, vry, sw] = nd, R = 10000;
          return { stamp() { const p = P(), x = CL.clamp(+p.x, 0.001, 0.999), y = CL.clamp(+p.y, 0.001, 0.999);
              sim.addG(vcc, vrx, 1 / (R * (1 - x))); sim.addG(vrx, gnd, 1 / (R * x)); sim.addG(vcc, vry, 1 / (R * (1 - y))); sim.addG(vry, gnd, 1 / (R * y));
              if (p.pressed) sim.addG(sw, gnd, 20); },
            accept() {}, read() { const p = P(); return { x: +p.x, y: +p.y, pressed: !!p.pressed, vx: sim.V(vrx) - sim.V(gnd), vy: sim.V(vry) - sim.V(gnd) }; } };
        }
        case 'ne555': {
          const [vcc, rst, trig, thr, out, dis, ctrl, gnd] = nd; let q = false;
          const vr = n => sim.V(n) - sim.V(gnd);
          return { stamp() { sim.addG(vcc, ctrl, 1 / 5000); sim.addG(ctrl, gnd, 1 / 10000); sim.addG(vcc, gnd, 1 / 3000);
              if (vr(vcc) < 2) return; if (q) sim.addG(out, vcc, 1 / 15); else { sim.addG(out, gnd, 1 / 10); sim.addG(dis, gnd, 1 / 10); } },
            accept() { const vc = vr(ctrl); if (vr(vcc) < 2 || vr(rst) < 0.7) q = false; else if (vr(trig) < vc / 2) q = true; else if (vr(thr) > vc) q = false; },
            read() { return { q, v: vr(out) }; } };
        }
        case 'lm393': {
          const [inn, inp, out, vp, gnd] = nd; let low = false;
          return { stamp() { sim.addG(vp, gnd, 1 / 10000); if (low) sim.addG(out, gnd, 1 / 30); },
            accept() { low = sim.V(vp) - sim.V(gnd) >= 2 && sim.V(inp) < sim.V(inn); }, read() { return { low, v: sim.V(out) - sim.V(gnd) }; } };
        }
        case 'lm317': {
          const [vin, out, adj] = nd, k = newBranch();
          return { nl: true,
            stamp() {
              const a0 = sim.V(adj), i0 = sim.V(vin), p = a0 + 1.25, q = i0 - 1.5, s = Math.sqrt((p - q) * (p - q) + 1e-4);
              const y0 = (p + q - s) / 2, da = (1 - (p - q) / s) / 2, di = (1 + (p - q) / s) / 2;
              sim.addA(k, out, 1); sim.addA(k, adj, -da); sim.addA(k, vin, -di); sim.b[k] += y0 - da * a0 - di * i0;
              const N = sim.N; if (out >= 0) sim.A[out * N + k] += 1; if (vin >= 0) sim.A[vin * N + k] -= 1;
            }, accept() {}, read() { return { v: sim.V(out) - sim.V(adj), i: -sim.x[k] }; } };
        }
        case 'hc595': {
          const g = nd[15], vdd = nd[5]; let sr = 0, latch = 0, pS = 0, pR = 0;
          const v = n => sim.V(n) - sim.V(g), lv = n => (v(n) > v(vdd) / 2 ? 1 : 0);
          const drive = (k, hi) => (hi ? sim.addG(k, vdd, 1 / 50) : sim.addG(k, g, 1 / 50));
          return { stamp() { sim.addG(vdd, g, 1 / 1e5); if (v(vdd) < 2) return; if (lv(nd[3]) === 0) for (let i = 0; i < 8; i++) drive(nd[6 + i], (latch >> i) & 1); drive(nd[14], (sr >> 7) & 1); },
            accept() { if (v(vdd) < 2) { sr = 0; latch = 0; pS = pR = 0; return; } const c1 = lv(nd[1]), c2 = lv(nd[2]);
              if (c2 && !pR) latch = sr;
              if (!lv(nd[4])) sr = 0; else if (c1 && !pS) sr = ((sr << 1) | lv(nd[0])) & 0xff;
              pS = c1; pR = c2; },
            read() { const out = {}; ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].forEach((n, i) => { out[n] = !!((latch >> i) & 1); }); return { out, latch, sr }; } };
        }
        case 'cd4017': {
          const g = nd[15], vdd = nd[3]; let cnt = 0, pc = 0;
          const v = n => sim.V(n) - sim.V(g), lv = n => (v(n) > v(vdd) / 2 ? 1 : 0);
          return { stamp() { sim.addG(vdd, g, 1 / 1e5); if (v(vdd) < 3) return;
              for (let i = 0; i < 10; i++) sim.addG(nd[4 + i], i === cnt ? vdd : g, 1 / 300); sim.addG(nd[14], cnt < 5 ? vdd : g, 1 / 300); },
            accept() { if (v(vdd) < 3) { cnt = 0; pc = 0; return; } const ck = lv(nd[0]); if (lv(nd[2])) cnt = 0; else if (ck && !pc && !lv(nd[1])) cnt = (cnt + 1) % 10; pc = ck; },
            read() { const out = {}; for (let i = 0; i < 10; i++) out['Q' + i] = i === cnt; out.CO = cnt < 5; return { out, count: cnt }; } };
        }
        case 'l298n': {
          const vs = nd[0], g = nd[1], v5 = nd[2]; let st = [0, 0, 0, 0];
          const vr = n => sim.V(n) - sim.V(g);
          return { stamp() { sim.addG(vs, g, 1 / 2000); if (vr(vs) > 7) { sim.addG(v5, g, 5); sim.addI(g, v5, 25); }
              st.forEach((s, i) => { const k = nd[9 + i]; if (s > 0) sim.addG(k, vs, 1); else if (s < 0) sim.addG(k, g, 1); }); },
            accept() { const hi = n => vr(n) > 2.3, ea = hi(nd[3]), eb = hi(nd[8]);
              st = [ea ? (hi(nd[4]) ? 1 : -1) : 0, ea ? (hi(nd[5]) ? 1 : -1) : 0, eb ? (hi(nd[6]) ? 1 : -1) : 0, eb ? (hi(nd[7]) ? 1 : -1) : 0]; },
            read() { const on = {}; ['OUT1', 'OUT2', 'OUT3', 'OUT4'].forEach((n, i) => { on[n] = st[i] > 0; }); return { on, outs: st.slice() }; } };
        }
        default: return null;
      }
    }

    /* microcontroller board or chip, driven by a sketch */
    makeBoard(c, nd, pn) {
      const sim = this, d = CL.DEFS[c.type], B = CL.BOARDS[d.board], P = () => sim.comp(c.id).props;
      const idx = {}; d.pins.forEach((p, i) => { if (!(p.n in idx)) idx[p.n] = i; });
      const node = n => (idx[n] === undefined ? undefined : nd[idx[n]]);
      const netOf = n => (idx[n] === undefined ? null : pn[idx[n]]);
      const g = node('GND'), vddN = node(B.logicPin);
      const supplies = Object.entries(B.supplies || {}).map(([n, v]) => [node(n), v]).filter(x => x[0] !== undefined);
      const RS = 0.05;
      let powered = !!B.selfPowered;
      const el = { id: c.id, ref: c.ref, board: B, netOf, t0: 0, rt: null };
      el.i2cMatch = l => !!B.i2c && netOf(B.i2c.sda) !== null && netOf(B.i2c.sda) === l.nets.sda && netOf(B.i2c.scl) === l.nets.scl;
      const io = {
        read: n => { const k = node(n); return k === undefined ? 0 : sim.V(k) - sim.V(g); },
        vdd: () => (vddN === undefined ? B.logic : sim.V(vddN) - sim.V(g)),
        dt: () => sim.dt,
        serial: txt => sim.serial(c.ref, txt),
        i2cProbe: addr => sim.lcds.some(l => l.addr() === addr && l.powered() && el.i2cMatch(l)),
        dht: n => { const net = netOf(n); const s = sim.dhts.find(x => x.nets.data === net && x.powered()); return s ? s.value() : null; }
      };
      const make = () => new CL.McuRuntime(P().code || '', io, B);
      if (powered) el.rt = make();
      const frac = (s, t0, t1) => {
        if (s.pwm == null) return s.level ? 1 : 0;
        const f = s.freq || B.pwmFreq, dd = s.pwm;
        const H = x => { const k = Math.floor(x * f); return (k * dd + Math.min(x * f - k, dd)) / f; };
        return CL.clamp((H(t1) - H(t0)) / (t1 - t0), 0, 1);
      };
      el.stamp = (dt, t) => {
        for (const [n, v] of supplies) { sim.addG(n, g, 1 / RS); sim.addI(g, n, v / RS); }
        if (!B.selfPowered && vddN !== undefined) sim.addG(vddN, g, 1 / 5000);
        if (!powered || !el.rt) return;
        const ro = B.rOut, tl = t - el.t0;
        for (const name in el.rt.pins) {
          const s = el.rt.pins[name], k = node(name);
          if (k === undefined) continue;
          if (s.mode === 'OUTPUT') { const fr = frac(s, tl - dt, tl); if (fr > 0) sim.addG(k, vddN, fr / ro); if (fr < 1) sim.addG(k, g, (1 - fr) / ro); }
          else if (s.mode === 'DAC') { sim.addG(k, g, 1 / 200); sim.addI(g, k, (s.dac || 0) / 200); }
          else if (s.mode === 'INPUT_PULLUP') sim.addG(k, vddN, 1 / B.pullup);
          else if (s.mode === 'INPUT_PULLDOWN') sim.addG(k, g, 1 / B.pullup);
        }
      };
      el.accept = (dt, t) => {
        if (!B.selfPowered) {
          const v = vddN === undefined ? 0 : sim.V(vddN) - sim.V(g), now = v >= (B.minV || 1.8);
          if (now && !powered) { el.rt = make(); el.t0 = t; }
          powered = now;
        }
        if (powered && el.rt) el.rt.tick(t - el.t0);
      };
      el.read = () => {
        const rt = el.rt, pins = {};
        d.pins.forEach((p, i) => {
          if (!B.gpioSet.has(p.n) || pins[p.n]) return;
          const s = rt && rt.pins[p.n];
          pins[p.n] = { v: sim.V(nd[i]) - sim.V(g), mode: s ? s.mode : 'INPUT', out: !!(powered && s && s.mode === 'OUTPUT' && (s.level || (s.pwm || 0) > 0)), pwm: s ? s.pwm : null };
        });
        let ledOn = false;
        if (B.led && rt && rt.pins[B.led] && powered) {
          const s = rt.pins[B.led];
          if (s.mode === 'OUTPUT') ledOn = B.ledActiveLow ? (s.pwm != null ? s.pwm < 1 : !s.level) : (s.pwm != null ? s.pwm > 0 : !!s.level);
          if (!pins[B.led]) pins[B.led] = { v: s.level ? B.logic : 0, mode: s.mode, out: ledOn, pwm: s.pwm, onboard: true };
        }
        let i = 0; for (const [n, v] of supplies) i += (v - (sim.V(n) - sim.V(g))) / RS;
        return { pins, ledOn, unpowered: !powered, error: rt ? rt.error : null, running: !!(powered && rt && rt.ok && !rt.error), board: B.name, i, vdd: io.vdd() };
      };
      this.boards.push(el); this.mcus.push(el);
      return el;
    }

    diode(a, k, Is, n, vz) {
      const sim = this, nvt = n * VT, vcrit = nvt * Math.log(nvt / (Math.SQRT2 * Is));
      let vd = 0, avgI = 0, inow = 0;
      return { nl: true,
        stamp() {
          let vnew = sim.V(a) - sim.V(k);
          let v = pnjlim(vnew, vd, nvt, vcrit);
          if (vz != null && vnew < -vz) { const vr = pnjlim(-vnew - vz, -vd - vz, nvt, vcrit); v = -(vr + vz); }
          if (Math.abs(v - vnew) > 1e-6) sim.limited = true;
          vd = v;
          const e = safeExp(v / nvt);
          let id = Is * (e - 1), gd = Is / nvt * e;
          if (vz != null) { const er = safeExp(-(v + vz) / nvt); id -= Is * er; gd += Is / nvt * er; }
          id += GMIN * v; gd += GMIN;
          sim.addG(a, k, gd); sim.addI(a, k, id - gd * v);
        },
        accept(dt) { const v = sim.V(a) - sim.V(k); let i = Is * (safeExp(v / nvt) - 1); if (vz != null) i -= Is * safeExp(-(v + vz) / nvt); inow = i; const al = Math.min(1, dt / 0.015); avgI += (Math.max(-0.05, Math.min(0.05, i)) - avgI) * al; },
        read() { return { v: sim.V(a) - sim.V(k), i: inow, bright: Math.max(0, Math.min(1.2, avgI / 0.01)) }; } };
    }
    bjt(B, C, E, pnp, beta, nf) {
      const sim = this, Is = 1e-14, br = 1, p = pnp ? -1 : 1;
      let vbe0 = 0, vbc0 = 0;
      return { nl: true,
        stamp() {
          const bf = beta(), VT = VT0 * (nf ? nf() : 1), vcrit = VT * Math.log(VT / (Math.SQRT2 * Is));
          const rbe = p * (sim.V(B) - sim.V(E)), rbc = p * (sim.V(B) - sim.V(C));
          const vbe = (vbe0 = pnjlim(rbe, vbe0, VT, vcrit));
          const vbc = (vbc0 = pnjlim(rbc, vbc0, VT, vcrit));
          if (Math.abs(vbe - rbe) > 1e-6 || Math.abs(vbc - rbc) > 1e-6) sim.limited = true;
          const ef = safeExp(vbe / VT), er = safeExp(vbc / VT);
          const Ief = Is * (ef - 1), Icr = Is * (er - 1), gef = Is / VT * ef + GMIN, gcr = Is / VT * er + GMIN;
          const fC = Ief - Icr * (1 + 1 / br), fB = Ief / bf + Icr / br + GMIN * (vbe + vbc);
          const C_be = gef, C_bc = -gcr * (1 + 1 / br), B_be = gef / bf + GMIN, B_bc = gcr / br + GMIN;
          const E_be = -(C_be + B_be), E_bc = -(C_bc + B_bc), fE = -(fC + fB);
          const term = (node, f, dbe, dbc) => {
            if (node < 0) return;
            sim.addA(node, B, dbe + dbc); sim.addA(node, E, -dbe); sim.addA(node, C, -dbc);
            sim.b[node] -= p * (f - dbe * vbe - dbc * vbc);
          };
          term(C, fC, C_be, C_bc); term(B, fB, B_be, B_bc); term(E, fE, E_be, E_bc);
        },
        accept() {},
        read() { const VT = VT0 * (nf ? nf() : 1); const vbe = p * (sim.V(B) - sim.V(E)), vbc = p * (sim.V(B) - sim.V(C)); const ic = Is * (safeExp(vbe / VT) - safeExp(vbc / VT)) - Is / br * (safeExp(vbc / VT) - 1); return { v: sim.V(C) - sim.V(E), i: p * ic, vbe: p * vbe }; } };
    }
    mosfet(Gn, Dn, Sn, pmos, vthF, kF) {
      const sim = this, lam = 0.01, p = pmos ? -1 : 1;
      const idf = (vg, vd, vs) => {
        const K = kF ? kF() : 0.25;
        let vgs = p * (vg - vs), vds = p * (vd - vs), sgn = 1;
        if (vds < 0) { vgs = p * (vg - vd); vds = -vds; sgn = -1; }
        const x = (vgs - vthF()) / 0.03, vov = x > 30 ? x * 0.03 : 0.03 * Math.log1p(Math.exp(x));
        const id = vds < vov ? K * (vov * vds - vds * vds / 2) * (1 + lam * vds) : 0.5 * K * vov * vov * (1 + lam * vds);
        return p * sgn * id + 1e-9 * (vd - vs);
      };
      return { nl: true,
        stamp() {
          const vg = sim.V(Gn), vd = sim.V(Dn), vs = sim.V(Sn), h = 1e-6;
          const i0 = idf(vg, vd, vs);
          const jg = (idf(vg + h, vd, vs) - idf(vg - h, vd, vs)) / (2 * h);
          const jd = (idf(vg, vd + h, vs) - idf(vg, vd - h, vs)) / (2 * h);
          const js = (idf(vg, vd, vs + h) - idf(vg, vd, vs - h)) / (2 * h);
          const c0 = i0 - jg * vg - jd * vd - js * vs;
          if (Dn >= 0) { sim.addA(Dn, Gn, jg); sim.addA(Dn, Dn, jd); sim.addA(Dn, Sn, js); sim.b[Dn] -= c0; }
          if (Sn >= 0) { sim.addA(Sn, Gn, -jg); sim.addA(Sn, Dn, -jd); sim.addA(Sn, Sn, -js); sim.b[Sn] += c0; }
        },
        accept() {}, read() { return { v: sim.V(Dn) - sim.V(Sn), i: idf(sim.V(Gn), sim.V(Dn), sim.V(Sn)) }; } };
    }

    solve() {
      const N = this.N, A = this.A, b = this.b;
      for (let col = 0; col < N; col++) {
        let piv = col, max = Math.abs(A[col * N + col]);
        for (let r = col + 1; r < N; r++) { const v = Math.abs(A[r * N + col]); if (v > max) { max = v; piv = r; } }
        if (max < 1e-18) return false;
        if (piv !== col) {
          for (let k = col; k < N; k++) { const t = A[col * N + k]; A[col * N + k] = A[piv * N + k]; A[piv * N + k] = t; }
          const t = b[col]; b[col] = b[piv]; b[piv] = t;
        }
        const d = A[col * N + col];
        for (let r = col + 1; r < N; r++) {
          const f = A[r * N + col] / d; if (f === 0) continue;
          for (let k = col; k < N; k++) A[r * N + k] -= f * A[col * N + k];
          b[r] -= f * b[col];
        }
      }
      for (let r = N - 1; r >= 0; r--) {
        let s = b[r];
        for (let k = r + 1; k < N; k++) s -= A[r * N + k] * b[k];
        b[r] = s / A[r * N + r];
      }
      return true;
    }

    step() {
      if (this.failed) return false;
      const dt = this.dt, t = this.t + dt, N = this.N;
      const maxIt = this.nonlinear ? 120 : 1;
      let ok = false;
      for (let it = 0; it < maxIt; it++) {
        this.A.fill(0); this.b.fill(0); this.limited = false;
        for (const e of this.elements) e.stamp(dt, t);
        for (let i = 0; i < this.nNodes; i++) this.A[i * N + i] += GMIN;
        if (!this.solve()) { this.failed = 'The circuit matrix is singular. Check for parallel voltage sources or a source shorted by a wire.'; this.errors.push(this.failed); return false; }
        let maxd = 0;
        for (let i = 0; i < N; i++) {
          let nv = this.b[i];
          if (this.nonlinear && i < this.nNodes) { const dv = nv - this.x[i]; if (dv > 10) nv = this.x[i] + 10; else if (dv < -10) nv = this.x[i] - 10; }
          const d = Math.abs(nv - this.x[i]);
          if (d > maxd) maxd = d;
          this.x[i] = nv;
        }
        if (!this.nonlinear || (it > 0 && maxd < 1e-7 && !this.limited)) { ok = true; break; }
      }
      if (!ok && this.nonlinear) this.nonConv = (this.nonConv || 0) + 1;
      this.t = t;
      for (const e of this.elements) e.accept(dt, t);
      return true;
    }
    readAll() {
      const out = {};
      for (const e of this.elements) { try { out[e.id] = e.read(); } catch (err) { /* ignore */ } }
      this.readings = out;
      return out;
    }
  }
  CL.Sim = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
