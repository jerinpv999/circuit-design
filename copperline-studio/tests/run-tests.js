#!/usr/bin/env node
/* Copperline engine tests — run with:  node tests/run-tests.js
 * Covers the simulator and device models, every microcontroller board, the sketch runtime and libraries,
 * the autorouter, DRC, ERC and exporters, and the behaviour of every example project.
 * No browser or packages needed: the engine modules are plain scripts that attach to globalThis.CL. */
const path = require('path');
for (const f of ['core', 'boards', 'parts', 'netlist', 'sim', 'mcu', 'pcb', 'export', 'examples']) require(path.join(__dirname, '..', 'src', f + '.js'));
const CL = globalThis.CL;

let pass = 0, fail = 0;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== '' ? '  -> ' + detail : '')); } }
let seq = 0;
const C = (type, x, y, props = {}, rot = 0) => { const c = CL.newComponent(type, x, y, []); Object.assign(c.props, props); c.rot = rot; c.ref += '_' + (seq++); return c; };
const project = (components, wires = []) => ({ name: 'test', components, wires: wires.map((pts, i) => ({ id: 'w' + i, pts })), board: CL.defaultBoard(), sim: { dt: 1e-4 } });
function run(p, T, dt = 1e-4, each) { let out = ''; const s = new CL.Sim(p, { dt, serial: (r, t) => (out += t) }); const n = Math.round(T / dt); for (let i = 0; i < n; i++) { if (!s.step()) break; if (each) each(s, i); } const r = s.readAll(); s.out = out; return { s, r, out }; }
/* label-based mini builder for tests */
function kit() {
  const comps = [];
  const add = (type, x, y, props, rot) => { const c = C(type, x, y, props, rot); comps.push(c); return c; };
  const pin = (c, name) => { const d = CL.DEFS[c.type]; const i = d.pins.findIndex(p => p.n === name); if (i < 0) throw new Error(c.type + ' has no pin ' + name); return CL.pinPos(c, i); };
  const net = (c, name, n) => { const [x, y] = pin(c, name); comps.push(n === 'GND' ? C('ground', x, y) : C('netlabel', x, y, { name: n })); };
  return { comps, add, net, p: () => project(comps) };
}

