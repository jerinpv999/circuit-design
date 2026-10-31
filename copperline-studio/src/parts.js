/* Copperline parts library: schematic symbols (10px per grid unit), properties, footprints (mm) */
(function (G) {
  const CL = (G.CL = G.CL || {});
  const S = 10; // px per grid
  CL.GRID = S;

  const LED_COLORS = {
    red: { hex: '#ff3b30', vf: 1.8 }, orange: { hex: '#ff8a1f', vf: 1.9 }, yellow: { hex: '#ffd60a', vf: 2.0 },
    green: { hex: '#30d158', vf: 2.1 }, blue: { hex: '#2f7bff', vf: 3.0 }, white: { hex: '#f4f7ff', vf: 3.1 }
  };
  CL.LED_COLORS = LED_COLORS;

  const fmt = (v, u) => v + u;
  const T = (x, y, txt, cls = 't', anchor = 'middle') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${txt}</text>`;
  const glowDef = (cx, cy, r, color, a) => a > 0.02 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${(0.15 + 0.6 * a).toFixed(2)}" class="glow"/>` : '';

  /* ---------- footprint helpers (mm) ---------- */
  const P = (num, pin, x, y, shape, w, h, drill) => ({ num, pin, x, y, shape, w, h: h ?? w, drill: drill || 0 });
  const silkRect = (w, h) => ({ t: 'l', pts: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2]] });
  const silkCircle = (r, x = 0, y = 0) => ({ t: 'c', x, y, r });
  const FP = {
    axial(pitch = 10.16, bodyL = 6.3, bodyD = 2.4, kind = 'axial', extra = {}) {
      return { name: `Axial_P${pitch}mm`, pads: [P(1, 0, -pitch / 2, 0, 'rect', 1.6, 1.6, 0.8), P(2, 1, pitch / 2, 0, 'circle', 1.6, 1.6, 0.8)],
        silk: [silkRect(bodyL + 0.4, bodyD + 0.4), { t: 'l', pts: [[-pitch / 2 + 1.1, 0], [-bodyL / 2 - 0.2, 0]] }, { t: 'l', pts: [[pitch / 2 - 1.1, 0], [bodyL / 2 + 0.2, 0]] }],
        body: Object.assign({ kind, l: bodyL, d: bodyD, pitch }, extra), size: [pitch + 2, bodyD + 1] };
    },
    smd(code, kind = 'smdR', extra = {}) {
      const t = { '0805': [0.95, 1.0, 1.25, 2.0, 1.25], '0603': [0.8, 0.9, 0.95, 1.6, 0.8], '1206': [1.5, 1.15, 1.8, 3.2, 1.6] }[code];
      return { name: `${code}`, smd: true, pads: [P(1, 0, -t[0], 0, 'rect', t[1], t[2]), P(2, 1, t[0], 0, 'rect', t[1], t[2])],
        silk: [{ t: 'l', pts: [[-t[3] / 2 + 0.2, -t[4] / 2 - 0.35], [t[3] / 2 - 0.2, -t[4] / 2 - 0.35]] }, { t: 'l', pts: [[-t[3] / 2 + 0.2, t[4] / 2 + 0.35], [t[3] / 2 - 0.2, t[4] / 2 + 0.35]] }],
        body: Object.assign({ kind, l: t[3], w: t[4], h: 0.55 }, extra), size: [t[3] + 1, t[4] + 1] };
    },
    radial(pitch = 2.5, D = 5, H = 7, kind = 'ecap', extra = {}) {
      return { name: `CP_Radial_D${D}mm_P${pitch}mm`, pads: [P(1, 0, -pitch / 2, 0, 'rect', 1.6, 1.6, 0.8), P(2, 1, pitch / 2, 0, 'circle', 1.6, 1.6, 0.8)],
        silk: [silkCircle(D / 2 + 0.15), { t: 'l', pts: [[-D / 2 - 1.2, -D / 2], [-D / 2 - 0.2, -D / 2]] }, { t: 'l', pts: [[-D / 2 - 0.7, -D / 2 - 0.5], [-D / 2 - 0.7, -D / 2 + 0.5]] }],
        body: Object.assign({ kind, d: D, h: H }, extra), size: [D + 1, D + 1] };
    },
    disc(pitch = 2.54) {
      return { name: `C_Disc_P${pitch}mm`, pads: [P(1, 0, -pitch / 2, 0, 'circle', 1.5, 1.5, 0.8), P(2, 1, pitch / 2, 0, 'circle', 1.5, 1.5, 0.8)],
        silk: [silkRect(4.6, 2.4)], body: { kind: 'disc', w: 4.2, t: 2.0, h: 4 }, size: [5, 3] };
    },
    led5(color) {
      return { name: 'LED_D5.0mm', pads: [P(1, 0, -1.27, 0, 'rect', 1.8, 1.8, 0.9), P(2, 1, 1.27, 0, 'circle', 1.8, 1.8, 0.9)],
        silk: [{ t: 'arc', x: 0, y: 0, r: 3.0, a0: 0.45, a1: 2 * Math.PI - 0.45 }, { t: 'l', pts: [[2.7, -1.3], [2.7, 1.3]] }],
        body: { kind: 'led', d: 5, h: 8.6, color }, size: [6.5, 6.5] };
    },
    to92(order) {
      return { name: 'TO-92_Inline', pads: [P(1, order[0], -2.54, 0, 'rect', 1.3, 1.8, 0.75), P(2, order[1], 0, 0, 'oval', 1.3, 1.8, 0.75), P(3, order[2], 2.54, 0, 'oval', 1.3, 1.8, 0.75)],
        silk: [{ t: 'l', pts: [[-2.4, 1.8], [2.4, 1.8]] }, { t: 'arc', x: 0, y: 0, r: 2.6, a0: Math.PI + 0.75, a1: 2 * Math.PI - 0.75 }],
        body: { kind: 'to92' }, size: [6.5, 5] };
    },
    to220(order) {
      return { name: 'TO-220-3_Vertical', pads: [P(1, order[0], -2.54, 0, 'rect', 1.9, 2.4, 1.1), P(2, order[1], 0, 0, 'oval', 1.9, 2.4, 1.1), P(3, order[2], 2.54, 0, 'oval', 1.9, 2.4, 1.1)],
        silk: [silkRect(10.4, 4.8), { t: 'l', pts: [[-5.2, -1.2], [5.2, -1.2]] }], body: { kind: 'to220' }, size: [11, 5.5] };
    },
    dip(n, map, hidden = {}) {
      const pads = [], half = n / 2, row = 7.62;
      for (let i = 0; i < n; i++) {
        const left = i < half, k = left ? i : n - 1 - i;
        const y = (k - (half - 1) / 2) * 2.54;
        const num = i + 1;
        const p = P(num, map[num] ?? -1, left ? -row / 2 : row / 2, y, num === 1 ? 'rect' : 'oval', 1.6, 1.6, 0.8);
        if (hidden[num]) p.hidden = hidden[num];
        pads.push(p);
      }
      const h = half * 2.54 + 0.6;
      return { name: `DIP-${n}_W7.62mm`, pads, silk: [{ t: 'l', pts: [[-1, -h / 2], [-2.6, -h / 2], [-2.6, h / 2], [2.6, h / 2], [2.6, -h / 2], [1, -h / 2]] }, { t: 'arc', x: 0, y: -h / 2, r: 1, a0: 0, a1: Math.PI }],
        body: { kind: 'dip', n, l: h - 0.4, w: 6.4 }, size: [10, h + 1] };
    },
    header(n, map) {
      const pads = [];
      for (let i = 0; i < n; i++) pads.push(P(i + 1, map ? map[i] : i, 0, (i - (n - 1) / 2) * 2.54, i === 0 ? 'rect' : 'oval', 1.7, 1.7, 1.0));
      return { name: `PinHeader_1x${String(n).padStart(2, '0')}_P2.54mm`, pads, silk: [silkRect(2.54, n * 2.54)], body: { kind: 'header', n }, size: [3, n * 2.54 + 0.5] };
    },
    terminal2(kind = 'terminal') {
      return { name: 'TerminalBlock_1x02_P5.08mm', pads: [P(1, 0, -2.54, 0, 'rect', 2.4, 2.4, 1.2), P(2, 1, 2.54, 0, 'circle', 2.4, 2.4, 1.2)],
        silk: [silkRect(10.2, 8)], body: { kind }, size: [10.5, 8.5] };
    },
    tact() {
      return { name: 'SW_PUSH_6mm', pads: [P(1, 0, -3.25, -2.25, 'circle', 2, 2, 1.0), P(2, 0, -3.25, 2.25, 'circle', 2, 2, 1.0), P(3, 1, 3.25, -2.25, 'circle', 2, 2, 1.0), P(4, 1, 3.25, 2.25, 'circle', 2, 2, 1.0)],
        silk: [silkRect(6.2, 6.2), silkCircle(1.7)], body: { kind: 'tact' }, size: [8.5, 7] };
    },
    slide() {
      return { name: 'SW_Slide_SPST_P2.54mm', pads: [P(1, 0, -1.27, 0, 'rect', 1.6, 1.6, 0.9), P(2, 1, 1.27, 0, 'circle', 1.6, 1.6, 0.9)],
        silk: [silkRect(8.6, 3.6)], body: { kind: 'slide' }, size: [9, 4] };
    },
    pot() {
      return { name: 'Potentiometer_Trimmer_P2.54mm', pads: [P(1, 0, -2.54, 0, 'rect', 1.7, 1.7, 1.0), P(2, 2, 0, 0, 'circle', 1.7, 1.7, 1.0), P(3, 1, 2.54, 0, 'circle', 1.7, 1.7, 1.0)],
        silk: [silkRect(9.6, 9.6)], body: { kind: 'pot' }, size: [10, 10] };
    },
    hc49() {
      return { name: 'Crystal_HC49-U_Vertical', pads: [P(1, 0, -2.44, 0, 'circle', 1.5, 1.5, 0.8), P(2, 1, 2.44, 0, 'circle', 1.5, 1.5, 0.8)],
        silk: [silkRect(11, 4.6)], body: { kind: 'crystal' }, size: [11.5, 5] };
    },
    buzzer() {
      return { name: 'Buzzer_12x9.5RM7.6', pads: [P(1, 0, -3.8, 0, 'rect', 2, 2, 1.0), P(2, 1, 3.8, 0, 'circle', 2, 2, 1.0)],
        silk: [silkCircle(6.1)], body: { kind: 'buzzer' }, size: [12.5, 12.5] };
    },
    sevenseg() {
      const map = { 1: 4, 2: 3, 3: 8, 4: 2, 5: 7, 6: 1, 7: 0, 8: 8, 9: 5, 10: 6 };
      const pads = [];
      for (let i = 0; i < 5; i++) pads.push(P(i + 1, map[i + 1], -5.08 + i * 2.54, 7.62, i === 0 ? 'rect' : 'oval', 1.6, 1.9, 0.8));
      for (let i = 0; i < 5; i++) pads.push(P(i + 6, map[i + 6], 5.08 - i * 2.54, -7.62, 'oval', 1.6, 1.9, 0.8));
      return { name: '7SEG_0.56in_10pin', pads, silk: [silkRect(12.6, 19)], body: { kind: 'sevenseg' }, size: [13, 19.5] };
    },
    mcuboard() {
      const pads = [];
      for (let i = 0; i < 10; i++) pads.push(P(i + 1, i, -7.62, -11.43 + i * 2.54, i === 0 ? 'rect' : 'oval', 1.7, 1.7, 1.0));
      const right = [10, 11, 12, 13, 14, 15, 16, 17, -1, 18];
      for (let i = 0; i < 10; i++) pads.push(P(i + 11, right[i], 7.62, -11.43 + i * 2.54, 'oval', 1.7, 1.7, 1.0));
      return { name: 'MCU_Module_2x10_W15.24mm', pads, silk: [silkRect(18.5, 33)], body: { kind: 'mcuboard' }, size: [19, 34] };
    }
  };
  CL.FP = FP;

  /* ---------- definitions ---------- */
  const D = {};
  const def = (type, o) => { D[type] = Object.assign({ type, props: {}, meta: {}, labels: { ref: [0, -14], val: [0, 20], auto: true } }, o); };
  const H2 = [{ n: '1', x: -3, y: 0 }, { n: '2', x: 3, y: 0 }];
  const V2 = [{ n: '+', x: 0, y: -3 }, { n: '−', x: 0, y: 3 }];
  const pkgR = ['Axial THT', '0805 SMD', '0603 SMD', '1206 SMD'];
  const smdOf = p => (p || '').split(' ')[0];

  /* Passives */
  def('resistor', { name: 'Resistor', cat: 'Passive', prefix: 'R', pins: H2, props: { resistance: '1k', package: 'Axial THT' },
    meta: { resistance: { label: 'Resistance', unit: 'Ω', kind: 'si' }, package: { label: 'Package', kind: 'select', options: pkgR } },
    val: c => c.props.resistance + 'Ω',
    draw: () => `<path class="s" d="M-30 0H-15l2.5 -5l5 10l5 -10l5 10l5 -10l5 10l2.5 -5H30"/>`,
    fp: c => c.props.package.startsWith('Axial') ? FP.axial(10.16, 6.3, 2.4, 'axial', { bands: c.props.resistance }) : FP.smd(smdOf(c.props.package), 'smdR') });
  def('capacitor', { name: 'Capacitor', cat: 'Passive', prefix: 'C', pins: H2, props: { capacitance: '100n', package: 'Disc THT' },
    meta: { capacitance: { label: 'Capacitance', unit: 'F', kind: 'si' }, package: { label: 'Package', kind: 'select', options: ['Disc THT', '0805 SMD', '0603 SMD', '1206 SMD'] } },
    val: c => c.props.capacitance + 'F',
    draw: () => `<path class="s" d="M-30 0H-4M4 0H30"/><path class="s w" d="M-4 -11V11M4 -11V11"/>`,
    fp: c => c.props.package.startsWith('Disc') ? FP.disc() : FP.smd(smdOf(c.props.package), 'smdC') });
  def('ecap', { name: 'Electrolytic Cap', cat: 'Passive', prefix: 'C', pins: [{ n: '+', x: -3, y: 0 }, { n: '−', x: 3, y: 0 }], props: { capacitance: '100u', voltage: '25V' },
    meta: { capacitance: { label: 'Capacitance', unit: 'F', kind: 'si' }, voltage: { label: 'Rated voltage', kind: 'text' } },
    val: c => c.props.capacitance + 'F',
    draw: () => `<path class="s" d="M-30 0H-4M3 0H30"/><path class="s w" d="M-4 -11V11"/><path class="s w" d="M7 -11Q2 0 7 11"/><path class="s" d="M-13 -9h6M-10 -12v6"/>`,
    fp: () => FP.radial(2.5, 6.3, 11, 'ecap') });
  def('inductor', { name: 'Inductor', cat: 'Passive', prefix: 'L', pins: H2, props: { inductance: '10m' },
    meta: { inductance: { label: 'Inductance', unit: 'H', kind: 'si' } }, val: c => c.props.inductance + 'H',
    draw: () => `<path class="s" d="M-30 0H-20a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0H30"/>`,
    fp: () => FP.radial(5, 9, 10, 'inductor') });
  def('pot', { name: 'Potentiometer', cat: 'Passive', prefix: 'RV', pins: [{ n: 'A', x: -3, y: 0 }, { n: 'B', x: 3, y: 0 }, { n: 'W', x: 0, y: 2 }],
    props: { resistance: '10k', position: 0.5 }, meta: { resistance: { label: 'Resistance', unit: 'Ω', kind: 'si' }, position: { label: 'Wiper', kind: 'range', live: true } },
    labels: { ref: [0, -14], val: [18, 18] }, val: c => c.props.resistance + 'Ω',
    draw: c => { const x = -15 + 30 * c.props.position; return `<path class="s" d="M-30 0H-15l2.5 -5l5 10l5 -10l5 10l5 -10l5 10l2.5 -5H30"/><path class="s" d="M0 20V14H${x.toFixed(1)}V8"/><path class="f" d="M${x - 3.5} 9L${x} 3L${x + 3.5} 9Z"/>`; },
    fp: () => FP.pot() });
  def('crystal', { name: 'Crystal', cat: 'Passive', prefix: 'Y', pins: H2, props: { frequency: '16M' },
    meta: { frequency: { label: 'Frequency', unit: 'Hz', kind: 'si' } }, val: c => c.props.frequency + 'Hz',
    draw: () => `<path class="s" d="M-30 0H-9M9 0H30M-9 -9V9M9 -9V9"/><rect class="b" x="-5" y="-7" width="10" height="14"/>`, fp: () => FP.hc49() });
  def('fuse', { name: 'Fuse', cat: 'Passive', prefix: 'F', pins: H2, props: { rating: '500m' },
    meta: { rating: { label: 'Trip current', unit: 'A', kind: 'si' } }, val: c => c.props.rating + 'A',
    draw: (c, st) => `<path class="s" d="M-30 0H30"/><rect class="b" x="-15" y="-5" width="30" height="10"/>` + (st && st.blown ? `<path class="s bad" d="M-6 -9L6 9M6 -9L-6 9"/>` : `<path class="s" d="M-15 0H15"/>`),
    fp: () => FP.axial(10.16, 6.3, 2.4, 'fuse') });

  /* Semiconductors */
  def('diode', { name: 'Diode 1N4148', cat: 'Semiconductor', prefix: 'D', pins: [{ n: 'A', x: -3, y: 0 }, { n: 'K', x: 3, y: 0 }], props: { model: '1N4148', package: 'Axial THT' },
    meta: { model: { label: 'Model', kind: 'select', options: ['1N4148', '1N4007', '1N5819'] }, package: { label: 'Package', kind: 'select', options: ['Axial THT', 'SOD-123 SMD'] } },
    val: c => c.props.model,
    draw: () => `<path class="s" d="M-30 0H-7M7 0H30"/><path class="f" d="M-7 -8L-7 8L7 0Z"/><path class="s w" d="M7 -8V8"/>`,
    fp: c => c.props.package.startsWith('Axial') ? FP.axial(7.62, 4.2, 1.9, 'diode') : FP.smd('1206', 'smdD') });
  def('zener', { name: 'Zener Diode', cat: 'Semiconductor', prefix: 'D', pins: [{ n: 'A', x: -3, y: 0 }, { n: 'K', x: 3, y: 0 }], props: { vz: '5.1' },
    meta: { vz: { label: 'Zener voltage', unit: 'V', kind: 'si' } }, val: c => c.props.vz + 'V',
    draw: () => `<path class="s" d="M-30 0H-7M7 0H30"/><path class="f" d="M-7 -8L-7 8L7 0Z"/><path class="s w" d="M3 -10L7 -8V8L11 10"/>`,
    fp: () => FP.axial(7.62, 4.2, 1.9, 'diode') });
  def('led', { name: 'LED', cat: 'Semiconductor', prefix: 'D', pins: [{ n: 'A', x: -3, y: 0 }, { n: 'K', x: 3, y: 0 }], props: { color: 'red', package: '5mm THT' },
    meta: { color: { label: 'Colour', kind: 'select', options: Object.keys(LED_COLORS) }, package: { label: 'Package', kind: 'select', options: ['5mm THT', '0805 SMD'] } },
    val: c => c.props.color,
    draw: (c, st) => { const col = LED_COLORS[c.props.color] || LED_COLORS.red; const b = st ? st.bright : 0;
      return glowDef(0, 0, 13, col.hex, b) + `<path class="s" d="M-30 0H-7M7 0H30"/><path d="M-7 -8L-7 8L7 0Z" class="ledbody" style="fill:${b > 0.05 ? col.hex : 'var(--sym-fill)'}"/><path class="s" d="M-7 -8L-7 8L7 0Z"/><path class="s w" d="M7 -8V8"/><path class="s" d="M1 -11l6 -7M6 -9l6 -7"/><path class="f" d="M7 -18l-3.5 1.5l2 2zM12 -16l-3.5 1.5l2 2z"/>`; },
    fp: c => c.props.package.startsWith('5mm') ? FP.led5(c.props.color) : FP.smd('0805', 'smdLED', { color: c.props.color }) });
  const bjt = (pnp) => (c, st) => `<circle class="b" cx="3" cy="0" r="15"/><path class="s" d="M-30 0H-4"/><path class="s w" d="M-4 -10V10"/>` +
    (pnp ? `<path class="s" d="M-4 5L10 14V30M-4 -5L10 -14V-30"/><path class="f" d="M-2 -6.5l6 -1l-3 5z"/>` : `<path class="s" d="M-4 -5L10 -14V-30M-4 5L10 14V30"/><path class="f" d="M10 14l-6.5 0.2l3 -5z"/>`);
  def('npn', { name: 'NPN 2N3904', cat: 'Semiconductor', prefix: 'Q', pins: [{ n: 'B', x: -3, y: 0 }, { n: 'C', x: 1, y: -3 }, { n: 'E', x: 1, y: 3 }],
    props: { beta: '150' }, meta: { beta: { label: 'Gain (hFE)', kind: 'si' } }, labels: { ref: [24, -4], val: [24, 8] }, val: () => '2N3904', draw: bjt(false), fp: () => FP.to92([2, 0, 1]) });
  def('pnp', { name: 'PNP 2N3906', cat: 'Semiconductor', prefix: 'Q', pins: [{ n: 'B', x: -3, y: 0 }, { n: 'E', x: 1, y: -3 }, { n: 'C', x: 1, y: 3 }],
    props: { beta: '150' }, meta: { beta: { label: 'Gain (hFE)', kind: 'si' } }, labels: { ref: [24, -4], val: [24, 8] }, val: () => '2N3906', draw: bjt(true), fp: () => FP.to92([1, 0, 2]) });
  const mos = (p) => () => `<path class="s" d="M-30 0H-9M-9 -10V10"/><path class="s w" d="M-4 -13V-5M-4 -3V3M-4 5V13"/><path class="s" d="M-4 -9H10V-30M-4 9H10V30M10 9V0H-4"/>` +
    (p ? `<path class="f" d="M5 0l-5 -3.5v7z"/>` : `<path class="f" d="M-3 0l5 -3.5v7z"/>`);
  def('nmos', { name: 'N-MOSFET 2N7000', cat: 'Semiconductor', prefix: 'Q', pins: [{ n: 'G', x: -3, y: 0 }, { n: 'D', x: 1, y: -3 }, { n: 'S', x: 1, y: 3 }],
    props: { vth: '2.1' }, meta: { vth: { label: 'Threshold', unit: 'V', kind: 'si' } }, labels: { ref: [22, -4], val: [22, 8] }, val: () => '2N7000', draw: mos(false), fp: () => FP.to92([2, 0, 1]) });
  def('pmos', { name: 'P-MOSFET BS250', cat: 'Semiconductor', prefix: 'Q', pins: [{ n: 'G', x: -3, y: 0 }, { n: 'S', x: 1, y: -3 }, { n: 'D', x: 1, y: 3 }],
    props: { vth: '2.1' }, meta: { vth: { label: 'Threshold', unit: 'V', kind: 'si' } }, labels: { ref: [22, -4], val: [22, 8] }, val: () => 'BS250', draw: mos(true), fp: () => FP.to92([1, 0, 2]) });

  /* Sources */
  def('dcsource', { name: 'DC Supply', cat: 'Sources', prefix: 'V', pins: V2, props: { voltage: '5' }, meta: { voltage: { label: 'Voltage', unit: 'V', kind: 'si' } },
    labels: { ref: [18, -4], val: [18, 9] }, val: c => c.props.voltage + 'V',
    draw: () => `<path class="s" d="M0 -30V-13M0 13V30"/><circle class="b" r="13"/><path class="s" d="M-4 -5h8M0 -9v8M-4 6h8"/>`, fp: () => FP.terminal2() });
  def('battery', { name: 'Battery', cat: 'Sources', prefix: 'BT', pins: V2, props: { voltage: '9' }, meta: { voltage: { label: 'Voltage', unit: 'V', kind: 'si' } },
    labels: { ref: [18, -4], val: [18, 9] }, val: c => c.props.voltage + 'V',
    draw: () => `<path class="s" d="M0 -30V-7M0 7V30"/><path class="s w" d="M-12 -7H12M-12 3H12"/><path class="s w2" d="M-6 -3H6M-6 7H6"/><path class="s" d="M8 -15h6M11 -18v6"/>`, fp: () => FP.terminal2() });
  def('acsource', { name: 'AC Source', cat: 'Sources', prefix: 'V', pins: V2, props: { amplitude: '5', frequency: '50', offset: '0' },
    meta: { amplitude: { label: 'Amplitude (peak)', unit: 'V', kind: 'si' }, frequency: { label: 'Frequency', unit: 'Hz', kind: 'si' }, offset: { label: 'DC offset', unit: 'V', kind: 'si' } },
    labels: { ref: [18, -4], val: [18, 9] }, val: c => `${c.props.amplitude}V ${c.props.frequency}Hz`,
    draw: () => `<path class="s" d="M0 -30V-13M0 13V30"/><circle class="b" r="13"/><path class="s" d="M-8 0C-6 -9 -2 -9 0 0S6 9 8 0"/>`, fp: () => FP.terminal2() });
  def('funcgen', { name: 'Function Generator', cat: 'Sources', prefix: 'FG', pins: V2,
    props: { waveform: 'square', frequency: '1k', amplitude: '2.5', offset: '2.5', duty: 0.5 },
    meta: { waveform: { label: 'Waveform', kind: 'select', options: ['square', 'sine', 'triangle', 'sawtooth'] }, frequency: { label: 'Frequency', unit: 'Hz', kind: 'si' },
      amplitude: { label: 'Amplitude', unit: 'V', kind: 'si' }, offset: { label: 'Offset', unit: 'V', kind: 'si' }, duty: { label: 'Duty cycle', kind: 'range', live: true } },
    labels: { ref: [20, -4], val: [20, 9] }, val: c => `${c.props.waveform} ${c.props.frequency}Hz`,
    draw: () => `<path class="s" d="M0 -30V-12M0 12V30"/><rect class="b" x="-13" y="-12" width="26" height="24" rx="2"/><path class="s" d="M-8 4V-4H-2V4H4V-4H8"/>`, fp: () => FP.terminal2() });
  def('isource', { name: 'Current Source', cat: 'Sources', prefix: 'I', pins: V2, props: { current: '10m' }, meta: { current: { label: 'Current', unit: 'A', kind: 'si' } },
    labels: { ref: [18, -4], val: [18, 9] }, val: c => c.props.current + 'A',
    draw: () => `<path class="s" d="M0 -30V-13M0 13V30"/><circle class="b" r="13"/><path class="s" d="M0 7V-6"/><path class="f" d="M0 -8l-4 6h8z"/>`, fp: () => FP.terminal2() });
  def('ground', { name: 'Ground', cat: 'Sources', prefix: '#GND', pins: [{ n: 'GND', x: 0, y: 0 }], labels: { ref: null, val: null }, virtual: true, net: () => 'GND',
    draw: () => `<path class="s" d="M0 0V8M-10 8H10M-6 12H6M-2 16H2"/>`, fp: null });
  def('vcc', { name: 'Power Port', cat: 'Sources', prefix: '#PWR', pins: [{ n: 'P', x: 0, y: 0 }], props: { net: '5V' }, meta: { net: { label: 'Net name', kind: 'text' } },
    labels: { ref: null, val: [0, -16] }, virtual: true, net: c => c.props.net, val: c => c.props.net,
    draw: () => `<path class="s" d="M0 0V-8M-8 -8H8"/>`, fp: null });
  def('noconnect', { name: 'No Connect', cat: 'Sources', prefix: '#NC', pins: [{ n: 'NC', x: 0, y: 0 }], labels: { ref: null, val: null }, virtual: true,
    draw: () => `<path class="s" d="M-4 -4L4 4M4 -4L-4 4"/>`, fp: null });
  def('netlabel', { name: 'Net Label', cat: 'Sources', prefix: '#LBL', pins: [{ n: 'L', x: 0, y: 0 }], props: { name: 'NET1' }, meta: { name: { label: 'Net name', kind: 'text' } },
    labels: { ref: null, val: null }, virtual: true, net: c => c.props.name,
    selfOriented: true,
    draw: c => { const w = Math.max(20, c.props.name.length * 6.2 + 12), r = (c.rot || 0) % 4;
      if (r === 2) return `<path class="b" d="M0 0L-5 -5.5H${-w}V5.5H-5Z"/>` + T(-w / 2 - 4, 3, c.props.name, 'lbl');
      if (r === 1 || r === 3) { const d = r === 1 ? 1 : -1; return `<path class="b" d="M0 0L-7 ${6 * d}V${(w) * d}H7V${6 * d}Z"/>` + `<text class="lbl" text-anchor="middle" transform="translate(3.5 ${(w / 2 + 4) * d}) rotate(-90)">${c.props.name}</text>`; }
      return `<path class="b" d="M0 0L5 -5.5H${w}V5.5H5Z"/>` + T(w / 2 + 4, 3, c.props.name, 'lbl'); }, fp: null });

  /* ICs */
  def('opamp', { name: 'Op-Amp LM358', cat: 'Integrated', prefix: 'U', pins: [{ n: '−', x: -3, y: -1 }, { n: '+', x: -3, y: 1 }, { n: 'OUT', x: 3, y: 0 }, { n: 'V+', x: 0, y: -2 }, { n: 'V−', x: 0, y: 2 }],
    props: { gain: '100k' }, meta: { gain: { label: 'Open-loop gain', kind: 'si' } }, labels: { ref: [18, -16], val: [18, 22] }, val: () => 'LM358',
    draw: () => `<path class="s" d="M-30 -10H-20M-30 10H-20M20 0H30M0 -12.5V-20M0 12.5V20"/><path class="b" d="M-20 -25L-20 25L20 0Z"/><path class="s" d="M-16 -10h6M-16 10h6M-13 7v6"/>`,
    fp: () => FP.dip(8, { 1: 2, 2: 0, 3: 1, 4: 4, 8: 3 }) });
  def('reg7805', { name: 'Regulator 78xx', cat: 'Integrated', prefix: 'U', pins: [{ n: 'IN', x: -3, y: 0 }, { n: 'OUT', x: 3, y: 0 }, { n: 'GND', x: 0, y: 2 }],
    props: { vout: '5' }, meta: { vout: { label: 'Output voltage', unit: 'V', kind: 'si' } }, labels: { ref: [0, -17], val: [0, 30] }, val: c => '78' + String(c.props.vout).padStart(2, '0'),
    draw: c => `<path class="s" d="M-30 0H-20M20 0H30M0 12V20"/><rect class="b" x="-20" y="-12" width="40" height="24" rx="1.5"/>` + T(0, -2, 'IN  OUT', 'pinlbl') + T(0, 9, 'GND', 'pinlbl'),
    fp: () => FP.to220([0, 2, 1]) });
  const gateIn = `<path class="s" d="M-30 -10H-18M-30 10H-18"/>`;
  const gates = {
    and: `<path class="b" d="M-20 -15H0A15 15 0 0 1 0 15H-20Z"/>`,
    or: `<path class="b" d="M-22 -15Q-12 0 -22 15Q4 15 17 0Q4 -15 -22 -15Z"/>`,
    xor: `<path class="b" d="M-18 -15Q-8 0 -18 15Q6 15 17 0Q6 -15 -18 -15Z"/><path class="s" d="M-24 -15Q-14 0 -24 15"/>`
  };
  const gateDef = (t, name, shape, bubble) => def(t, { name, cat: 'Logic', prefix: 'U', pins: [{ n: 'A', x: -3, y: -1 }, { n: 'B', x: -3, y: 1 }, { n: 'Y', x: 3, y: 0 }],
    labels: { ref: [0, -20], val: [0, 26] }, val: () => ({ and: '74HC08', nand: '74HC00', or: '74HC32', nor: '74HC02', xor: '74HC86' })[t],
    draw: () => gateIn + gates[shape] + (bubble ? `<circle class="b" cx="${shape === 'and' ? 18 : 20}" cy="0" r="3"/><path class="s" d="M${shape === 'and' ? 21 : 23} 0H30"/>` : `<path class="s" d="M${shape === 'and' ? 15 : 17} 0H30"/>`),
    fp: () => FP.dip(14, { 1: 0, 2: 1, 3: 2 }, { 7: 'GND', 14: 'VCC' }) });
  gateDef('and', 'AND Gate', 'and', false); gateDef('nand', 'NAND Gate', 'and', true); gateDef('or', 'OR Gate', 'or', false); gateDef('nor', 'NOR Gate', 'or', true); gateDef('xor', 'XOR Gate', 'xor', false);
  def('not', { name: 'NOT Gate', cat: 'Logic', prefix: 'U', pins: [{ n: 'A', x: -3, y: 0 }, { n: 'Y', x: 3, y: 0 }], labels: { ref: [0, -18], val: [0, 24] }, val: () => '74HC04',
    draw: () => `<path class="s" d="M-30 0H-15M16 0H30"/><path class="b" d="M-15 -12L-15 12L10 0Z"/><circle class="b" cx="13" cy="0" r="3"/>`,
    fp: () => FP.dip(14, { 1: 0, 2: 1 }, { 7: 'GND', 14: 'VCC' }) });
  const SEGS = { a: 'M-6 -30L8 -30L6 -26L-4 -26Z', b: 'M9 -29L10 -3L7 -5L6 -25Z', c: 'M10 3L11 29L8 26L7 5Z', d: 'M-5 26L5 26L7 30L-7 30Z',
    e: 'M-9 3L-6 5L-6 25L-9 28Z', f: 'M-10 -28L-7 -25L-7 -5L-10 -3Z', g: 'M-6 -2L6 -2L8 0L6 2L-6 2L-8 0Z' };
  def('sevenseg', { name: '7-Segment Display', cat: 'Output', prefix: 'DS', pins: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].map((n, i) => ({ n, x: -3, y: -4 + i })).concat([{ n: 'COM', x: 0, y: 6 }]),
    props: { color: 'red', type: 'common cathode' }, meta: { color: { label: 'Colour', kind: 'select', options: Object.keys(LED_COLORS) }, type: { label: 'Type', kind: 'select', options: ['common cathode', 'common anode'] } },
    labels: { ref: [0, -58], val: [26, 66] }, val: c => c.props.type === 'common anode' ? 'CA' : 'CC',
    draw: (c, st) => { const col = (LED_COLORS[c.props.color] || LED_COLORS.red).hex; let s = `<path class="s" d="${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `M-30 ${-40 + i * 10}H-20`).join('')}M0 50V60"/><rect class="b dark" x="-20" y="-50" width="40" height="100" rx="2"/>`;
      Object.keys(SEGS).forEach((k, i) => { const on = st && st.segs && st.segs[i] > 0.05; s += `<path d="${SEGS[k]}" transform="translate(3 0)" style="fill:${on ? col : 'var(--seg-off)'};opacity:${on ? 0.35 + 0.65 * Math.min(1, st.segs[i]) : 1}"/>`; });
      const dpOn = st && st.segs && st.segs[7] > 0.05; s += `<circle cx="16" cy="29" r="2.4" style="fill:${dpOn ? col : 'var(--seg-off)'}"/>`;
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].forEach((n, i) => { s += T(-16, -37.5 + i * 10, n, 'pinlbl l', 'start'); });
      return s + T(0, 46, 'COM', 'pinlbl l'); },
    fp: () => FP.sevenseg() });
  const MCU_PINS = ['5V', 'GND', 'A0', 'A1', 'A2', 'A3', 'D2', 'D3', 'D4', 'D5'].map((n, i) => ({ n, x: -6, y: -5 + i }))
    .concat(['D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'].map((n, i) => ({ n, x: 6, y: -5 + i })), [{ n: 'GND', x: 6, y: 4 }]);
  CL.MCU_PINS = MCU_PINS;
  def('mcu', { name: 'MCU Board ATmega328P', cat: 'Microcontroller', prefix: 'U', pins: MCU_PINS, props: { code: '' }, meta: {},
    labels: { ref: [0, -73], val: [0, 66] }, val: () => 'ATmega328P · 16 MHz',
    draw: (c, st) => { let s = `<path class="s" d="${MCU_PINS.map(p => p.x < 0 ? `M-60 ${p.y * 10}H-40` : `M60 ${p.y * 10}H40`).join('')}"/><rect class="b mcu" x="-40" y="-65" width="80" height="120" rx="3"/>`;
      MCU_PINS.forEach(p => { const hi = st && st.pins && st.pins[p.n] && st.pins[p.n].out; s += T(p.x < 0 ? -36 : 36, p.y * 10 + 3.2, p.n, 'pinlbl' + (hi ? ' hi' : ''), p.x < 0 ? 'start' : 'end'); });
      s += `<rect class="icbody" x="-12" y="-14" width="24" height="24" rx="1"/>` + T(0, -1, '328P', 'chiplbl') + T(0, 6, 'AVR', 'chiplbl');
      const led = st && st.pins && st.pins.D13 && st.pins.D13.v > 2.5; s += `<rect x="18" y="-58" width="8" height="5" rx="1" style="fill:${led ? '#ffb020' : 'var(--seg-off)'}"/>` + T(22, -47, 'L', 'pinlbl');
      s += `<circle cx="-28" cy="-55" r="3" class="b"/>` + T(0, -54, 'MCU', 'chiplbl b2');
      if (st && st.error) s += T(0, 30, 'ERROR', 'pinlbl bad');
      else if (st && st.running) s += T(0, 30, 'RUN', 'pinlbl ok');
      return s; },
    fp: () => FP.mcuboard() });

  /* Input / Output */
  def('switch', { name: 'Toggle Switch', cat: 'Input', prefix: 'SW', pins: H2, props: { closed: false }, meta: { closed: { label: 'Closed', kind: 'bool', live: true } },
    val: c => c.props.closed ? 'ON' : 'OFF', interactive: 'toggle',
    draw: c => `<path class="s" d="M-30 0H-12M12 0H30"/><circle class="b" cx="-12" r="2.5"/><circle class="b" cx="12" r="2.5"/><path class="s w" d="M-10 -1L${c.props.closed ? '10 -1' : '10 -12'}"/>`,
    fp: () => FP.slide() });
  def('button', { name: 'Push Button', cat: 'Input', prefix: 'SW', pins: H2, props: { pressed: false }, meta: {}, interactive: 'momentary', val: () => 'tactile',
    draw: c => { const y = c.props.pressed ? -3 : -9; return `<path class="s" d="M-30 0H-12M12 0H30"/><circle class="b" cx="-12" r="2.5"/><circle class="b" cx="12" r="2.5"/><path class="s w" d="M-14 ${y}H14M0 ${y}V${y - 8}M-6 ${y - 8}H6"/>`; },
    fp: () => FP.tact() });
  def('lamp', { name: 'Lamp', cat: 'Output', prefix: 'LA', pins: H2, props: { resistance: '30' }, meta: { resistance: { label: 'Resistance', unit: 'Ω', kind: 'si' } },
    val: c => c.props.resistance + 'Ω',
    draw: (c, st) => glowDef(0, 0, 16, '#ffcf4a', st ? st.bright : 0) + `<path class="s" d="M-30 0H-12M12 0H30"/><circle class="b" r="12"/><path class="s" d="M-8.5 -8.5L8.5 8.5M8.5 -8.5L-8.5 8.5"/>`, fp: () => FP.terminal2() });
  def('motor', { name: 'DC Motor', cat: 'Output', prefix: 'M', pins: H2, props: { resistance: '20' }, meta: { resistance: { label: 'Winding resistance', unit: 'Ω', kind: 'si' } },
    val: c => c.props.resistance + 'Ω',
    draw: (c, st) => { const a = st ? st.angle || 0 : 0; return `<path class="s" d="M-30 0H-13M13 0H30"/><circle class="b" r="13"/>` + T(0, 4.5, 'M', 'mlbl') +
      `<g transform="rotate(${(a * 57.3).toFixed(1)})"><path class="s acc" d="M0 -17V-13M0 13V17M-17 0H-13M13 0H17" /></g>`; }, fp: () => FP.terminal2() });
  def('buzzer', { name: 'Buzzer', cat: 'Output', prefix: 'BZ', pins: H2, props: { resistance: '40' }, meta: { resistance: { label: 'Coil resistance', unit: 'Ω', kind: 'si' } },
    val: () => 'piezo', labels: { ref: [0, -20], val: [0, 20] },
    draw: (c, st) => `<path class="s" d="M-30 0H-12M12 0H30"/><path class="b" d="M-12 0A12 12 0 0 1 12 0Z"/><path class="s" d="M-5 -5H5"/>` +
      (st && st.on ? `<path class="s acc" d="M15 -10q4 -4 0 -8M19 -8q6 -6 0 -12M-15 -10q-4 -4 0 -8"/>` : ''), fp: () => FP.buzzer() });

  /* Instruments */
  def('voltmeter', { name: 'Voltmeter', cat: 'Instruments', prefix: 'VM', pins: V2, labels: { ref: [18, -4], val: null }, virtual: true,
    draw: (c, st) => `<path class="s" d="M0 -30V-13M0 13V30"/><circle class="b inst" r="13"/>` + T(0, 4, 'V', 'mlbl') + (st ? T(18, 10, CL.formatSI(st.v, 'V'), 'reading', 'start') : ''), fp: null });
  def('ammeter', { name: 'Ammeter', cat: 'Instruments', prefix: 'AM', pins: H2, labels: { ref: [0, -18], val: null },
    draw: (c, st) => `<path class="s" d="M-30 0H-13M13 0H30"/><circle class="b inst" r="13"/>` + T(0, 4, 'A', 'mlbl') + (st ? T(0, 26, CL.formatSI(st.i, 'A'), 'reading') : ''), fp: () => FP.header(2) });
  def('probe', { name: 'Scope Probe', cat: 'Instruments', prefix: 'CH', pins: [{ n: 'P', x: 0, y: 0 }], props: { color: '#e8833a' }, meta: { color: { label: 'Trace colour', kind: 'select', options: ['#e8833a', '#2fb6c9', '#b67be0', '#7cc34a'] } },
    labels: { ref: [12, -25], val: null }, virtual: true,
    draw: c => `<path class="s" d="M0 0L7 -7"/><path d="M5 -9L13 -17L17 -13L9 -5Z" style="fill:${c.props.color}" class="probe"/>`, fp: null });

  /* Connectors */
  const hdr = n => def('header' + n, { name: `Pin Header 1×${n}`, cat: 'Connector', prefix: 'J', pins: Array.from({ length: n }, (_, i) => ({ n: String(i + 1), x: -2, y: i })),
    labels: { ref: [-6, -12], val: [-6, n * 10 + 4] }, val: () => `Conn_1x${n}`,
    draw: () => `<path class="s" d="${Array.from({ length: n }, (_, i) => `M-20 ${i * 10}H-10`).join('')}"/><rect class="b" x="-10" y="-6" width="10" height="${n * 10 + 2}"/>` + Array.from({ length: n }, (_, i) => `<rect class="f" x="-6.5" y="${i * 10 - 1.5}" width="3" height="3"/>`).join(''),
    fp: () => FP.header(n) });
  hdr(2); hdr(4); hdr(6);

  /* ===================== extended library ===================== */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /* generic rectangular IC / module symbol */
  function icBox(o) {
    const Lp = o.left || [], Rp = o.right || [], n = Math.max(Lp.length, Rp.length, 1), hw = o.hw || 3;
    const top = -Math.floor((n - 1) / 2);
    const pins = Lp.map((nm, i) => ({ n: nm, x: -(hw + 2), y: top + i })).concat(Rp.map((nm, i) => ({ n: nm, x: hw + 2, y: top + i })));
    const y0 = (top - 1) * 10 - (o.title ? 6 : 0), y1 = (top + n) * 10 - 4;
    const base = (c, st, hi) => `<path class="s" d="${pins.map(p => `M${p.x * 10} ${p.y * 10}H${p.x < 0 ? -hw * 10 : hw * 10}`).join('')}"/>` +
      `<rect class="b" x="${-hw * 10}" y="${y0}" width="${hw * 20}" height="${y1 - y0}" rx="2"/>` +
      pins.map(p => T(p.x < 0 ? -hw * 10 + 3 : hw * 10 - 3, p.y * 10 + 2.2, p.n, 'pinlbl' + (hi && hi(p.n) ? ' hi' : ''), p.x < 0 ? 'start' : 'end')).join('') +
      (o.title ? T(0, y0 + 9, o.title, 'pinlbl b3') : '');
    return { pins, base, box: [-(hw + 2) * 10 - 2, y0 - 2, (hw + 2) * 10 + 2, y1 + 2], labels: { ref: [0, y0 - 6], val: [0, y1 + 12] }, y0, y1, hw, top, n };
  }
  CL.icBox = icBox;

  /* --- footprints for the extended library --- */
  FP.board = function (B, pins) {
    const f = B.footprint, alias = f.alias || {};
    const idx = name => { if (!name) return -1; const nm = alias[name] || name; return pins.findIndex(p => p.n === nm); };
    const total = f.cols.reduce((s, c) => s + c.names.length, 0);
    const pads = []; let num = 1;
    f.cols.forEach((col, ci) => {
      const n = col.names.length;
      col.names.forEach((name, i) => {
        if (name === '') return;
        const y = (i - (n - 1) / 2) * 2.54;
        const pn = f.dip ? (ci === 0 ? i + 1 : total - i) : num++;
        pads.push(P(pn, idx(name), col.x, y, pn === 1 ? 'rect' : 'oval', 1.7, 1.7, 1.0));
      });
    });
    const xs = pads.map(p => p.x), ys = pads.map(p => p.y);
    const ow = f.outline ? f.outline[0] : Math.max(...xs) - Math.min(...xs) + 3, oh = f.outline ? f.outline[1] : Math.max(...ys) - Math.min(...ys) + 3;
    let silk, body = Object.assign({}, B.body);
    if (B.chipOnly) {
      const h = oh; silk = [{ t: 'l', pts: [[-1, -h / 2], [-2.6, -h / 2], [-2.6, h / 2], [2.6, h / 2], [2.6, -h / 2], [1, -h / 2]] }, { t: 'arc', x: 0, y: -h / 2, r: 1, a0: 0, a1: Math.PI }];
      body = { kind: 'dip', n: pads.length, l: h - 0.4, w: 6.4 };
      return { name: f.name, pads, silk, body, size: [10, h + 1] };
    }
    silk = [silkRect(ow, oh), { t: 'l', pts: [[-ow / 2 + 1, -oh / 2 + 2.5], [-ow / 2 + 2.5, -oh / 2 + 1]] }];
    return { name: f.name, pads, silk, body, size: [ow + 0.6, oh + 0.6] };
  };
  FP.inline = (name, n, pitch, map, body, size, padW = 1.7, drill = 1.0) => {
    const pads = []; for (let i = 0; i < n; i++) pads.push(P(i + 1, map ? map[i] : i, (i - (n - 1) / 2) * pitch, 0, i === 0 ? 'rect' : 'oval', padW, padW * 1.15, drill));
    const w = size ? size[0] : n * pitch + 1, h = size ? size[1] : 3;
    return { name, pads, silk: [silkRect(w, h)], body, size: [w + 0.5, h + 0.5] };
  };
  FP.vheader = (name, n, map, body, size) => {
    const pads = []; for (let i = 0; i < n; i++) pads.push(P(i + 1, map ? map[i] : i, (i - (n - 1) / 2) * 2.54, 0, i === 0 ? 'rect' : 'oval', 1.7, 1.7, 1.0));
    const sz = size || [n * 2.54 + 0.5, 3];
    return { name, pads, silk: [silkRect(sz[0] - 0.5, sz[1] - 0.5)], body, size: sz };
  };
  FP.sot223 = map => ({ name: 'SOT-223-3_TabPin2', smd: true,
    pads: [P(1, map[0], -2.3, 3.15, 'rect', 1.2, 2.0), P(2, map[1], 0, 3.15, 'rect', 1.2, 2.0), P(3, map[2], 2.3, 3.15, 'rect', 1.2, 2.0), P(4, map[3], 0, -3.15, 'rect', 3.4, 2.0)],
    silk: [silkRect(7, 3.8)], body: { kind: 'sot223' }, size: [7.5, 8.5] });
  FP.relay = map => ({ name: 'Relay_SPDT_THT_5pin',
    pads: [P(1, map[0], -8, 0, 'rect', 2.2, 2.2, 1.2), P(2, map[1], -6, -6, 'circle', 2.2, 2.2, 1.2), P(3, map[2], -6, 6, 'circle', 2.2, 2.2, 1.2), P(4, map[3], 6, -6, 'circle', 2.2, 2.2, 1.2), P(5, map[4], 6, 6, 'circle', 2.2, 2.2, 1.2)],
    silk: [silkRect(19.4, 15.8)], body: { kind: 'relay' }, size: [20, 16.5] });
  FP.lcd = map => {
    const pads = map.map((m, i) => P(i + 1, m, -36, (i - 1.5) * 2.54, i === 0 ? 'rect' : 'oval', 1.7, 1.7, 1.0));
    [[-37.5, -15.5], [37.5, -15.5], [-37.5, 15.5], [37.5, 15.5]].forEach(([x, y], i) => pads.push(P(5 + i, -1, x, y, 'circle', 5, 5, 3.2)));
    return { name: 'LCD_1602_I2C_Module', pads, silk: [silkRect(80, 36), silkRect(64.5, 14)], body: { kind: 'lcd' }, size: [81, 37] };
  };
  FP.l298n = map => {
    const pads = [];
    const term = (num, pin, x, y) => pads.push(P(num, pin, x, y, num === 1 ? 'rect' : 'circle', 2.6, 2.6, 1.3));
    term(1, map.OUT1, -18, -2.54); term(2, map.OUT2, -18, 2.54); term(3, map.OUT3, 18, -2.54); term(4, map.OUT4, 18, 2.54);
    term(5, map.VS, -5.08, 18); term(6, map.GND, 0, 18); term(7, map['5V'], 5.08, 18);
    ['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'].forEach((n, i) => pads.push(P(8 + i, map[n], -6.35 + i * 2.54, 11.5, 'oval', 1.7, 1.7, 1.0)));
    return { name: 'Module_L298N_43x43mm', pads, silk: [silkRect(43, 43)], body: { kind: 'l298n' }, size: [43.5, 43.5] };
  };

  /* --- transistor models --- */
  const BJT_MODELS = {
    npn: { '2N3904': { beta: 150, to92: [2, 0, 1] }, '2N2222': { beta: 200, to92: [2, 0, 1] }, 'BC547': { beta: 300, to92: [1, 0, 2] }, 'TIP120': { beta: 1000, n: 2, to220: [0, 1, 2] } },
    pnp: { '2N3906': { beta: 150, to92: [1, 0, 2] }, 'BC557': { beta: 300, to92: [2, 0, 1] }, 'TIP125': { beta: 1000, n: 2, to220: [0, 2, 1] } }
  };
  const MOS_MODELS = {
    nmos: { '2N7000': { vth: 2.1, k: 0.25, to92: [2, 0, 1] }, 'IRLZ44N': { vth: 1.5, k: 30, to220: [0, 1, 2] }, 'IRF540N': { vth: 3.5, k: 20, to220: [0, 1, 2] } },
    pmos: { 'BS250': { vth: 2.1, k: 0.25, to92: [1, 0, 2] }, 'IRF9540N': { vth: 3.0, k: 10, to220: [0, 2, 1] } }
  };
  CL.BJT_MODELS = BJT_MODELS; CL.MOS_MODELS = MOS_MODELS;
  const trFp = m => (m.to220 ? FP.to220(m.to220) : FP.to92(m.to92));
  [['npn', 'NPN transistor', '2N3904', false], ['pnp', 'PNP transistor', '2N3906', true]].forEach(([t, nm, dflt, p]) => {
    const M = BJT_MODELS[t];
    Object.assign(D[t], { name: nm, props: { model: dflt, beta: String(M[dflt].beta) },
      meta: { model: { label: 'Part', kind: 'select', options: Object.keys(M), apply: (pr, v) => { pr.beta = String(M[v].beta); } }, beta: { label: 'Gain (hFE)', kind: 'si' } },
      val: c => c.props.model || dflt, fp: c => trFp(M[c.props.model] || M[dflt]) });
  });
  [['nmos', 'N-channel MOSFET', '2N7000'], ['pmos', 'P-channel MOSFET', 'BS250']].forEach(([t, nm, dflt]) => {
    const M = MOS_MODELS[t];
    Object.assign(D[t], { name: nm, props: { model: dflt, vth: String(M[dflt].vth) },
      meta: { model: { label: 'Part', kind: 'select', options: Object.keys(M), apply: (pr, v) => { pr.vth = String(M[v].vth); } }, vth: { label: 'Threshold', unit: 'V', kind: 'si' } },
      val: c => c.props.model || dflt, fp: c => trFp(M[c.props.model] || M[dflt]) });
  });

  /* --- microcontroller boards from the registry --- */
  Object.assign(D.mcu, { name: 'Mini AVR board', board: 'mcu', box: [-62, -70, 62, 58] });
  CL.BOARD_LIST.filter(B => !B.legacy).forEach(B => {
    const n = Math.max(B.left.length, B.right.length), hw = B.symW || 4, top = -Math.floor((n - 1) / 2), px = hw + 2;
    const pins = B.left.map((nm, i) => ({ n: nm, x: -px, y: top + i })).concat(B.right.map((nm, i) => ({ n: nm, x: px, y: top + i })));
    const y0 = (top - 3) * 10, y1 = (top + n) * 10 + 8, mid = (top + (n - 1) / 2) * 10;
    def(B.type, { name: B.name, cat: 'Microcontroller', prefix: 'U', pins, props: { code: '' }, meta: {}, board: B.type,
      box: [-px * 10 - 2, y0 - 2, px * 10 + 2, y1 + 2], labels: { ref: [0, y0 - 6], val: [0, y1 + 12] }, val: () => `${B.chip} · ${B.clock}`,
      draw: (c, st) => {
        let s = `<path class="s" d="${pins.map(p => `M${p.x * 10} ${p.y * 10}H${p.x < 0 ? -hw * 10 : hw * 10}`).join('')}"/>`;
        s += `<rect class="b mcu" x="${-hw * 10}" y="${y0}" width="${hw * 20}" height="${y1 - y0}" rx="3"/>`;
        s += `<path d="M${-hw * 10 + 3} ${y0}H${hw * 10 - 3}A3 3 0 0 1 ${hw * 10} ${y0 + 3}V${y0 + 15}H${-hw * 10}V${y0 + 3}A3 3 0 0 1 ${-hw * 10 + 3} ${y0}Z" style="fill:${B.color}"/>`;
        s += T(0, y0 + 10.5, B.chipOnly ? B.name : B.short, 'brdlbl');
        if (B.led) { const on = st && st.ledOn; s += `<rect x="${hw * 10 - 13}" y="${y0 + 19}" width="8" height="4.5" rx="1" style="fill:${on ? '#ffb020' : 'var(--seg-off)'}"/>` + T(hw * 10 - 9, y0 + 30, 'L', 'pinlbl'); }
        if (!B.chipOnly) s += `<circle cx="${-hw * 10 + 9}" cy="${y0 + 22}" r="3" class="b"/>`;
        pins.forEach(p => { const ps = st && st.pins && st.pins[p.n]; s += T(p.x < 0 ? -hw * 10 + 3 : hw * 10 - 3, p.y * 10 + 2.2, p.n, 'pinlbl' + (ps && ps.out ? ' hi' : ''), p.x < 0 ? 'start' : 'end'); });
        s += `<rect class="icbody" x="-12" y="${mid - 12}" width="24" height="24" rx="1"/>` + T(0, mid + 2, B.chipShort || B.short, 'chiplbl');
        const sy = y1 - 5;
        if (st && st.unpowered) s += T(0, sy, 'NO POWER', 'pinlbl bad');
        else if (st && st.error) s += T(0, sy, 'ERROR', 'pinlbl bad');
        else if (st && st.running) s += T(0, sy, 'RUN', 'pinlbl ok');
        return s;
      },
      fp: () => FP.board(B, pins) });
  });

  /* --- integrated circuits --- */
  {
    const ic = icBox({ left: ['VCC', 'RST', 'TRIG', 'THR'], right: ['OUT', 'DIS', 'CTRL', 'GND'], hw: 3, title: 'NE555' });
    def('ne555', { name: '555 Timer', cat: 'Integrated', prefix: 'U', pins: ic.pins, box: ic.box, labels: ic.labels, val: () => 'NE555',
      draw: (c, st) => ic.base(c, st, n => n === 'OUT' && st && st.q), fp: () => FP.dip(8, { 1: 7, 2: 2, 3: 4, 4: 1, 5: 6, 6: 3, 7: 5, 8: 0 }) });
  }
  def('lm393', { name: 'Comparator LM393', cat: 'Integrated', prefix: 'U', pins: [{ n: '−', x: -3, y: -1 }, { n: '+', x: -3, y: 1 }, { n: 'OUT', x: 3, y: 0 }, { n: 'V+', x: 0, y: -2 }, { n: 'GND', x: 0, y: 2 }],
    labels: { ref: [18, -16], val: [18, 22] }, val: () => 'LM393',
    draw: (c, st) => `<path class="s" d="M-30 -10H-20M-30 10H-20M20 0H30M0 -12.5V-20M0 12.5V20"/><path class="b" d="M-20 -25L-20 25L20 0Z"/><path class="s" d="M-16 -10h6M-16 10h6M-13 7v6"/><path class="s" d="M2 -3h6l-3 5z"/>` + (st && st.low ? `<circle cx="24" cy="-6" r="2" class="f"/>` : ''),
    fp: () => FP.dip(8, { 1: 2, 2: 0, 3: 1, 4: 4, 8: 3 }) });
  def('lm317', { name: 'Adjustable Regulator LM317', cat: 'Integrated', prefix: 'U', pins: [{ n: 'IN', x: -3, y: 0 }, { n: 'OUT', x: 3, y: 0 }, { n: 'ADJ', x: 0, y: 2 }],
    labels: { ref: [0, -17], val: [0, 30] }, val: () => 'LM317',
    draw: () => `<path class="s" d="M-30 0H-20M20 0H30M0 12V20"/><rect class="b" x="-20" y="-12" width="40" height="24" rx="1.5"/>` + T(0, -2, 'IN  OUT', 'pinlbl') + T(0, 9, 'ADJ', 'pinlbl'),
    fp: () => FP.to220([2, 1, 0]) });
  def('ams1117', { name: 'LDO Regulator AMS1117', cat: 'Integrated', prefix: 'U', pins: [{ n: 'IN', x: -3, y: 0 }, { n: 'OUT', x: 3, y: 0 }, { n: 'GND', x: 0, y: 2 }],
    props: { vout: '3.3' }, meta: { vout: { label: 'Output', unit: 'V', kind: 'select', options: ['1.8', '2.5', '3.3', '5.0'] } },
    labels: { ref: [0, -17], val: [0, 30] }, val: c => 'AMS1117-' + c.props.vout,
    draw: () => `<path class="s" d="M-30 0H-20M20 0H30M0 12V20"/><rect class="b" x="-20" y="-12" width="40" height="24" rx="1.5"/>` + T(0, -2, 'IN  OUT', 'pinlbl') + T(0, 9, 'GND', 'pinlbl'),
    fp: () => FP.sot223([2, 1, 0, 1]) });
  {
    const ic = icBox({ left: ['VS', 'GND', '5V', 'ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'], right: ['OUT1', 'OUT2', 'OUT3', 'OUT4'], hw: 4, title: 'L298N' });
    const idx = {}; ic.pins.forEach((p, i) => { idx[p.n] = i; });
    def('l298n', { name: 'Motor Driver L298N', cat: 'Integrated', prefix: 'U', pins: ic.pins, box: ic.box, labels: ic.labels, val: () => 'L298N dual H-bridge',
      draw: (c, st) => ic.base(c, st, n => st && st.on && st.on[n]) + `<path class="s" d="M-14 ${ic.y1 - 18}h28M-14 ${ic.y1 - 14}h28M-14 ${ic.y1 - 10}h28"/>`,
      fp: () => FP.l298n(idx) });
  }

  /* --- logic --- */
  {
    const ic = icBox({ left: ['SER', 'SRCLK', 'RCLK', '/OE', '/SRCLR', 'VCC'], right: ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', "QH'", 'GND'], hw: 3, title: '595' });
    def('hc595', { name: 'Shift Register 74HC595', cat: 'Logic', prefix: 'U', pins: ic.pins, box: ic.box, labels: ic.labels, val: () => '74HC595',
      draw: (c, st) => ic.base(c, st, n => st && st.out && st.out[n]),
      fp: () => FP.dip(16, { 1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 6: 12, 7: 13, 8: 15, 9: 14, 10: 4, 11: 1, 12: 2, 13: 3, 14: 0, 15: 6, 16: 5 }) });
  }
  {
    const ic = icBox({ left: ['CLK', 'EN', 'RST', 'VDD'], right: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'CO', 'VSS'], hw: 3, title: '4017' });
    def('cd4017', { name: 'Decade Counter CD4017', cat: 'Logic', prefix: 'U', pins: ic.pins, box: ic.box, labels: ic.labels, val: () => 'CD4017',
      draw: (c, st) => ic.base(c, st, n => st && st.out && st.out[n]),
      fp: () => FP.dip(16, { 1: 9, 2: 5, 3: 4, 4: 6, 5: 10, 6: 11, 7: 7, 8: 15, 9: 12, 10: 8, 11: 13, 12: 14, 13: 1, 14: 0, 15: 2, 16: 3 }) });
  }

  /* --- passive / semiconductor additions --- */
  def('bridge', { name: 'Bridge Rectifier', cat: 'Semiconductor', prefix: 'D', pins: [{ n: '~1', x: -4, y: 0 }, { n: '~2', x: 4, y: 0 }, { n: '+', x: 0, y: -4 }, { n: '−', x: 0, y: 4 }],
    box: [-42, -42, 42, 42], labels: { ref: [26, -24], val: [26, 28] }, val: () => '2 A bridge',
    draw: () => {
      const d = (x1, y1, x2, y2) => { const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ux = (x2 - x1), uy = (y2 - y1), L = Math.hypot(ux, uy), ax = ux / L, ay = uy / L, px = -ay, py = ax;
        return `<path class="f" d="M${mx - ax * 4 + px * 4} ${my - ay * 4 + py * 4}L${mx - ax * 4 - px * 4} ${my - ay * 4 - py * 4}L${mx + ax * 4} ${my + ay * 4}Z"/><path class="s" d="M${mx + ax * 4 + px * 4} ${my + ay * 4 + py * 4}L${mx + ax * 4 - px * 4} ${my + ay * 4 - py * 4}"/>`; };
      return `<path class="s" d="M-40 0H-20M20 0H40M0 -40V-20M0 20V40M-20 0L0 -20L20 0L0 20Z"/>` + d(-20, 0, 0, -20) + d(20, 0, 0, -20) + d(0, 20, -20, 0) + d(0, 20, 20, 0);
    },
    fp: () => FP.inline('Diode_Bridge_Inline_P5.08mm', 4, 5.08, [2, 0, 1, 3], { kind: 'bridge' }, [20, 4], 2.0, 1.1) });
  def('rgbled', { name: 'RGB LED', cat: 'Semiconductor', prefix: 'D', pins: [{ n: 'R', x: -3, y: -1 }, { n: 'G', x: -3, y: 0 }, { n: 'B', x: -3, y: 1 }, { n: 'COM', x: 3, y: 0 }],
    props: { type: 'common cathode' }, meta: { type: { label: 'Type', kind: 'select', options: ['common cathode', 'common anode'] } },
    labels: { ref: [0, -20], val: [0, 26] }, val: c => (c.props.type === 'common anode' ? 'RGB CA' : 'RGB CC'),
    draw: (c, st) => {
      const b = st && st.rgb ? st.rgb : [0, 0, 0], ca = c.props.type === 'common anode', mx = Math.max(...b);
      const col = `rgb(${Math.round(255 * Math.min(1, b[0]))},${Math.round(255 * Math.min(1, b[1]))},${Math.round(255 * Math.min(1, b[2]))})`;
      let s = mx > 0.03 ? `<circle cx="0" cy="0" r="16" style="fill:${col}" opacity="${(0.2 + 0.6 * Math.min(1, mx)).toFixed(2)}" class="glow"/>` : '';
      s += `<path class="s" d="M-30 -10H-10M-30 0H-10M-30 10H-10M6 -10H12V10H6M12 0H30"/>`;
      [-10, 0, 10].forEach((y, i) => { const cl = ['#ff3b30', '#30d158', '#2f7bff'][i];
        s += ca ? `<path d="M6 ${y - 4}L6 ${y + 4}L-4 ${y}Z" style="fill:${b[i] > 0.05 ? cl : 'var(--sym-fill)'}" class="ledbody"/><path class="s" d="M6 ${y - 4}L6 ${y + 4}L-4 ${y}ZM-4 ${y - 4}V${y + 4}"/>`
          : `<path d="M-4 ${y - 4}L-4 ${y + 4}L6 ${y}Z" style="fill:${b[i] > 0.05 ? cl : 'var(--sym-fill)'}" class="ledbody"/><path class="s" d="M-4 ${y - 4}L-4 ${y + 4}L6 ${y}ZM6 ${y - 4}V${y + 4}"/>`; });
      return s;
    },
    fp: () => ({ name: 'LED_D5.0mm-4_RGB', pads: [P(1, 0, -1.905, 0, 'rect', 1.0, 1.8, 0.7), P(2, 3, -0.635, 0, 'oval', 1.0, 1.8, 0.7), P(3, 1, 0.635, 0, 'oval', 1.0, 1.8, 0.7), P(4, 2, 1.905, 0, 'oval', 1.0, 1.8, 0.7)],
      silk: [{ t: 'arc', x: 0, y: 0, r: 3.0, a0: 0.45, a1: 2 * Math.PI - 0.45 }, { t: 'l', pts: [[2.7, -1.3], [2.7, 1.3]] }], body: { kind: 'led', d: 5, h: 8.6, color: 'rgb' }, size: [6.5, 6.5] }) });

  /* --- sensors --- */
  const slider = (label, min, max, step, unit) => ({ label, kind: 'slider', min, max, step, unit, live: true });
  def('ldr', { name: 'Light Sensor (LDR)', cat: 'Sensors', prefix: 'R', pins: H2, props: { light: 50, dark: '1M', bright: '1k' }, labels: { ref: [0, -24], val: [0, 28], auto: true, vx: 22 },
    meta: { light: slider('Light level', 0, 100, 1, '%'), dark: { label: 'Dark resistance', unit: 'Ω', kind: 'si' }, bright: { label: 'Bright resistance', unit: 'Ω', kind: 'si' } },
    val: c => `LDR · ${Math.round(c.props.light)}% light`,
    draw: () => `<path class="s" d="M-30 0H-15l2.5 -5l5 10l5 -10l5 10l5 -10l5 10l2.5 -5H30"/><circle class="s" cx="0" cy="0" r="17"/><path class="s" d="M-20 -24l7 7M-13 -27l7 7"/><path class="f" d="M-13 -17l-1 -4.5l3.5 3.5zM-6 -20l-1 -4.5l3.5 3.5z"/>`,
    fp: () => ({ name: 'R_LDR_5mm_P3.4mm', pads: [P(1, 0, -1.7, 0, 'circle', 1.5, 1.5, 0.8), P(2, 1, 1.7, 0, 'circle', 1.5, 1.5, 0.8)], silk: [silkCircle(2.8)], body: { kind: 'ldr' }, size: [6, 6] }) });
  def('ntc', { name: 'Thermistor (NTC)', cat: 'Sensors', prefix: 'TH', pins: H2, props: { temperature: 25, r25: '10k', beta: '3950' },
    meta: { temperature: slider('Temperature', -20, 120, 0.5, '°C'), r25: { label: 'R at 25 °C', unit: 'Ω', kind: 'si' }, beta: { label: 'B constant', unit: 'K', kind: 'si' } },
    val: c => `${c.props.r25}Ω NTC · ${c.props.temperature}°C`,
    draw: () => `<path class="s" d="M-30 0H-14M14 0H30"/><rect class="b" x="-14" y="-6" width="28" height="12"/><path class="s" d="M-17 10L-9 10L13 -12"/>` + T(-16, -9, 't°', 'pinlbl', 'middle'),
    fp: () => ({ name: 'R_NTC_Disc_P2.54mm', pads: [P(1, 0, -1.27, 0, 'circle', 1.5, 1.5, 0.8), P(2, 1, 1.27, 0, 'circle', 1.5, 1.5, 0.8)], silk: [silkRect(4.2, 2.4)], body: { kind: 'ntc' }, size: [5, 3] }) });
  {
    const ic = icBox({ left: ['VCC', 'DATA', 'GND'], hw: 3, title: 'DHT22' });
    def('dht22', { name: 'Temp & Humidity DHT22', cat: 'Sensors', prefix: 'U', pins: ic.pins, box: ic.box, labels: ic.labels,
      props: { temperature: 24.5, humidity: 55 }, meta: { temperature: slider('Temperature', -40, 80, 0.5, '°C'), humidity: slider('Humidity', 0, 100, 1, '%') },
      val: c => `DHT22 · ${c.props.temperature}°C ${Math.round(c.props.humidity)}%`,
      draw: (c, st) => ic.base(c, st) + `<rect class="s" x="2" y="${ic.y0 + 13}" width="22" height="${ic.y1 - ic.y0 - 17}" rx="2"/>` + [0, 1, 2, 3].map(i => `<path class="s" d="M5 ${ic.y0 + 17 + i * 5}h16"/>`).join(''),
      fp: () => FP.vheader('DHT22_4pin_P2.54mm', 4, [0, 1, -1, 2], { kind: 'dht' }, [16, 8.5]) });
  }
  {
    const ic = icBox({ left: ['VCC', 'TRIG', 'ECHO', 'GND'], hw: 4, title: 'HC-SR04' });
    def('hcsr04', { name: 'Ultrasonic HC-SR04', cat: 'Sensors', prefix: 'U', pins: ic.pins, box: ic.box, labels: ic.labels,
      props: { distance: 100 }, meta: { distance: slider('Distance to object', 2, 450, 1, 'cm') },
      val: c => `HC-SR04 · ${Math.round(c.props.distance)} cm`,
      draw: (c, st) => ic.base(c, st) + `<circle class="s" cx="6" cy="${ic.y0 + 24}" r="7"/><circle class="s" cx="25" cy="${ic.y0 + 24}" r="7"/>` + (st && st.echo ? `<path class="s acc" d="M36 ${ic.y0 + 18}q5 6 0 12M40 ${ic.y0 + 15}q8 9 0 18"/>` : ''),
      fp: () => FP.vheader('HC-SR04_4pin_P2.54mm', 4, [0, 1, 2, 3], { kind: 'hcsr04' }, [12, 4]) });
  }
  {
    const ic = icBox({ left: ['VCC', 'OUT', 'GND'], hw: 3, title: 'PIR' });
    def('pir', { name: 'PIR Motion HC-SR501', cat: 'Sensors', prefix: 'U', pins: ic.pins, box: ic.box, labels: ic.labels, interactive: 'toggle', toggleProp: 'motion',
      props: { motion: false, hold: 2 }, meta: { motion: { label: 'Motion', kind: 'bool', live: true }, hold: slider('Hold time', 0.5, 10, 0.5, 's') },
      val: c => (c.props.motion ? 'HC-SR501 · motion' : 'HC-SR501 · idle'),
      draw: (c, st) => ic.base(c, st, n => n === 'OUT' && st && st.on) + `<path class="b" d="M2 ${ic.y1 - 4}A12 12 0 0 1 26 ${ic.y1 - 4}Z"/>` + (c.props.motion ? `<path class="s acc" d="M-6 ${ic.y0 + 14}q-4 4 0 8M-10 ${ic.y0 + 12}q-6 6 0 12"/>` : ''),
      fp: () => FP.vheader('PIR_HC-SR501_3pin', 3, [0, 1, 2], { kind: 'pir' }, [12, 4]) });
  }

  /* --- input / output additions --- */
  {
    const ic = icBox({ left: ['GND', '+5V', 'VRX', 'VRY', 'SW'], hw: 3, title: 'JOYSTICK' });
    def('joystick', { name: 'Joystick Module', cat: 'Input', prefix: 'J', pins: ic.pins, box: ic.box, labels: ic.labels, interactive: 'momentary',
      props: { x: 0.5, y: 0.5, pressed: false }, meta: { x: { label: 'X position', kind: 'range', live: true }, y: { label: 'Y position', kind: 'range', live: true } },
      val: () => 'KY-023',
      draw: c => { const cx = 14 + (c.props.x - 0.5) * 12, cy = (ic.y0 + ic.y1) / 2 + 4 - (c.props.y - 0.5) * 12;
        return ic.base(c) + `<circle class="s" cx="14" cy="${(ic.y0 + ic.y1) / 2 + 4}" r="10"/><circle cx="${cx}" cy="${cy}" r="${c.props.pressed ? 4 : 5}" class="f"/>`; },
      fp: () => FP.vheader('Joystick_KY-023_5pin', 5, [0, 1, 2, 3, 4], { kind: 'joystick' }, [26, 34]) });
  }
  def('relay', { name: 'Relay SPDT', cat: 'Output', prefix: 'K', pins: [{ n: 'A1', x: -4, y: -3 }, { n: 'A2', x: -4, y: 3 }, { n: 'COM', x: 2, y: 3 }, { n: 'NC', x: 0, y: -3 }, { n: 'NO', x: 4, y: -3 }],
    props: { coil: '5V' }, meta: { coil: { label: 'Coil voltage', kind: 'select', options: ['5V', '12V'] } },
    box: [-52, -32, 46, 32], labels: { ref: [-4, -40], val: [-4, 44] }, val: c => `${c.props.coil} SPDT`,
    draw: (c, st) => { const on = st && st.on; const tip = on ? '38 -9' : '2 -9';
      return `<path class="s" d="M-40 -30V-12M-40 12V30M20 30V12M0 -30V-14M40 -30V-14M0 -14H-3M40 -14H43"/><rect class="b" x="-48" y="-12" width="16" height="24"/><path class="s" d="M-48 -8L-32 8"/>` +
        `<circle class="f" cx="20" cy="12" r="2.2"/><path class="s w" d="M20 12L${tip}"/><path class="s" d="M-32 0H${on ? 30 : 12}" stroke-dasharray="3 3"/>` + T(0, -20, 'NC', 'pinlbl') + T(40, -20, 'NO', 'pinlbl') + T(26, 26, 'COM', 'pinlbl', 'start'); },
    fp: () => FP.relay([2, 0, 1, 3, 4]) });
  def('servo', { name: 'Servo Motor SG90', cat: 'Output', prefix: 'M', pins: [{ n: 'SIG', x: -4, y: -1 }, { n: 'V+', x: -4, y: 0 }, { n: 'GND', x: -4, y: 1 }],
    box: [-42, -24, 34, 24], labels: { ref: [0, -30], val: [0, 34] }, val: c => 'SG90 servo',
    draw: (c, st) => { const a = st && st.angle != null ? st.angle : 90, r = (180 - a) * Math.PI / 180, hx = 12 + Math.cos(r) * 15, hy = -Math.sin(r) * 15;
      return `<path class="s" d="M-40 -10H-26M-40 0H-26M-40 10H-26"/><rect class="b" x="-26" y="-18" width="56" height="36" rx="3"/>` + T(-22, -7.8, 'SIG', 'pinlbl', 'start') + T(-22, 2.2, 'V+', 'pinlbl', 'start') + T(-22, 12.2, 'GND', 'pinlbl', 'start') +
        `<circle class="s" cx="12" cy="0" r="5"/><path class="s acc w" d="M12 0L${hx.toFixed(1)} ${hy.toFixed(1)}"/>` + T(12, 15, Math.round(a) + '°', 'pinlbl'); },
    fp: () => FP.vheader('Servo_Connector_1x3', 3, [2, 1, 0], { kind: 'servo' }, [33, 13]) });
  def('lcd_i2c', { name: 'LCD 16×2 (I²C)', cat: 'Output', prefix: 'DS', pins: [{ n: 'GND', x: -11, y: -2 }, { n: 'VCC', x: -11, y: -1 }, { n: 'SDA', x: -11, y: 0 }, { n: 'SCL', x: -11, y: 1 }],
    props: { address: '0x27' }, meta: { address: { label: 'I²C address', kind: 'select', options: ['0x27', '0x3F'] } },
    box: [-112, -38, 92, 30], labels: { ref: [-10, -44], val: [-10, 40] }, val: c => `1602 LCD · ${c.props.address}`,
    draw: (c, st) => {
      const lit = st && st.powered && st.backlight, on = st && st.powered;
      let s = `<path class="s" d="M-110 -20H-90M-110 -10H-90M-110 0H-90M-110 10H-90"/><rect class="b" x="-90" y="-34" width="180" height="60" rx="3"/>` +
        T(-86, -17.8, 'GND', 'pinlbl', 'start') + T(-86, -7.8, 'VCC', 'pinlbl', 'start') + T(-86, 2.2, 'SDA', 'pinlbl', 'start') + T(-86, 12.2, 'SCL', 'pinlbl', 'start');
      s += `<rect x="-62" y="-26" width="144" height="44" rx="2" style="fill:${lit ? '#9fd85a' : on ? '#5d7d36' : '#33402a'}"/>`;
      const lines = st && st.lines ? st.lines : null;
      if (lines) lines.slice(0, 2).forEach((ln, i) => { s += `<text x="10" y="${-6 + i * 17}" class="lcdtxt" text-anchor="middle" xml:space="preserve">${esc(ln)}</text>`; });
      return s;
    },
    fp: () => FP.lcd([0, 1, 2, 3]) });

  CL.DEFS = D;
  CL.CATEGORIES = ['Passive', 'Semiconductor', 'Sources', 'Integrated', 'Logic', 'Microcontroller', 'Input', 'Sensors', 'Output', 'Instruments', 'Connector'];

  /* label anchors in component space (already rotated), with text-anchor */
  CL.labelAnchors = function (c) {
    const d = D[c.type], L = d.labels || {}, out = [];
    const rot = (c.rot || 0) % 4;
    const put = (a, text, cls) => {
      if (!a || !text) return;
      const [ax, ay] = d.selfOriented ? a : CL.rotQ(a[0], a[1], rot);
      const ta = Math.abs(ax) > Math.abs(ay) + 2 ? (ax > 0 ? 'start' : 'end') : 'middle';
      out.push({ x: ax, y: ay + 3, text, cls, ta });
    };
    const ref = c.ref.startsWith('#') ? null : c.ref, val = d.val ? d.val(c) : null;
    if (L.auto && rot % 2 === 1) {
      const ox = L.vx || (c.type === 'led' ? 21 : 13);
      if (ref) out.push({ x: ox, y: val ? -2 : 3, text: ref, cls: 'ref', ta: 'start' });
      if (val) out.push({ x: ox, y: ref ? 9 : 3, text: val, cls: 'val', ta: 'start' });
      return out;
    }
    put(L.ref, ref, 'ref'); put(L.val, val, 'val');
    return out;
  };
  CL.pinPos = function (c, i) {
    const p = D[c.type].pins[i];
    const [x, y] = CL.rotQ(p.x, p.y, c.rot || 0);
    return [c.x + x, c.y + y];
  };
  CL.footprint = function (c) {
    const d = D[c.type];
    if (!d.fp) return null;
    return d.fp(c);
  };
  /* world transform of a footprint-local point (mm) */
  CL.fpXform = function (c, x, y) {
    const pc = c.pcb;
    if (pc.side === 'B') x = -x;
    const [rx, ry] = CL.rotQ(x, y, pc.rot || 0);
    return [pc.x + rx, pc.y + ry];
  };
  CL.newComponent = function (type, x, y, existing) {
    const d = D[type];
    const used = new Set(existing.map(c => c.ref));
    let n = 1; while (used.has(d.prefix + n)) n++;
    const props = JSON.parse(JSON.stringify(d.props || {}));
    if (d.board) props.code = CL.SKETCHES ? CL.SKETCHES.blink.code : '';
    return { id: CL.uid('c'), type, ref: d.prefix + n, x, y, rot: 0, props };
  };
})(typeof window !== 'undefined' ? window : globalThis);
