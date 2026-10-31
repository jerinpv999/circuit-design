/* Copperline manufacturing exports: Gerber RS-274X (X2 attributes), Excellon, BOM, pick & place, netlists */
(function (G) {
  const CL = (G.CL = G.CL || {});

  class Gerber {
    constructor(func, H, polarity = 'Positive') {
      this.func = func; this.H = H; this.ap = new Map(); this.body = []; this.nextD = 10; this.pol = polarity;
    }
    c(v) { return Math.round(v * 1e6); }
    X(x) { return 'X' + this.c(x); }
    Y(y) { return 'Y' + this.c(this.H - y); }
    aperture(kind, a, b) {
      const key = kind === 'C' ? `C,${a.toFixed(6)}` : `${kind},${a.toFixed(6)}X${b.toFixed(6)}`;
      if (!this.ap.has(key)) this.ap.set(key, 'D' + this.nextD++);
      const d = this.ap.get(key);
      if (this.cur !== d) { this.body.push(d + '*'); this.cur = d; }
    }
    flashPad(pd, grow = 0) {
      const w = pd.w + 2 * grow, h = pd.h + 2 * grow;
      if (pd.shape === 'circle') this.aperture('C', w);
      else if (pd.shape === 'oval') this.aperture('O', w, h);
      else this.aperture('R', w, h);
      this.body.push(`${this.X(pd.x)}${this.Y(pd.y)}D03*`);
    }
    flashCircle(x, y, d) { this.aperture('C', d); this.body.push(`${this.X(x)}${this.Y(y)}D03*`); }
    line(pts, w) {
      if (pts.length < 2) return;
      this.aperture('C', w);
      pts.forEach(([x, y], i) => this.body.push(`${this.X(x)}${this.Y(y)}${i ? 'D01' : 'D02'}*`));
    }
    region(pts) {
      this.body.push('G36*');
      pts.forEach(([x, y], i) => this.body.push(`${this.X(x)}${this.Y(y)}${i ? 'D01' : 'D02'}*`));
      this.body.push(`${this.X(pts[0][0])}${this.Y(pts[0][1])}D01*`);
      this.body.push('G37*');
    }
    polarity(clear) { this.body.push(clear ? '%LPC*%' : '%LPD*%'); }
    toString() {
      const head = ['G04 Copperline EDA Gerber RS-274X*', '%TF.GenerationSoftware,Copperline,EDA,1.0*%', `%TF.CreationDate,${new Date().toISOString().slice(0, 19)}*%`,
        `%TF.FileFunction,${this.func}*%`, `%TF.FilePolarity,${this.pol}*%`, '%FSLAX46Y46*%', '%MOMM*%', '%LPD*%', 'G01*'];
      for (const [k, d] of this.ap) head.push(`%AD${d}${k}*%`);
      return head.concat(this.body, ['M02*']).join('\n') + '\n';
    }
  }

  CL.exportGerbers = function (p) {
    const B = p.board, H = B.h;
    const nl = CL.buildNetlist(p);
    const pads = CL.boardPads(p, nl);
    const cu = CL.copperLayers(B);
    const files = {};
    const base = (p.name || 'copperline').replace(/[^\w-]+/g, '_');
    const fname = { 'F.Cu': 'F_Cu.gtl', 'B.Cu': 'B_Cu.gbl', 'In1.Cu': 'In1_Cu.g2', 'In2.Cu': 'In2_Cu.g3' };
    cu.forEach((layer, i) => {
      const pos = layer === 'F.Cu' ? 'Top' : layer === 'B.Cu' ? 'Bot' : 'Inr';
      const g = new Gerber(`Copper,L${i + 1},${pos}`, H);
      const pourNet = B.pour && B.pour[layer];
      if (pourNet) {
        g.region([[0.3, 0.3], [B.w - 0.3, 0.3], [B.w - 0.3, B.h - 0.3], [0.3, B.h - 0.3]]);
        g.polarity(true);
        pads.forEach(pd => { if (pd.layers.includes(layer) && pd.net !== pourNet) g.flashPad(pd, B.clearance + 0.1); });
        B.traces.forEach(t => { if (t.layer === layer && t.net !== pourNet) g.line(t.pts, t.w + 2 * (B.clearance + 0.1)); });
        B.vias.forEach(v => { if (v.net !== pourNet) g.flashCircle(v.x, v.y, v.d + 2 * (B.clearance + 0.1)); });
        g.polarity(false);
      }
      B.traces.forEach(t => { if (t.layer === layer) g.line(t.pts, t.w); });
      pads.forEach(pd => { if (pd.layers.includes(layer)) g.flashPad(pd); });
      B.vias.forEach(v => g.flashCircle(v.x, v.y, v.d));
      files[`${base}-${fname[layer]}`] = g.toString();
    });
    for (const side of ['F', 'B']) {
      const top = side === 'F', layer = side + '.Cu';
      const m = new Gerber(`Soldermask,${top ? 'Top' : 'Bot'}`, H, 'Negative');
      pads.forEach(pd => { if (pd.layers.includes(layer)) m.flashPad(pd, 0.05); });
      files[`${base}-${side}_Mask.${top ? 'gts' : 'gbs'}`] = m.toString();
      const sk = new Gerber(`Legend,${top ? 'Top' : 'Bot'}`, H);
      CL.silkItems(p, side).forEach(pl => sk.line(pl, 0.15));
      if (top) CL.strokeText((p.name || 'COPPERLINE').slice(0, 24), 1.5, B.h - 2.2, 1.4, 'l').forEach(pl => sk.line(pl, 0.15));
      files[`${base}-${side}_Silkscreen.${top ? 'gto' : 'gbo'}`] = sk.toString();
      const smdPads = pads.filter(pd => pd.smd && pd.layers.includes(layer));
      if (smdPads.length) { const ps = new Gerber(`Paste,${top ? 'Top' : 'Bot'}`, H); smdPads.forEach(pd => ps.flashPad(pd)); files[`${base}-${side}_Paste.${top ? 'gtp' : 'gbp'}`] = ps.toString(); }
    }
    const e = new Gerber('Profile,NP', H);
    e.line([[0, 0], [B.w, 0], [B.w, B.h], [0, B.h], [0, 0]], 0.1);
    files[`${base}-Edge_Cuts.gm1`] = e.toString();
    files[`${base}-PTH.drl`] = CL.exportDrill(p, pads);
    return files;
  };

  CL.exportDrill = function (p, pads) {
    const B = p.board, H = B.h;
    pads = pads || CL.boardPads(p);
    const holes = [];
    pads.forEach(pd => { if (pd.drill) holes.push([pd.drill, pd.x, pd.y]); });
    B.vias.forEach(v => holes.push([v.drill, v.x, v.y]));
    const sizes = [...new Set(holes.map(h => h[0].toFixed(3)))].sort((a, b) => a - b);
    const out = ['M48', '; DRILL file Copperline EDA', `; FORMAT={-:-/ absolute / metric / decimal}`, '; #@! TF.FileFunction,Plated,1,' + CL.copperLayers(B).length + ',PTH', 'FMAT,2', 'METRIC'];
    sizes.forEach((s, i) => out.push(`T${i + 1}C${s}`));
    out.push('%', 'G90', 'G05');
    sizes.forEach((s, i) => {
      out.push(`T${i + 1}`);
      holes.filter(h => h[0].toFixed(3) === s).forEach(h => out.push(`X${h[1].toFixed(3)}Y${(H - h[2]).toFixed(3)}`));
    });
    out.push('M30');
    return out.join('\n') + '\n';
  };

  const csvCell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const valueOf = c => { const d = CL.DEFS[c.type]; return d.val ? d.val(c) : d.name; };

  CL.exportBOM = function (p) {
    const rows = new Map();
    for (const c of p.components) {
      const d = CL.DEFS[c.type]; if (!d.fp) continue;
      const fp = d.fp(c);
      const key = d.name + '|' + valueOf(c) + '|' + fp.name;
      if (!rows.has(key)) rows.set(key, { refs: [], value: valueOf(c), fp: fp.name, part: d.name });
      rows.get(key).refs.push(c.ref);
    }
    const lines = ['Item,Designator,Qty,Value,Description,Footprint'];
    let i = 1;
    for (const r of rows.values()) { r.refs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); lines.push([i++, r.refs.join(' '), r.refs.length, r.value, r.part, r.fp].map(csvCell).join(',')); }
    return lines.join('\n') + '\n';
  };

  CL.exportCPL = function (p) {
    const H = p.board.h;
    const lines = ['Designator,Val,Package,Mid X,Mid Y,Rotation,Layer'];
    for (const c of p.components) {
      if (!c.pcb) continue; const fp = CL.footprint(c); if (!fp) continue;
      lines.push([c.ref, valueOf(c), fp.name, c.pcb.x.toFixed(3) + 'mm', (H - c.pcb.y).toFixed(3) + 'mm', ((4 - (c.pcb.rot || 0)) % 4) * 90, c.pcb.side === 'B' ? 'bottom' : 'top'].map(csvCell).join(','));
    }
    return lines.join('\n') + '\n';
  };

  CL.exportKicadNet = function (p) {
    const nl = CL.buildNetlist(p);
    const q = s => `"${String(s).replace(/"/g, '\\"')}"`;
    const out = ['(export (version "E")', `  (design (source ${q((p.name || 'copperline') + '.json')}) (date ${q(new Date().toISOString())}) (tool "Copperline EDA 1.0"))`, '  (components'];
    for (const c of p.components) {
      const d = CL.DEFS[c.type]; if (d.virtual) continue;
      const fp = d.fp ? d.fp(c) : null;
      out.push(`    (comp (ref ${q(c.ref)}) (value ${q(valueOf(c))}) (footprint ${q(fp ? 'Copperline:' + fp.name : '')}) (libsource (lib "copperline") (part ${q(c.type)})))`);
    }
    out.push('  )', '  (nets');
    let code = 1;
    for (const [name, net] of nl.nets) {
      const nodes = net.pins.filter(pp => !CL.DEFS[pp.c.type].virtual);
      if (!nodes.length) continue;
      out.push(`    (net (code ${q(code++)}) (name ${q(name.startsWith('N$') ? 'Net-' + name.slice(2) : name)})`);
      for (const pp of nodes) {
        const d = CL.DEFS[pp.c.type];
        const fp = d.fp ? d.fp(pp.c) : null;
        const pads = fp ? fp.pads.filter(pd => pd.pin === pp.i).map(pd => pd.num) : [pp.i + 1];
        pads.forEach(num => out.push(`      (node (ref ${q(pp.c.ref)}) (pin ${q(num)}) (pinfunction ${q(d.pins[pp.i].n)}))`));
      }
      out.push('    )');
    }
    out.push('  )', ')');
    return out.join('\n') + '\n';
  };

  CL.exportSpice = function (p, dt = 1e-5, T = 0.01) {
    const nl = CL.buildNetlist(p);
    const N = (c, i) => { const n = nl.pinNet.get(c.id)[i]; return n === 'GND' ? '0' : n.replace(/[^\w]/g, '_'); };
    const v = x => String(x).replace(/Ω|V|A|F|H|Hz/g, '').replace(/^(\d*\.?\d+)M$/, '$1Meg');
    const lines = [`* ${p.name || 'Copperline circuit'} — exported by Copperline EDA`, ''];
    const models = new Set();
    for (const c of p.components) {
      const P = c.props, rr = c.ref.replace(/[^\w]/g, '');
      const ltr = { ldr: 'R', ntc: 'R', bridge: 'D', rgbled: 'D', relay: 'R', resistor: 'R', capacitor: 'C', ecap: 'C', inductor: 'L', pot: 'R', diode: 'D', zener: 'D', led: 'D', npn: 'Q', pnp: 'Q', nmos: 'M', pmos: 'M', dcsource: 'V', battery: 'V', acsource: 'V', funcgen: 'V', isource: 'I', ammeter: 'V', switch: 'R', button: 'R', lamp: 'R', motor: 'R', buzzer: 'R', fuse: 'R', opamp: 'E', reg7805: 'B' }[c.type] || '';
      const r = rr.toUpperCase().startsWith(ltr) ? rr.slice(1) : rr;
      switch (c.type) {
        case 'resistor': lines.push(`R${r} ${N(c, 0)} ${N(c, 1)} ${v(P.resistance)}`); break;
        case 'capacitor': case 'ecap': lines.push(`C${r} ${N(c, 0)} ${N(c, 1)} ${v(P.capacitance)}`); break;
        case 'inductor': lines.push(`L${r} ${N(c, 0)} ${N(c, 1)} ${v(P.inductance)}`); break;
        case 'pot': { const R = CL.parseSI(P.resistance), pos = +P.position; lines.push(`R${r}a ${N(c, 0)} ${N(c, 2)} ${Math.max(1, R * pos).toPrecision(4)}`, `R${r}b ${N(c, 2)} ${N(c, 1)} ${Math.max(1, R * (1 - pos)).toPrecision(4)}`); break; }
        case 'diode': lines.push(`D${r} ${N(c, 0)} ${N(c, 1)} D${P.model}`); models.add(`.model D${P.model} D(Is=${({ '1N4148': '2.52n', '1N4007': '7.03n', '1N5819': '10u' })[P.model]} N=${({ '1N4148': 1.752, '1N4007': 1.808, '1N5819': 1.1 })[P.model]})`); break;
        case 'zener': lines.push(`D${r} ${N(c, 0)} ${N(c, 1)} DZ${v(P.vz)}`); models.add(`.model DZ${v(P.vz)} D(Is=10f BV=${v(P.vz)} IBV=1m)`); break;
        case 'led': lines.push(`D${r} ${N(c, 0)} ${N(c, 1)} LED_${P.color}`); { const vf = CL.LED_COLORS[P.color].vf; models.add(`.model LED_${P.color} D(Is=${(0.01 / Math.exp(vf / (2 * 0.025852))).toExponential(3)} N=2)`); } break;
        case 'npn': { const m = P.model || '2N3904'; lines.push(`Q${r} ${N(c, 1)} ${N(c, 0)} ${N(c, 2)} Q${m}`); models.add(`.model Q${m} NPN(Is=10f Bf=${P.beta} Br=1${(CL.BJT_MODELS.npn[m] || {}).n ? ' Nf=2' : ''})`); break; }
        case 'pnp': { const m = P.model || '2N3906'; lines.push(`Q${r} ${N(c, 2)} ${N(c, 0)} ${N(c, 1)} Q${m}`); models.add(`.model Q${m} PNP(Is=10f Bf=${P.beta} Br=1${(CL.BJT_MODELS.pnp[m] || {}).n ? ' Nf=2' : ''})`); break; }
        case 'nmos': { const m = P.model || '2N7000'; lines.push(`M${r} ${N(c, 1)} ${N(c, 0)} ${N(c, 2)} ${N(c, 2)} M${m}`); models.add(`.model M${m} NMOS(Vto=${P.vth} Kp=${(CL.MOS_MODELS.nmos[m] || { k: 0.25 }).k})`); break; }
        case 'pmos': { const m = P.model || 'BS250'; lines.push(`M${r} ${N(c, 2)} ${N(c, 0)} ${N(c, 1)} ${N(c, 1)} M${m}`); models.add(`.model M${m} PMOS(Vto=-${P.vth} Kp=${(CL.MOS_MODELS.pmos[m] || { k: 0.25 }).k})`); break; }
        case 'dcsource': case 'battery': lines.push(`V${r} ${N(c, 0)} ${N(c, 1)} DC ${v(P.voltage)}`); break;
        case 'acsource': lines.push(`V${r} ${N(c, 0)} ${N(c, 1)} SIN(${v(P.offset)} ${v(P.amplitude)} ${v(P.frequency)})`); break;
        case 'funcgen': { const f = CL.parseSI(P.frequency), A = CL.parseSI(P.amplitude), o = CL.parseSI(P.offset), per = 1 / f;
          lines.push(P.waveform === 'sine' ? `V${r} ${N(c, 0)} ${N(c, 1)} SIN(${o} ${A} ${f})` : `V${r} ${N(c, 0)} ${N(c, 1)} PULSE(${o - A} ${o + A} 0 ${(per / 1000).toExponential(2)} ${(per / 1000).toExponential(2)} ${(per * (+P.duty || 0.5)).toExponential(4)} ${per.toExponential(4)})`); break; }
        case 'isource': lines.push(`I${r} ${N(c, 1)} ${N(c, 0)} DC ${v(P.current)}`); break;
        case 'ammeter': lines.push(`V${r} ${N(c, 0)} ${N(c, 1)} DC 0`); break;
        case 'switch': lines.push(`R${r} ${N(c, 0)} ${N(c, 1)} ${P.closed ? '20m' : '1G'}`); break;
        case 'button': lines.push(`R${r} ${N(c, 0)} ${N(c, 1)} 1G ; push button (open)`); break;
        case 'lamp': case 'motor': case 'buzzer': lines.push(`R${r} ${N(c, 0)} ${N(c, 1)} ${v(P.resistance)} ; ${c.type}`); break;
        case 'fuse': lines.push(`R${r} ${N(c, 0)} ${N(c, 1)} 50m ; fuse ${P.rating}A`); break;
        case 'opamp': lines.push(`E${r} ${N(c, 2)} 0 ${N(c, 1)} ${N(c, 0)} ${v(P.gain)} ; ideal op-amp (rails not modelled)`); break;
        case 'reg7805': lines.push(`* ${c.ref}: 78${P.vout} regulator — behavioural`, `B${r} ${N(c, 1)} ${N(c, 2)} V=min(max(V(${N(c, 0)},${N(c, 2)})-2,0),${v(P.vout)})`); break;
        case 'ldr': { const L = CL.clamp(+P.light || 0, 0, 100) / 100, rd = CL.parseSI(P.dark), rb = CL.parseSI(P.bright); lines.push(`R${r} ${N(c, 0)} ${N(c, 1)} ${Math.exp(Math.log(rd) + L * (Math.log(rb) - Math.log(rd))).toPrecision(4)} ; LDR at ${P.light}% light`); break; }
        case 'ntc': { const T = +P.temperature + 273.15; lines.push(`R${r} ${N(c, 0)} ${N(c, 1)} ${(CL.parseSI(P.r25) * Math.exp(CL.parseSI(P.beta) * (1 / T - 1 / 298.15))).toPrecision(4)} ; NTC at ${P.temperature} C`); break; }
        case 'bridge': lines.push(`D${r}a ${N(c, 0)} ${N(c, 2)} D1N4007`, `D${r}b ${N(c, 1)} ${N(c, 2)} D1N4007`, `D${r}c ${N(c, 3)} ${N(c, 0)} D1N4007`, `D${r}d ${N(c, 3)} ${N(c, 1)} D1N4007`); models.add('.model D1N4007 D(Is=7.03n N=1.808)'); break;
        case 'rgbled': { const ca = P.type === 'common anode'; [['R', 1.8], ['G', 2.1], ['B', 3.0]].forEach(([cn, vf], i) => { lines.push(ca ? `D${r}${cn} ${N(c, 3)} ${N(c, i)} LED_${cn}` : `D${r}${cn} ${N(c, i)} ${N(c, 3)} LED_${cn}`); models.add(`.model LED_${cn} D(Is=${(0.01 / Math.exp(vf / (2 * 0.025852))).toExponential(3)} N=2)`); }); break; }
        case 'relay': lines.push(`R${r}coil ${N(c, 0)} ${N(c, 1)} ${P.coil === '12V' ? 400 : 70} ; relay coil`, `R${r}nc ${N(c, 2)} ${N(c, 3)} 50m ; contacts shown released`, `R${r}no ${N(c, 2)} ${N(c, 4)} 1G`); break;
        case 'joystick': { const x = +P.x, y = +P.y; lines.push(`R${r}x1 ${N(c, 1)} ${N(c, 2)} ${Math.max(1, 1e4 * (1 - x)).toPrecision(4)}`, `R${r}x2 ${N(c, 2)} ${N(c, 0)} ${Math.max(1, 1e4 * x).toPrecision(4)}`, `R${r}y1 ${N(c, 1)} ${N(c, 3)} ${Math.max(1, 1e4 * (1 - y)).toPrecision(4)}`, `R${r}y2 ${N(c, 3)} ${N(c, 0)} ${Math.max(1, 1e4 * y).toPrecision(4)}`); break; }
        default: if (!CL.DEFS[c.type].virtual) lines.push(`* ${c.ref} (${CL.DEFS[c.type].name}) has no SPICE primitive — behavioural in Copperline only`);
      }
    }
    lines.push('', ...models, '', `.tran ${dt} ${T}`, '.end');
    return lines.join('\n') + '\n';
  };
})(typeof window !== 'undefined' ? window : globalThis);