console.log('\nSimulator and device models');
{ const b = C('battery', 0, 0), r = C('resistor', 3, -3, { resistance: '1k' }), l = C('led', 9, -3), g = C('ground', 0, 3);
  const { r: rd } = run(project([b, r, l, g], [[[12, -3], [12, 3], [0, 3]]]), 0.02);
  check('red LED forward voltage ≈ 1.8 V', near(rd[l.id].v, 1.8, 0.1), rd[l.id].v);
  check('LED current ≈ (9 − Vf)/1k', near(rd[l.id].i, (9 - rd[l.id].v) / 1000, 1e-4), rd[l.id].i); }
{ const v = C('dcsource', 0, 0, { voltage: '5' }), r = C('resistor', 3, -3, { resistance: '1k' }), c = C('capacitor', 9, -3, { capacitance: '1u' }), g = C('ground', 0, 3);
  const { r: rd } = run(project([v, r, c, g], [[[12, -3], [12, 3], [0, 3]]]), 1e-3, 1e-5);
  check('RC reaches 63 % after one τ', near(rd[c.id].v, 5 * (1 - Math.exp(-1)), 0.05), rd[c.id].v); }
{ const v = C('dcsource', 0, 0), rb = C('resistor', 3, -3, { resistance: '10k' }), q = C('npn', 9, -3), rc = C('resistor', 10, -9, { resistance: '100' }, 1), g = C('ground', 0, 3);
  const { r: rd } = run(project([v, rb, q, rc, g], [[[0, -3], [0, -12], [10, -12]], [[10, 0], [10, 3], [0, 3]]]), 1e-3);
  check('NPN saturates (Vce < 0.3 V)', rd[q.id].v < 0.3, rd[q.id].v);
  check('NPN Vbe ≈ 0.7 V', near(rd[q.id].vbe, 0.72, 0.08), rd[q.id].vbe); }
{ const v = C('dcsource', 0, 0), rb = C('resistor', 3, -3, { resistance: '10k' }), q = C('npn', 9, -3, { model: 'TIP120', beta: '1000' }), rc = C('resistor', 10, -9, { resistance: '100' }, 1), g = C('ground', 0, 3);
  const { r: rd } = run(project([v, rb, q, rc, g], [[[0, -3], [0, -12], [10, -12]], [[10, 0], [10, 3], [0, 3]]]), 1e-3);
  check('TIP120 Darlington Vbe ≈ 1.2–1.6 V', rd[q.id].vbe > 1.1 && rd[q.id].vbe < 1.7, rd[q.id].vbe); }
{ const b = C('battery', 0, 0, { voltage: '12' }), u = C('reg7805', 3, -3), rl = C('resistor', 9, 0, { resistance: '100' }, 1), g = C('ground', 0, 3);
  const { r: rd } = run(project([b, u, rl, g], [[[6, -3], [9, -3]], [[9, 3], [0, 3]], [[3, -1], [3, 3]]]), 1e-3);
  check('7805 output = 5.00 V', near(rd[u.id].v, 5, 0.01), rd[u.id].v); }
{ const k = kit(); const v = k.add('dcsource', 0, 0, { voltage: '5' }); k.net(v, '+', 'IN'); k.net(v, '−', 'GND');
  const u = k.add('ams1117', 10, 0); k.net(u, 'IN', 'IN'); k.net(u, 'OUT', 'OUT'); k.net(u, 'GND', 'GND');
  const r = k.add('resistor', 20, 0, { resistance: '33' }); k.net(r, '1', 'OUT'); k.net(r, '2', 'GND');
  const { r: rd } = run(k.p(), 2e-3); check('AMS1117-3.3 output = 3.30 V from 5 V', near(rd[u.id].v, 3.3, 0.01), rd[u.id].v); }
{ const k = kit(); const v = k.add('dcsource', 0, 0, { voltage: '12' }); k.net(v, '+', 'IN'); k.net(v, '−', 'GND');
  const u = k.add('lm317', 10, 0); k.net(u, 'IN', 'IN'); k.net(u, 'OUT', 'OUT'); k.net(u, 'ADJ', 'ADJ');
  const r1 = k.add('resistor', 20, 0, { resistance: '240' }); k.net(r1, '1', 'OUT'); k.net(r1, '2', 'ADJ');
  const r2 = k.add('resistor', 30, 0, { resistance: '720' }); k.net(r2, '1', 'ADJ'); k.net(r2, '2', 'GND');
  const { s } = run(k.p(), 2e-3); check('LM317 with 240 Ω / 720 Ω gives 5.0 V', near(s.nodeV('OUT'), 5.0, 0.03), s.nodeV('OUT')); }
{ const k = kit(); const v = k.add('dcsource', 0, 0, { voltage: '5' }); k.net(v, '+', 'V'); k.net(v, '−', 'GND');
  const n = k.add('ntc', 10, 0, { temperature: 25 }); k.net(n, '1', 'V'); k.net(n, '2', 'M');
  const r = k.add('resistor', 20, 0, { resistance: '10k' }); k.net(r, '1', 'M'); k.net(r, '2', 'GND');
  const { s } = run(k.p(), 1e-3); check('NTC is 10 kΩ at 25 °C (divider = 2.5 V)', near(s.nodeV('M'), 2.5, 0.01), s.nodeV('M'));
  n.props.temperature = 50; const t2 = run(k.p(), 1e-3); const r50 = 1e4 * Math.exp(3950 * (1 / 323.15 - 1 / 298.15));
  check('NTC follows the B equation at 50 °C', near(t2.s.nodeV('M'), 5 * 1e4 / (1e4 + r50), 0.01), t2.s.nodeV('M')); }
{ const k = kit(); const v = k.add('dcsource', 0, 0, { voltage: '5' }); k.net(v, '+', 'V'); k.net(v, '−', 'GND');
  const l = k.add('ldr', 10, 0, { light: 0 }); k.net(l, '1', 'V'); k.net(l, '2', 'M');
  const r = k.add('resistor', 20, 0, { resistance: '1M' }); k.net(r, '1', 'M'); k.net(r, '2', 'GND');
  const { s } = run(k.p(), 1e-3); check('LDR equals its dark resistance at 0 % light', near(s.nodeV('M'), 2.5, 0.01), s.nodeV('M')); }
{ const k = kit(); const v = k.add('dcsource', 0, 0, { voltage: '5' }); k.net(v, '+', 'V'); k.net(v, '−', 'GND');
  const sw = k.add('switch', 6, 0, { closed: true }); k.net(sw, '1', 'V'); k.net(sw, '2', 'COIL');
  const rl = k.add('relay', 14, 0, { coil: '5V' }); k.net(rl, 'A1', 'COIL'); k.net(rl, 'A2', 'GND'); k.net(rl, 'COM', 'V'); k.net(rl, 'NO', 'LOAD'); k.net(rl, 'NC', 'NCL');
  const la = k.add('lamp', 24, 0); k.net(la, '1', 'LOAD'); k.net(la, '2', 'GND');
  const r = k.add('resistor', 24, 8, { resistance: '1k' }); k.net(r, '1', 'NCL'); k.net(r, '2', 'GND');
  let res = run(k.p(), 0.01); check('relay pulls in at 5 V and closes NO', res.r[rl.id].on && res.s.nodeV('LOAD') > 4.9, res.s.nodeV('LOAD'));
  sw.props.closed = false; res = run(k.p(), 0.01); check('relay releases and closes NC', !res.r[rl.id].on && res.s.nodeV('NCL') > 4.9, res.s.nodeV('NCL')); }
{ // 555 astable: f = 1.44 / ((R1 + 2 R2) C)
  const k = kit(); const v = k.add('dcsource', -10, 0, { voltage: '9' }); k.net(v, '+', 'VCC'); k.net(v, '−', 'GND');
  const u = k.add('ne555', 0, 0); ['VCC', 'RST'].forEach(n => k.net(u, n, 'VCC')); k.net(u, 'TRIG', 'TH'); k.net(u, 'THR', 'TH'); k.net(u, 'DIS', 'DIS'); k.net(u, 'GND', 'GND'); k.net(u, 'OUT', 'OUT'); k.net(u, 'CTRL', 'CTL');
  const r1 = k.add('resistor', 20, 0, { resistance: '1k' }); k.net(r1, '1', 'VCC'); k.net(r1, '2', 'DIS');
  const r2 = k.add('resistor', 30, 0, { resistance: '10k' }); k.net(r2, '1', 'DIS'); k.net(r2, '2', 'TH');
  const c = k.add('capacitor', 40, 0, { capacitance: '10u' }); k.net(c, '1', 'TH'); k.net(c, '2', 'GND');
  const c2 = k.add('capacitor', 50, 0, { capacitance: '10n' }); k.net(c2, '1', 'CTL'); k.net(c2, '2', 'GND');
  const rises = []; let prev = 0;
  run(k.p(), 2.5, 1e-4, s => { const q = s.nodeV('OUT') > 4.5 ? 1 : 0; if (q && !prev) rises.push(s.t); prev = q; });
  const per = (rises[rises.length - 1] - rises[1]) / (rises.length - 2), f = 1 / per, fe = 1 / (Math.LN2 * (1e3 + 2e4) * 10e-6);
  check(`555 astable runs at ${fe.toFixed(2)} Hz (±2 %)`, near(f, fe, fe * 0.02), f.toFixed(3)); }
{ const k = kit(); const v = k.add('dcsource', 0, 0, { voltage: '5' }); k.net(v, '+', 'V'); k.net(v, '−', 'GND');
  const u = k.add('lm393', 10, 0); k.net(u, '+', 'P'); k.net(u, '−', 'N'); k.net(u, 'OUT', 'O'); k.net(u, 'V+', 'V'); k.net(u, 'GND', 'GND');
  const rp = k.add('resistor', 20, 0, { resistance: '10k' }); k.net(rp, '1', 'V'); k.net(rp, '2', 'O');
  const vp = k.add('dcsource', 30, 0, { voltage: '1' }); k.net(vp, '+', 'P'); k.net(vp, '−', 'GND');
  const vn = k.add('dcsource', 40, 0, { voltage: '2' }); k.net(vn, '+', 'N'); k.net(vn, '−', 'GND');
  let res = run(k.p(), 1e-3); check('LM393 sinks its open-collector output when + < −', res.s.nodeV('O') < 0.3, res.s.nodeV('O'));
  vp.props.voltage = '3'; res = run(k.p(), 1e-3); check('LM393 output pulled high when + > −', res.s.nodeV('O') > 4.9, res.s.nodeV('O')); }
{ const k = kit(); const v = k.add('acsource', 0, 0, { amplitude: '10', frequency: '50' }); k.net(v, '+', 'A'); k.net(v, '−', 'B');
  const br = k.add('bridge', 10, 0); k.net(br, '~1', 'A'); k.net(br, '~2', 'B'); k.net(br, '+', 'P'); k.net(br, '−', 'GND');
  const r = k.add('resistor', 20, 0, { resistance: '1k' }); k.net(r, '1', 'P'); k.net(r, '2', 'GND');
  let mn = 99, mx = -99; run(k.p(), 0.06, 1e-5, (s, i) => { if (s.t > 0.02) { mn = Math.min(mn, s.nodeV('P')); mx = Math.max(mx, s.nodeV('P')); } });
  check('bridge rectifier: output never negative, peaks near 10 − 2×Vf', mn > -0.05 && mx > 8 && mx < 9.2, `${mn.toFixed(2)}..${mx.toFixed(2)}`); }
{ const b = C('battery', 0, 0, { voltage: '9' }), r = C('resistor', 3, -3, { resistance: '1k' }), l = C('rgbled', 9, -2), g = C('ground', 0, 3);
  // only the red anode is driven; G and B are tied to COM
  const comps = [b, r, l, g];
  const { r: rd } = run(project(comps, [[[6, -3], [6, -3]], [[12, -2], [12, 3], [0, 3]], [[6, -2], [6, -1], [12, -1], [12, -2]]]), 0.05);
  check('RGB LED lights only the driven colour', rd[l.id].rgb[0] > 0.5 && rd[l.id].rgb[1] < 0.05 && rd[l.id].rgb[2] < 0.05, rd[l.id].rgb.map(x => x.toFixed(2)).join('/')); }

