/* Copperline example projects + automatic placement */
(function (G) {
  const CL = (G.CL = G.CL || {});

  CL.autoPlace = function (p, k = 1.7) {
    const items = p.components.filter(c => CL.DEFS[c.type].fp).map(c => {
      const fp = CL.footprint(c);
      const rot = (c.rot || 0) % 4;
      const odd = rot % 2 === 1;
      return { c, w: (odd ? fp.size[1] : fp.size[0]) + 2.2, h: (odd ? fp.size[0] : fp.size[1]) + 2.2, x: c.x * k, y: c.y * k, rot };
    });
    if (!items.length) return p;
    for (let it = 0; it < 400; it++) {
      let moved = false;
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox < oy) { const s = (a.x <= b.x ? -1 : 1) * ox / 2 * 1.02; a.x += s; b.x -= s; }
          else { const s = (a.y <= b.y ? -1 : 1) * oy / 2 * 1.02; a.y += s; b.y -= s; }
        }
      }
      if (!moved) break;
    }
    const minx = Math.min(...items.map(i => i.x - i.w / 2)), miny = Math.min(...items.map(i => i.y - i.h / 2));
    const maxx = Math.max(...items.map(i => i.x + i.w / 2)), maxy = Math.max(...items.map(i => i.y + i.h / 2));
    const m = 3;
    p.board.w = Math.ceil((maxx - minx + 2 * m) / 5) * 5;
    p.board.h = Math.ceil((maxy - miny + 2 * m + 3) / 5) * 5;
    const offx = (p.board.w - (maxx - minx)) / 2 - minx, offy = (p.board.h - 3 - (maxy - miny)) / 2 - miny;
    const snap = v => Math.round(v / 0.635) * 0.635;
    items.forEach(i => { i.c.pcb = { x: +snap(i.x + offx).toFixed(3), y: +snap(i.y + offy).toFixed(3), rot: i.rot, side: 'F' }; });
    return p;
  };

  function builder(name) {
    const p = { name, version: 1, components: [], wires: [], board: CL.defaultBoard(), sim: { dt: 1e-4, timebase: 0.5 } };
    const used = [];
    const add = (type, x, y, props = {}, rot = 0, ref) => {
      const c = CL.newComponent(type, x, y, p.components);
      Object.assign(c.props, props); c.rot = rot; if (ref) c.ref = ref;
      p.components.push(c); return c;
    };
    const w = (...pts) => { p.wires.push({ id: CL.uid('w'), pts }); };
    /* net label (or ground symbol) on a pin, pointing away from the part */
    const pinAt = (c, pinName, which = 0) => {
      const d = CL.DEFS[c.type]; let i = -1, cnt = 0;
      d.pins.forEach((pp, k) => { if (pp.n === pinName && i < 0) { if (cnt === which) i = k; cnt++; } });
      if (i < 0) throw new Error(`${c.ref} has no pin ${pinName}`);
      const [lx, ly] = CL.rotQ(d.pins[i].x, d.pins[i].y, d.selfOriented ? 0 : c.rot || 0);
      return { pos: CL.pinPos(c, i), dir: Math.abs(lx) >= Math.abs(ly) ? (lx < 0 ? 2 : 0) : (ly < 0 ? 3 : 1) };
    };
    const lbl = (c, pinName, net, which) => {
      const { pos, dir } = pinAt(c, pinName, which);
      if (net === 'GND' && dir === 1) return add('ground', pos[0], pos[1]);
      return add('netlabel', pos[0], pos[1], { name: net }, dir);
    };
    const nc = (c, pinName) => { const { pos } = pinAt(c, pinName); return add('noconnect', pos[0], pos[1]); };
    return { p, add, w, lbl, nc };
  }

  CL.EXAMPLES = {
    chaser: {
      name: '555 + 4017 LED chaser', desc: 'Classic 10-LED chaser: a 555 astable clocks a CD4017 decade counter',
      build() {
        const { p, add, w, lbl, nc } = builder('LED chaser');
        const bt = add('battery', -14, 0, { voltage: '9' }); lbl(bt, '+', 'VCC'); lbl(bt, '−', 'GND');
        const u1 = add('ne555', 0, 0, {}, 0, 'U1');
        lbl(u1, 'VCC', 'VCC'); lbl(u1, 'RST', 'VCC'); lbl(u1, 'TRIG', 'TH'); lbl(u1, 'THR', 'TH'); lbl(u1, 'OUT', 'CLK'); lbl(u1, 'DIS', 'DIS'); lbl(u1, 'CTRL', 'CTL'); lbl(u1, 'GND', 'GND');
        const r1 = add('resistor', 14, -9, { resistance: '1k' }, 1, 'R1'); lbl(r1, '1', 'VCC'); lbl(r1, '2', 'DIS');
        const r2 = add('resistor', 20, -9, { resistance: '22k' }, 1, 'R2'); lbl(r2, '1', 'DIS'); lbl(r2, '2', 'TH');
        const c1 = add('ecap', 26, -9, { capacitance: '10u' }, 1, 'C1'); lbl(c1, '+', 'TH'); lbl(c1, '−', 'GND');
        const c2 = add('capacitor', 32, -9, { capacitance: '10n' }, 1, 'C2'); lbl(c2, '1', 'CTL'); lbl(c2, '2', 'GND');
        const u2 = add('cd4017', 0, 18, {}, 0, 'U2');
        lbl(u2, 'CLK', 'CLK'); lbl(u2, 'EN', 'GND'); lbl(u2, 'RST', 'GND'); lbl(u2, 'VDD', 'VCC'); lbl(u2, 'VSS', 'GND'); nc(u2, 'CO');
        const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'white', 'blue', 'green', 'yellow', 'orange'];
        for (let i = 0; i < 10; i++) { const d = add('led', 14 + i * 6, 18, { color: colors[i] }, 1, 'D' + (i + 1)); lbl(u2, 'Q' + i, 'L' + i); lbl(d, 'A', 'L' + i); lbl(d, 'K', 'LK'); }
        const r3 = add('resistor', 14, 30, { resistance: '470' }, 1, 'R3'); lbl(r3, '1', 'LK'); lbl(r3, '2', 'GND');
        add('probe', 26, -12, { color: '#e8833a' }, 0, 'CH1');
        add('probe', 5, -1, { color: '#2fb6c9' }, 0, 'CH2');
        p.sim = { dt: 1e-4, timebase: 2 };
        return p;
      }
    },
    parking: {
      name: 'Parking sensor (Arduino Uno)', desc: 'HC-SR04 distance on a 16×2 I²C LCD, servo barrier and buzzer',
      build() {
        const { p, add, lbl } = builder('Parking sensor');
        const u = add('arduino_uno', 0, 0, { code: CL.SKETCHES.parking.code }, 0, 'U1');
        lbl(u, '5V', '5V'); lbl(u, 'GND', 'GND'); lbl(u, 'A4', 'SDA'); lbl(u, 'A5', 'SCL'); lbl(u, 'D6', 'GATE'); lbl(u, 'D8', 'BUZ'); lbl(u, 'D9', 'TRIG'); lbl(u, 'D10', 'ECHO');
        const s = add('hcsr04', 26, -6, { distance: 120 }, 0, 'U2'); lbl(s, 'VCC', '5V'); lbl(s, 'TRIG', 'TRIG'); lbl(s, 'ECHO', 'ECHO'); lbl(s, 'GND', 'GND');
        const m = add('servo', 26, 4, {}, 0, 'M1'); lbl(m, 'SIG', 'GATE'); lbl(m, 'V+', '5V'); lbl(m, 'GND', 'GND');
        const b = add('buzzer', 26, 12, { resistance: '1k' }, 0, 'BZ1'); lbl(b, '1', 'BUZ'); lbl(b, '2', 'GND');
        const l = add('lcd_i2c', -10, 16, {}, 0, 'DS1'); lbl(l, 'GND', 'GND'); lbl(l, 'VCC', '5V'); lbl(l, 'SDA', 'SDA'); lbl(l, 'SCL', 'SCL');
        add('probe', 22, 3, { color: '#e8833a' }, 0, 'CH1');
        add('probe', 20, -5, { color: '#2fb6c9' }, 0, 'CH2');
        p.sim = { dt: 1e-4, timebase: 0.05 };
        return p;
      }
    },
    weather: {
      name: 'Weather station (ESP32)', desc: 'DHT22 temperature and humidity plus a light sensor, shown on an I²C LCD',
      build() {
        const { p, add, lbl } = builder('ESP32 weather station');
        const u = add('esp32_devkit', 0, 0, { code: CL.SKETCHES.weather.code }, 0, 'U1');
        lbl(u, '3V3', '3V3'); lbl(u, 'VIN', 'VIN'); lbl(u, 'GND', 'GND'); lbl(u, 'IO34', 'LIGHT'); lbl(u, 'IO21', 'SDA'); lbl(u, 'IO22', 'SCL'); lbl(u, 'IO4', 'DHT');
        const d = add('dht22', 24, 6, {}, 0, 'U2'); lbl(d, 'VCC', '3V3'); lbl(d, 'DATA', 'DHT'); lbl(d, 'GND', 'GND');
        const rp = add('resistor', 26, -4, { resistance: '10k' }, 1, 'R1'); lbl(rp, '1', '3V3'); lbl(rp, '2', 'DHT');
        const ldr = add('ldr', -18, -6, { light: 60 }, 1, 'R2'); lbl(ldr, '1', '3V3'); lbl(ldr, '2', 'LIGHT');
        const r3 = add('resistor', -18, 4, { resistance: '10k' }, 1, 'R3'); lbl(r3, '1', 'LIGHT'); lbl(r3, '2', 'GND');
        const l = add('lcd_i2c', -4, 17, {}, 0, 'DS1'); lbl(l, 'GND', 'GND'); lbl(l, 'VCC', 'VIN'); lbl(l, 'SDA', 'SDA'); lbl(l, 'SCL', 'SCL');
        p.sim = { dt: 1e-4, timebase: 0.05 };
        return p;
      }
    },
    shiftbar: {
      name: 'Shift-register LED bar (Pico)', desc: 'Raspberry Pi Pico, 74HC595 and 8 LEDs, with an interrupt button',
      build() {
        const { p, add, lbl, nc } = builder('Pico LED bar');
        const u = add('pi_pico', 0, 0, { code: CL.SKETCHES.shiftbar.code }, 0, 'U1');
        lbl(u, '3V3', '3V3'); lbl(u, 'GND', 'GND'); lbl(u, 'GP2', 'SER'); lbl(u, 'GP3', 'SCK'); lbl(u, 'GP4', 'RCK'); lbl(u, 'GP15', 'BTN');
        const sr = add('hc595', 24, 0, {}, 0, 'U2');
        lbl(sr, 'SER', 'SER'); lbl(sr, 'SRCLK', 'SCK'); lbl(sr, 'RCLK', 'RCK'); lbl(sr, '/OE', 'GND'); lbl(sr, '/SRCLR', '3V3'); lbl(sr, 'VCC', '3V3'); lbl(sr, 'GND', 'GND'); nc(sr, "QH'");
        ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH'].forEach((q, i) => {
          lbl(sr, q, 'Q' + i);
          const x = 40 + i * 6;
          const d = add('led', x, -2, { color: i < 5 ? 'green' : i < 7 ? 'yellow' : 'red' }, 1, 'D' + (i + 1)); lbl(d, 'A', 'Q' + i);
          const r = add('resistor', x, 4, { resistance: '330' }, 1, 'R' + (i + 1)); lbl(r, '2', 'GND');
        });
        const b = add('button', -20, 6, {}, 0, 'SW1'); lbl(b, '1', 'BTN'); lbl(b, '2', 'GND');
        p.sim = { dt: 1e-4, timebase: 0.05 };
        return p;
      }
    },
    nightlight: {
      name: 'Night light (ATtiny85)', desc: 'Bare ATtiny85 on 5 V reads a light sensor and dims an LED with PWM',
      build() {
        const { p, add, lbl } = builder('ATtiny85 night light');
        const v = add('dcsource', -16, 0, { voltage: '5' }, 0, 'V1'); lbl(v, '+', 'VCC'); lbl(v, '−', 'GND');
        const c = add('capacitor', -10, 0, { capacitance: '100n' }, 1, 'C1'); lbl(c, '1', 'VCC'); lbl(c, '2', 'GND');
        const u = add('attiny85', 0, 0, { code: CL.SKETCHES.nightlight.code }, 0, 'U1'); lbl(u, 'VCC', 'VCC'); lbl(u, 'GND', 'GND'); lbl(u, 'PB2', 'SENSE');
        const ldr = add('ldr', 14, -9, { light: 20 }, 1, 'R1'); lbl(ldr, '1', 'VCC');
        add('netlabel', 14, -6, { name: 'SENSE' }, 0);
        const r2 = add('resistor', 14, -3, { resistance: '10k' }, 1, 'R2'); lbl(r2, '2', 'GND');
        add('resistor', 8, 2, { resistance: '220' }, 0, 'R3');
        const d = add('led', 14, 2, { color: 'yellow' }, 0, 'D1'); lbl(d, 'K', 'GND');
        p.sim = { dt: 1e-4, timebase: 0.05 };
        return p;
      }
    },
    thermostat: {
      name: 'Thermostat with relay (Nano)', desc: 'NTC thermistor, transistor-driven relay with flyback diode switching a 12 V lamp',
      build() {
        const { p, add, w, lbl, nc } = builder('Nano thermostat');
        const u = add('arduino_nano', 0, 0, { code: CL.SKETCHES.thermostat.code }, 0, 'U1');
        lbl(u, '5V', '5V'); lbl(u, 'GND', 'GND'); lbl(u, 'A0', 'TEMP');
        const th = add('ntc', -20, -7, { temperature: 18 }, 1, 'TH1'); lbl(th, '1', '5V');
        add('netlabel', -20, -4, { name: 'TEMP' }, 2);
        const r1 = add('resistor', -20, -1, { resistance: '10k' }, 1, 'R1'); lbl(r1, '2', 'GND');
        add('resistor', 9, 0, { resistance: '1k' }, 0, 'R2');
        const q = add('npn', 15, 0, { model: '2N2222', beta: '200' }, 0, 'Q1'); lbl(q, 'E', 'GND');
        const k = add('relay', 20, -6, { coil: '5V' }, 0, 'K1'); lbl(k, 'A1', '5V'); lbl(k, 'COM', 'V12'); nc(k, 'NC');
        add('diode', 12, -6, { model: '1N4007' }, 3, 'D1');
        w([12, -3], [16, -3]); w([12, -9], [16, -9]);
        const la = add('lamp', 27, -9, { resistance: '48' }, 0, 'LA1'); lbl(la, '2', 'GND');
        const bt = add('battery', 36, -6, { voltage: '12' }, 0, 'BT1'); lbl(bt, '+', 'V12'); lbl(bt, '−', 'GND');
        p.sim = { dt: 1e-4, timebase: 0.05 };
        return p;
      }
    },
    tank: {
      name: 'Joystick tank drive (Blue Pill)', desc: 'STM32 Blue Pill reads a joystick and drives two motors through an L298N',
      build() {
        const { p, add, lbl, nc } = builder('Blue Pill tank drive');
        const u = add('stm32_bluepill', 0, 0, { code: CL.SKETCHES.tank.code }, 0, 'U1');
        lbl(u, '3V3', '3V3'); lbl(u, 'GND', 'GND'); lbl(u, 'PA0', 'JY'); lbl(u, 'PA1', 'JX'); lbl(u, 'PA8', 'ENA'); lbl(u, 'PA9', 'ENB');
        lbl(u, 'PB12', 'IN1'); lbl(u, 'PB13', 'IN2'); lbl(u, 'PB14', 'IN3'); lbl(u, 'PB15', 'IN4');
        const j = add('joystick', -24, 4, { y: 0.85, x: 0.5 }, 0, 'J1'); lbl(j, 'GND', 'GND'); lbl(j, '+5V', '3V3'); lbl(j, 'VRX', 'JX'); lbl(j, 'VRY', 'JY'); nc(j, 'SW');
        const d = add('l298n', 28, 0, {}, 0, 'U2');
        lbl(d, 'VS', 'V12'); lbl(d, 'GND', 'GND'); nc(d, '5V'); ['ENA', 'IN1', 'IN2', 'IN3', 'IN4', 'ENB'].forEach(n => lbl(d, n, n));
        lbl(d, 'OUT1', 'M1A'); lbl(d, 'OUT2', 'M1B'); lbl(d, 'OUT3', 'M2A'); lbl(d, 'OUT4', 'M2B');
        const m1 = add('motor', 44, -6, { resistance: '20' }, 0, 'M1'); lbl(m1, '1', 'M1A'); lbl(m1, '2', 'M1B');
        const m2 = add('motor', 44, 4, { resistance: '20' }, 0, 'M2'); lbl(m2, '1', 'M2A'); lbl(m2, '2', 'M2B');
        const bt = add('battery', 18, 14, { voltage: '12' }, 0, 'BT1'); lbl(bt, '+', 'V12'); lbl(bt, '−', 'GND');
        add('probe', 22, -1, { color: '#e8833a' }, 0, 'CH1');
        add('probe', 34, -4, { color: '#2fb6c9' }, 0, 'CH2');
        p.sim = { dt: 1e-4, timebase: 0.02 };
        return p;
      }
    },
    traffic: {
      name: 'Junction controller', desc: 'MCU traffic light, push button, speed pot and a PWM fan driver',
      build() {
        const { p, add, w } = builder('Junction controller');
        const u = add('mcu', 0, 0, { code: CL.SKETCHES.traffic.code });
        add('ground', 6, 4);
        const cols = [[12, 2, 'green'], [20, 1, 'yellow'], [28, 0, 'red']];
        cols.forEach(([x, y, col]) => {
          w([6, y], [x, y], [x, 3]);
          add('resistor', x, 6, { resistance: '220' }, 1);
          add('led', x, 12, { color: col }, 1);
          add('ground', x, 15);
        });
        // pot on A0
        add('pot', -11, -5, { resistance: '10k', position: 0.45 });
        w([-11, -3], [-6, -3]); w([-8, -5], [-6, -5]);
        add('ground', -14, -5);
        // button on D2
        add('button', -9, 1);
        add('ground', -12, 1);
        // PWM fan driver on D9
        w([6, -2], [8, -2], [8, -10], [11, -10]);
        add('resistor', 14, -10, { resistance: '1k' });
        add('npn', 20, -10, {});
        add('ground', 21, -7);
        add('motor', 21, -16, { resistance: '25' }, 1);
        add('diode', 29, -16, { model: '1N4007' }, 3);
        w([21, -13], [29, -13]); w([21, -19], [29, -19], [37, -19]);
        add('battery', 37, -16, { voltage: '9' });
        w([37, -13], [37, -10]); add('ground', 37, -10);
        add('probe', 8, -2, { color: '#e8833a' }, 0, 'CH1');
        add('probe', 29, -13, { color: '#2fb6c9' }, 0, 'CH2');
        p.sim = { dt: 1e-4, timebase: 0.01 };
        return p;
      }
    },
    astable: {
      name: 'Astable multivibrator', desc: 'Two-transistor oscillator flashing two LEDs',
      build() {
        const { p, add, w } = builder('Astable multivibrator');
        add('battery', -4, 0, { voltage: '9' });
        w([-4, -3], [-4, -14], [24, -14]); add('ground', -4, 3);
        add('npn', 5, 6, {}, 0, 'Q1'); add('npn', 21, 6, {}, 0, 'Q2');
        add('resistor', 6, -8, { resistance: '470' }, 1, 'R1'); add('led', 6, 0, { color: 'red' }, 1, 'D1');
        w([6, -5], [6, -3]); w([6, -11], [6, -14]);
        add('resistor', 22, -8, { resistance: '470' }, 1, 'R4'); add('led', 22, 0, { color: 'green' }, 1, 'D2');
        w([22, -5], [22, -3]); w([22, -11], [22, -14]);
        add('resistor', 0, -8, { resistance: '47k' }, 1, 'R2'); w([0, -11], [0, -14]); w([0, -5], [0, 6], [2, 6]);
        add('resistor', 18, -8, { resistance: '39k' }, 1, 'R3'); w([18, -11], [18, -14]); w([18, -5], [18, 6]);
        add('ecap', 12, 3, { capacitance: '10u' }, 0, 'C1'); w([6, 3], [9, 3]); w([15, 3], [15, 6], [18, 6]);
        add('ecap', 12, 12, { capacitance: '10u' }, 2, 'C2'); w([22, 3], [25, 3], [25, 12], [15, 12]); w([9, 12], [-2, 12], [-2, 6], [0, 6]);
        add('ground', 6, 9); add('ground', 22, 9);
        add('probe', 9, 3, { color: '#e8833a' }, 0, 'CH1');
        add('probe', -2, 6, { color: '#2fb6c9' }, 0, 'CH2');
        p.sim = { dt: 2e-4, timebase: 2 };
        return p;
      }
    },
    opamp: {
      name: 'Inverting amplifier + filter', desc: 'Op-amp gain stage driven by a function generator, then an RC low-pass',
      build() {
        const { p, add, w } = builder('Inverting amplifier');
        add('funcgen', 0, 0, { waveform: 'square', frequency: '500', amplitude: '0.5', offset: '0' });
        add('ground', 0, 3);
        add('resistor', 3, -3, { resistance: '10k' }, 0, 'R1');
        add('opamp', 9, -2, {});
        w([6, -1], [6, 1]); add('ground', 6, 1);
        add('resistor', 9, -9, { resistance: '47k' }, 0, 'R2');
        w([6, -3], [6, -9]); w([12, -9], [12, -2]);
        add('vcc', 9, -4, { net: '+12V' });
        add('netlabel', 9, 0, { name: 'VEE' });
        add('dcsource', -8, -1, { voltage: '12' }); add('vcc', -8, -4, { net: '+12V' }); add('ground', -8, 2);
        add('dcsource', -15, -1, { voltage: '12' }, 2); add('ground', -15, 2); add('netlabel', -15, -4, { name: 'VEE' });
        add('resistor', 15, -2, { resistance: '1k' }, 0, 'R3');
        add('capacitor', 18, 1, { capacitance: '100n' }, 1, 'C1'); add('ground', 18, 4);
        add('probe', 0, -3, { color: '#e8833a' }, 0, 'CH1');
        add('probe', 12, -2, { color: '#2fb6c9' }, 0, 'CH2');
        add('probe', 18, -2, { color: '#b67be0' }, 0, 'CH3');
        p.sim = { dt: 5e-6, timebase: 0.005 };
        return p;
      }
    },
    adder: {
      name: 'Half adder', desc: 'XOR and AND gates with switch inputs and LED outputs',
      build() {
        const { p, add, w } = builder('Half adder');
        add('switch', 3, -4, { closed: true }, 0, 'SW1'); add('vcc', 0, -4, { net: '5V' });
        add('resistor', 6, -1, { resistance: '10k' }, 1); add('ground', 6, 2);
        add('switch', 3, 6, { closed: false }, 0, 'SW2'); add('vcc', 0, 6, { net: '5V' });
        add('resistor', 6, 9, { resistance: '10k' }, 1); add('ground', 6, 12);
        add('xor', 14, -3); add('and', 14, 5);
        w([6, -4], [11, -4]); w([8, -4], [8, 4], [11, 4]);
        w([6, 6], [11, 6]); w([9, 6], [9, -2], [11, -2]);
        add('resistor', 20, -3, { resistance: '330' }); add('led', 23, 0, { color: 'yellow' }, 1); add('ground', 23, 3);
        add('resistor', 20, 5, { resistance: '330' }); add('led', 23, 8, { color: 'blue' }, 1); add('ground', 23, 11);
        add('netlabel', 23, -3, { name: 'SUM' }); add('netlabel', 23, 5, { name: 'CARRY' });
        add('dcsource', -6, 2, { voltage: '5' }); add('vcc', -6, -1, { net: '5V' }); add('ground', -6, 5);
        p.sim = { dt: 1e-4, timebase: 0.05 };
        return p;
      }
    },
    sevenseg: {
      name: '7-segment counter', desc: 'MCU counting 0–9 on a common-cathode display',
      build() {
        const { p, add, w } = builder('7-segment counter');
        const u = add('mcu', 0, 0, { code: CL.SKETCHES.sevenseg.code });
        add('ground', 6, 4);
        add('sevenseg', 34, 0, { color: 'red' }, 0, 'DS1');
        add('ground', 34, 6);
        add('noconnect', 31, 3);
        const names = ['SEG_A', 'SEG_B', 'SEG_C', 'SEG_D', 'SEG_E', 'SEG_F', 'SEG_G'];
        [1, 2, 3, 4].forEach((y, i) => add('netlabel', -6, y, { name: names[i] }, 2));
        [-5, -4, -3].forEach((y, i) => add('netlabel', 6, y, { name: names[4 + i] }, 0));
        for (let s = 0; s < 7; s++) {
          const yr = -12 + 4 * s, yt = -4 + s;
          add('netlabel', 17, yr, { name: names[s] }, 2);
          add('resistor', 20, yr, { resistance: '330' }, 0, 'R' + (s + 1));
          const xv = s < 3 ? 29 - s : s > 3 ? 29 - (6 - s) : 26;
          w([23, yr], [xv, yr], [xv, yt], [31, yt]);
        }
        p.sim = { dt: 1e-4, timebase: 2 };
        return p;
      }
    }
  };

  CL.buildExample = function (key) {
    const ex = CL.EXAMPLES[key];
    const p = ex.build();
    CL.autoPlace(p);
    const r = CL.autoroute(p);
    p.board.traces = r.traces; p.board.vias = r.vias;
    return p;
  };
})(typeof window !== 'undefined' ? window : globalThis);