console.log('\nMicrocontroller boards');
const blinkTest = type => {
  const k = kit(); const u = k.add(type, 0, 0, { code: CL.SKETCHES.blink.code }); const B = CL.BOARDS[type];
  if (!B.selfPowered) { const v = k.add('dcsource', -20, 0, { voltage: '5' }); k.net(v, '+', 'VCC'); k.net(v, '−', 'GND'); k.net(u, 'VCC', 'VCC'); k.net(u, 'GND', 'GND'); }
  else { const g = CL.DEFS[type].pins.find(p => p.n === 'GND'); k.net(u, 'GND', 'GND'); }
  let toggles = 0, prev = null;
  const res = run(k.p(), 1.3, 1e-4, (s, i) => { if (i % 50) return; const r = s.readAll()[u.id]; const lv = B.led ? r.ledOn : r.pins.PB1 && r.pins.PB1.v > 2.5; if (prev !== null && lv !== prev) toggles++; prev = lv; });
  return { toggles, res, u };
};
for (const B of CL.BOARD_LIST) {
  const { toggles, res, u } = blinkTest(B.type);
  check(`${B.name}: Blink sketch toggles the LED`, toggles >= 2 && !res.r[u.id].error, `${toggles} toggles ${res.r[u.id].error || ''}`);
}
{ const k = kit(); const u = k.add('attiny85', 0, 0, { code: CL.SKETCHES.blink.code }); k.net(u, 'GND', 'GND');
  const sw = k.add('switch', -20, 0, { closed: false }); const v = k.add('dcsource', -30, 0, { voltage: '5' }); k.net(v, '+', 'BAT'); k.net(v, '−', 'GND'); k.net(sw, '1', 'BAT'); k.net(sw, '2', 'VCC'); k.net(u, 'VCC', 'VCC');
  const p = k.p(); let s = new CL.Sim(p, { dt: 1e-4 }); for (let i = 0; i < 2000; i++) s.step(); let r = s.readAll()[u.id];
  check('ATtiny85 stays off without a supply', r.unpowered && !r.running, JSON.stringify({ un: r.unpowered }));
  sw.props.closed = true; s.setProject(p); for (let i = 0; i < 8000; i++) s.step(); r = s.readAll()[u.id];
  check('ATtiny85 starts when VCC is switched on', !r.unpowered && r.running); }
{ const rt = new CL.McuRuntime('void setup(){ pinMode(34, OUTPUT); } void loop(){}', { read: () => 0, serial: () => {} }, CL.BOARDS.esp32_devkit); rt.tick(0);
  check('ESP32: GPIO34 is input-only', /input-only/.test(rt.error || ''), rt.error); }
{ const rt = new CL.McuRuntime('int v; void setup(){ v = analogRead(34); } void loop(){}', { read: () => 1.65, vdd: () => 3.3, serial: () => {} }, CL.BOARDS.esp32_devkit); rt.tick(0); rt.tick(0.001);
  check('ESP32: analogRead is 12-bit (1.65 V → 2048)', !rt.error && rt.gen && /v = /.test(rt.js), rt.error); }
{ let out = ''; const rt = new CL.McuRuntime('void setup(){ Serial.begin(9600); Serial.println(analogRead(A0)); analogReadResolution(12); Serial.println(analogRead(A0)); } void loop(){}', { read: () => 1.65, vdd: () => 3.3, serial: t => (out += t) }, CL.BOARDS.pi_pico); rt.tick(0);
  check('Pico: 10-bit by default, 12-bit after analogReadResolution', out.trim().split('\n').join(',') === '512,2048', out.trim()); }
{ const rt = new CL.McuRuntime('void setup(){ pinMode(7, OUTPUT); analogWrite(7, 200); } void loop(){}', { read: () => 0, serial: () => {} }, CL.BOARDS.arduino_uno); rt.tick(0);
  check('Uno: analogWrite on a non-PWM pin acts like digitalWrite', rt.pins.D7.pwm === null && rt.pins.D7.level === 1); }
{ const rt = new CL.McuRuntime('void setup(){ pinMode(9, OUTPUT); analogWrite(9, 64); } void loop(){}', { read: () => 0, serial: () => {} }, CL.BOARDS.arduino_uno); rt.tick(0);
  check('Uno: analogWrite on D9 produces 25 % PWM', near(rt.pins.D9.pwm, 64 / 255, 1e-6)); }
{ const rt = new CL.McuRuntime('void setup(){ attachInterrupt(digitalPinToInterrupt(7), setup, FALLING); } void loop(){}', { read: () => 5, serial: () => {} }, CL.BOARDS.arduino_uno); rt.tick(0);
  check('Uno: interrupts only on pins 2 and 3', /interrupt -1 does not exist/.test(rt.error || ''), rt.error); }
{ const rt = new CL.McuRuntime('void setup(){ pinMode(99, OUTPUT); } void loop(){}', { read: () => 0, serial: () => {} }); rt.tick(0);
  check('invalid pin reports a runtime error', /not available on the/.test(rt.error || ''), rt.error); }
{ const rt = new CL.McuRuntime('void setup( { }', { read: () => 0, serial: () => {} });
  check('syntax error reports a compile error', /Compile error/.test(rt.error || ''), rt.error); }
for (const [k, sk] of Object.entries(CL.SKETCHES)) {
  const B = sk.boards === 'any' ? CL.BOARDS.arduino_uno : CL.BOARDS[sk.boards[0]];
  const rt = new CL.McuRuntime(sk.code, { read: n => 2.5 * B.logic / 5, vdd: () => B.logic, serial: () => {}, dt: () => 1e-4 }, B);
  for (let t = 0; t < 1.5; t += 1e-4) rt.tick(t);
  check(`sketch "${sk.name}" runs on the ${B.name}`, !rt.error, rt.error);
}
{ // interrupt counter on a real circuit
  const k = kit(); const u = k.add('arduino_uno', 0, 0, { code: CL.SKETCHES.counter_isr.code }); k.net(u, 'GND', 'GND'); k.net(u, 'D2', 'BTN');
  const b = k.add('button', -20, 0); k.net(b, '1', 'BTN'); k.net(b, '2', 'GND');
  const p = k.p(); let out = ''; const s = new CL.Sim(p, { dt: 1e-4, serial: (r, t) => (out += t) });
  for (let n = 0; n < 3; n++) { for (let i = 0; i < 1000; i++) s.step(); b.props.pressed = true; s.setProject(p); for (let i = 0; i < 500; i++) s.step(); b.props.pressed = false; s.setProject(p); }
  for (let i = 0; i < 1000; i++) s.step();
  check('attachInterrupt counts three button presses', /presses: 3/.test(out) && !/presses: 4/.test(out), out.replace(/\n/g, ' | ')); }
{ // ultrasonic accuracy through pulseIn
  for (const d of [10, 57.5, 250]) {
    const ex = CL.EXAMPLES.parking.build(); ex.components.find(c => c.type === 'hcsr04').props.distance = d;
    const { out } = run(ex, 1.2);
    const vals = [...out.matchAll(/distance ([\d.]+)/g)].map(m => +m[1]);
    const v = vals[vals.length - 1];
    check(`HC-SR04 + pulseIn measures ${d} cm (±0.5 cm)`, near(v, d, 0.5), v);
  }
}

console.log('\nExamples: routing, DRC, ERC and behaviour');
for (const k of Object.keys(CL.EXAMPLES)) {
  const p = CL.EXAMPLES[k].build(); CL.autoPlace(p);
  const r = CL.autoroute(p); p.board.traces = r.traces; p.board.vias = r.vias;
  const nl = CL.buildNetlist(p), drc = CL.runDRC(p, nl);
  check(`${k}: autoroutes ${r.routed}/${r.total}`, r.routed === r.total);
  check(`${k}: DRC has no errors`, !drc.issues.some(i => i.sev === 'error'), drc.issues.filter(i => i.sev === 'error').map(i => i.msg).slice(0, 3).join('; '));
  check(`${k}: ERC is clean`, nl.warnings.length === 0, nl.warnings.map(w => w.msg).join('; '));
  if (k === 'traffic') {
    const files = CL.exportGerbers(p), names = Object.keys(files);
    check('Gerber set has copper, mask, silk, outline and drill', ['F_Cu.gtl', 'B_Cu.gbl', 'F_Mask.gts', 'F_Silkscreen.gto', 'Edge_Cuts.gm1', 'PTH.drl'].every(e => names.some(n => n.endsWith(e))), names.join(' '));
    check('every Gerber ends with M02', names.filter(n => !n.endsWith('.drl')).every(n => files[n].trim().endsWith('M02*')));
    const drl = files[names.find(n => n.endsWith('.drl'))];
    check('drill file is Excellon (M48 … M30)', /^M48/.test(drl) && /M30\s*$/.test(drl));
    check('BOM lists every footprinted part', CL.exportBOM(p).split('\n').length - 2 >= 5);
    check('KiCad netlist is an s-expression', /^\(export \(version "E"\)/.test(CL.exportKicadNet(p)));
    check('SPICE netlist ends with .end', /\.end\s*$/.test(CL.exportSpice(p)));
  }
}
{ const p = CL.EXAMPLES.chaser.build(); const leds = p.components.filter(c => c.type === 'led'); const lit = new Set();
  run(p, 4, 1e-4, (s, i) => { if (i % 100) return; const r = s.readAll(); leds.forEach((l, j) => { if (r[l.id].bright > 0.5) lit.add(j); }); });
  check('chaser: the 4017 walks through all 10 LEDs', lit.size === 10, [...lit].join(',')); }
{ const p = CL.EXAMPLES.parking.build(); p.components.find(c => c.type === 'hcsr04').props.distance = 20;
  const { r } = run(p, 2); const lcd = r[p.components.find(c => c.type === 'lcd_i2c').id], sv = r[p.components.find(c => c.type === 'servo').id], bz = p.components.find(c => c.type === 'buzzer');
  check('parking: LCD shows the 20 cm gap', /Gap: (19\.\d|20\.\d)/.test(lcd.lines[1]), JSON.stringify(lcd.lines));
  check('parking: servo raises the barrier to 90°', near(sv.angle, 90, 3), sv.angle.toFixed(1)); }
{ const p = CL.EXAMPLES.weather.build(); const { r } = run(p, 1.5); const lcd = r[p.components.find(c => c.type === 'lcd_i2c').id];
  check('weather: LCD shows DHT22 temperature and humidity', /T 24\.5C\s+H 55%/.test(lcd.lines[0]), JSON.stringify(lcd.lines));
  check('weather: LCD shows the light level', /Light \d+%/.test(lcd.lines[1]), JSON.stringify(lcd.lines)); }
{ const p = CL.EXAMPLES.weather.build(); const l = p.components.find(c => c.type === 'lcd_i2c'); l.props.address = '0x3F';
  const { out } = run(p, 0.5); check('weather: wrong I²C address is reported on Serial', /No device answered at 0x27/.test(out), out.slice(0, 120)); }
{ const p = CL.EXAMPLES.shiftbar.build(); const sr = p.components.find(c => c.type === 'hc595'); const seen = new Set();
  run(p, 2, 1e-4, (s, i) => { if (i % 200 === 0) seen.add(s.readAll()[sr.id].latch); });
  check('shiftbar: 74HC595 shows all 8 one-hot patterns', [1, 2, 4, 8, 16, 32, 64, 128].every(x => seen.has(x)), [...seen].join(',')); }
{ for (const [light, want] of [[5, 'bright'], [95, 'off']]) {
    const p = CL.EXAMPLES.nightlight.build(); p.components.find(c => c.type === 'ldr').props.light = light;
    const { r } = run(p, 0.6); const b = r[p.components.find(c => c.type === 'led').id].bright;
    check(`nightlight: LED is ${want} at ${light} % light`, want === 'bright' ? b > 0.6 : b < 0.05, b.toFixed(2)); } }
{ for (const [t, on] of [[15, true], [30, false]]) {
    const p = CL.EXAMPLES.thermostat.build(); p.components.find(c => c.type === 'ntc').props.temperature = t;
    const { r } = run(p, 1.2); const rl = r[p.components.find(c => c.type === 'relay').id], la = r[p.components.find(c => c.type === 'lamp').id];
    check(`thermostat: relay ${on ? 'on' : 'off'} at ${t} °C`, rl.on === on && (on ? la.bright > 0.5 : la.bright < 0.05), `${rl.on} lamp ${la.bright.toFixed(2)}`); } }
{ const p = CL.EXAMPLES.tank.build(); const ms = p.components.filter(c => c.type === 'motor'); let a = [0, 0], n = 0;
  run(p, 1, 1e-4, (s, i) => { if (i > 5000) { const r = s.readAll(); a[0] += r[ms[0].id].i; a[1] += r[ms[1].id].i; n++; } });
  check('tank: joystick forward drives both motors forward', a[0] / n > 0.1 && a[1] / n > 0.1, a.map(x => (x / n).toFixed(3)).join(' '));
  const p2 = CL.EXAMPLES.tank.build(); Object.assign(p2.components.find(c => c.type === 'joystick').props, { x: 1, y: 0.5 }); const ms2 = p2.components.filter(c => c.type === 'motor'); a = [0, 0]; n = 0;
  run(p2, 1, 1e-4, (s, i) => { if (i > 5000) { const r = s.readAll(); a[0] += r[ms2[0].id].i; a[1] += r[ms2[1].id].i; n++; } });
  check('tank: joystick right spins the motors in opposite directions', a[0] / n > 0.1 && a[1] / n < -0.1, a.map(x => (x / n).toFixed(3)).join(' ')); }

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
