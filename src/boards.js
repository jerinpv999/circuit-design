/* Copperline board registry: microcontroller boards and chips.
 * Each profile describes the schematic symbol (left/right pin lists), electrical behaviour
 * (logic level, supplies, ADC, PWM, pull-ups, interrupts) and PCB footprint/3D body. */
(function (G) {
  const CL = (G.CL = G.CL || {});
  const seq = (p, a, b, step = 1) => { const o = []; for (let i = a; step > 0 ? i <= b : i >= b; i += step) o.push(p + i); return o; };

  /* Arduino AVR numbering: 0..nD-1 -> Dn, then A0.. */
  const avrNames = (nD, nA, validD, validA) => n => {
    if (typeof n !== 'number' || !isFinite(n)) return null;
    n = Math.floor(n);
    if (n >= 0 && n < nD) return validD.includes('D' + n) ? 'D' + n : null;
    if (n >= nD && n < nD + nA) return validA.includes('A' + (n - nD)) ? 'A' + (n - nD) : null;
    return null;
  };
  const avrAnalog = (nD, nA, pinName) => n => (typeof n === 'number' && n >= 0 && n < nA ? 'A' + Math.floor(n) : pinName(n));
  const aConst = (nD, nA) => { const o = {}; for (let i = 0; i < nA; i++) o['A' + i] = nD + i; return o; };

  const BOARDS = {};
  const add = b => { b.gpioSet = new Set(b.gpio); b.pwmSet = b.pwm === 'all' ? null : new Set(b.pwm); b.adcSet = new Set(b.adc);
    b.inputOnlySet = new Set(b.inputOnly || []); b.noDigitalSet = new Set(b.noDigital || []); b.dacSet = new Set(b.dac || []);
    b.hasPwm = name => (b.pwmSet ? b.pwmSet.has(name) : !b.inputOnlySet.has(name));
    BOARDS[b.type] = b; return b; };

  /* ---- legacy board kept for older projects (symbol and footprint live in parts.js) ---- */
  {
    const D = seq('D', 2, 13), A = seq('A', 0, 3);
    const pinName = avrNames(14, 4, D, A);
    add({ type: 'mcu', name: 'Mini AVR board', short: 'MCU', chip: 'ATmega328P', clock: '16 MHz', family: 'avr', legacy: true,
      logic: 5, logicPin: '5V', selfPowered: true, supplies: { '5V': 5 }, adcBits: 10, adcRef: 5, pullup: 35000, pulldown: false, rOut: 25, pwmFreq: 490,
      gpio: D.concat(A), pwm: 'all', adc: A, interrupts: ['D2', 'D3'], led: 'D13', i2c: null,
      pinName, analogPin: avrAnalog(14, 4, pinName), constants: Object.assign(aConst(14, 4), { LED_BUILTIN: 13 }),
      summary: 'Digital D2–D13 · analog A0–A3 (14–17) · PWM on every digital pin · on-board LED on D13 · 5 V logic.' });
  }

  /* ---- Arduino Uno R3 ---- */
  {
    const D = seq('D', 0, 13), A = seq('A', 0, 5);
    const pinName = avrNames(14, 6, D, A);
    add({ type: 'arduino_uno', name: 'Arduino Uno R3', short: 'UNO', chip: 'ATmega328P', chipShort: '328P', clock: '16 MHz', family: 'avr', color: '#0e7c86',
      logic: 5, logicPin: '5V', selfPowered: true, supplies: { '5V': 5, '3V3': 3.3 }, adcBits: 10, adcRef: 5, pullup: 35000, pulldown: false, rOut: 25,
      pwmFreq: 490, pwmFreqPins: { D5: 980, D6: 980 }, gpio: D.concat(A), pwm: ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'], adc: A,
      interrupts: ['D2', 'D3'], led: 'D13', i2c: { sda: 'A4', scl: 'A5' },
      pinName, analogPin: avrAnalog(14, 6, pinName), constants: Object.assign(aConst(14, 6), { LED_BUILTIN: 13, SDA: 18, SCL: 19 }),
      left: ['VIN', '5V', '3V3', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'], right: D.concat(['GND']), symW: 4,
      footprint: { name: 'Arduino_Uno_R3_Module_Headers', outline: [53.3, 68.6], alias: { SDA: 'A4', SCL: 'A5' },
        cols: [{ x: -22.86, names: ['IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN', '', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'] },
               { x: 22.86, names: ['SCL', 'SDA', 'AREF', 'GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', '', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0'] }] },
      body: { kind: 'module', w: 53.3, l: 68.6, color: '#0e7c86', usb: 'B', jack: true, chip: 'dip28', label: 'UNO' },
      summary: 'Digital D0–D13 · analog A0–A5 (14–19) · PWM on 3, 5, 6, 9, 10, 11 · interrupts on 2 and 3 · I²C on A4/A5 · LED on D13 · 5 V logic, 10-bit ADC.' });
  }

  /* ---- Arduino Nano ---- */
  {
    const D = seq('D', 0, 13), A = seq('A', 0, 7);
    const pinName = avrNames(14, 8, D, A);
    add({ type: 'arduino_nano', name: 'Arduino Nano', short: 'NANO', chip: 'ATmega328P', chipShort: '328P', clock: '16 MHz', family: 'avr', color: '#1c6fb4',
      logic: 5, logicPin: '5V', selfPowered: true, supplies: { '5V': 5, '3V3': 3.3 }, adcBits: 10, adcRef: 5, pullup: 35000, pulldown: false, rOut: 25,
      pwmFreq: 490, pwmFreqPins: { D5: 980, D6: 980 }, gpio: D.concat(A), pwm: ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'], adc: A,
      noDigital: ['A6', 'A7'], inputOnly: ['A6', 'A7'], interrupts: ['D2', 'D3'], led: 'D13', i2c: { sda: 'A4', scl: 'A5' },
      pinName, analogPin: avrAnalog(14, 8, pinName), constants: Object.assign(aConst(14, 8), { LED_BUILTIN: 13, SDA: 18, SCL: 19 }),
      left: ['VIN', '5V', '3V3', 'GND'].concat(A), right: D.concat(['GND']), symW: 4,
      footprint: { name: 'Arduino_Nano_DIP-30_W15.24mm', dip: true,
        cols: [{ x: -7.62, names: ['D1', 'D0', 'RESET', 'GND', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'] },
               { x: 7.62, names: ['VIN', 'GND', 'RESET', '5V', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'AREF', '3V3', 'D13'] }], outline: [18.5, 43.2] },
      body: { kind: 'module', w: 18, l: 43.2, color: '#1c6fb4', usb: 'mini', chip: 'qfp', label: 'NANO' },
      summary: 'Digital D0–D13 · analog A0–A7 (A6/A7 analog input only) · PWM on 3, 5, 6, 9, 10, 11 · interrupts on 2 and 3 · I²C on A4/A5 · LED on D13 · 5 V logic.' });
  }

  /* ---- Arduino Mega 2560 ---- */
  {
    const D = seq('D', 0, 53), A = seq('A', 0, 15);
    const pinName = avrNames(54, 16, D, A);
    const pwm = seq('D', 2, 13).concat(['D44', 'D45', 'D46']);
    add({ type: 'arduino_mega', name: 'Arduino Mega 2560', short: 'MEGA', chip: 'ATmega2560', chipShort: '2560', clock: '16 MHz', family: 'avr', color: '#0e7c86',
      logic: 5, logicPin: '5V', selfPowered: true, supplies: { '5V': 5, '3V3': 3.3 }, adcBits: 10, adcRef: 5, pullup: 35000, pulldown: false, rOut: 25,
      pwmFreq: 490, pwmFreqPins: { D4: 980, D13: 980 }, gpio: D.concat(A), pwm, adc: A,
      interrupts: ['D2', 'D3', 'D21', 'D20', 'D19', 'D18'], led: 'D13', i2c: { sda: 'D20', scl: 'D21' },
      pinName, analogPin: avrAnalog(54, 16, pinName), constants: Object.assign(aConst(54, 16), { LED_BUILTIN: 13, SDA: 20, SCL: 21 }),
      left: ['VIN', '5V', '3V3', 'GND'].concat(A, seq('D', 0, 21)), right: seq('D', 22, 53).concat(['GND']), symW: 4,
      footprint: { name: 'Arduino_Mega2560_Module_Headers', outline: [53.3, 101.6],
        cols: [{ x: -22.86, names: ['IOREF', 'RESET', '3V3', '5V', 'GND', 'GND', 'VIN', ''].concat(A) },
               { x: 22.86, names: ['AREF', 'GND'].concat(seq('D', 13, 0, -1), seq('D', 14, 21)) },
               { x: 15.24, names: ['5V'].concat(seq('D', 22, 52, 2), ['GND']) },
               { x: 17.78, names: ['5V'].concat(seq('D', 23, 53, 2), ['GND']) }] },
      body: { kind: 'module', w: 53.3, l: 101.6, color: '#0e7c86', usb: 'B', jack: true, chip: 'qfp', label: 'MEGA 2560' },
      summary: 'Digital D0–D53 · analog A0–A15 (54–69) · PWM on 2–13 and 44–46 · interrupts on 2, 3, 18–21 · I²C on 20/21 · LED on D13 · 5 V logic.' });
  }

  /* ---- ESP32 DevKit V1 (30-pin) ---- */
  {
    const left = ['EN', 'IO36', 'IO39', 'IO34', 'IO35', 'IO32', 'IO33', 'IO25', 'IO26', 'IO27', 'IO14', 'IO12', 'IO13', 'GND', 'VIN'];
    const right = ['IO23', 'IO22', 'IO1', 'IO3', 'IO21', 'IO19', 'IO18', 'IO5', 'IO17', 'IO16', 'IO4', 'IO2', 'IO15', 'GND', '3V3'];
    const gpio = left.concat(right).filter(n => n.startsWith('IO'));
    const adc = ['IO36', 'IO39', 'IO34', 'IO35', 'IO32', 'IO33', 'IO25', 'IO26', 'IO27', 'IO14', 'IO12', 'IO13', 'IO15', 'IO2', 'IO4'];
    add({ type: 'esp32_devkit', name: 'ESP32 DevKit V1', short: 'ESP32', chip: 'ESP32-WROOM-32', chipShort: 'ESP32', clock: '240 MHz', family: 'esp32', color: '#24292d',
      logic: 3.3, logicPin: '3V3', selfPowered: true, supplies: { '3V3': 3.3, VIN: 4.7 }, adcBits: 12, adcRef: 3.3, pullup: 45000, pulldown: true, rOut: 30,
      pwmFreq: 1000, gpio, pwm: 'all', adc, inputOnly: ['IO34', 'IO35', 'IO36', 'IO39'], dac: ['IO25', 'IO26'], interrupts: 'any',
      led: 'IO2', i2c: { sda: 'IO21', scl: 'IO22' }, features: ['ledc', 'dac', 'res'],
      pinName: n => (typeof n === 'number' && gpio.includes('IO' + Math.floor(n)) ? 'IO' + Math.floor(n) : null), analogPin: null,
      constants: { LED_BUILTIN: 2, A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A12: 2, A13: 15, A14: 13, A15: 12, A16: 14, A17: 27, A18: 25, A19: 26, DAC1: 25, DAC2: 26, SDA: 21, SCL: 22 },
      left: ['3V3', 'VIN', 'GND', 'IO36', 'IO39', 'IO34', 'IO35', 'IO32', 'IO33', 'IO25', 'IO26', 'IO27', 'IO14', 'IO12', 'IO13'],
      right: ['IO23', 'IO22', 'IO1', 'IO3', 'IO21', 'IO19', 'IO18', 'IO5', 'IO17', 'IO16', 'IO4', 'IO2', 'IO15', 'GND'], symW: 4,
      footprint: { name: 'ESP32_DevKit_V1_30pin_W25.4mm', cols: [{ x: -12.7, names: left }, { x: 12.7, names: right }], outline: [28.5, 51.5] },
      body: { kind: 'module', w: 28, l: 51.5, color: '#202427', usb: 'micro', chip: 'rfcan', label: 'ESP32' },
      summary: 'GPIO by number (IO2 = 2) · ADC 12-bit (0–4095) on 32–39, 25–27, 12–15, 2, 4 · IO34–39 input only · DAC on 25/26 (dacWrite) · PWM on any output (analogWrite or ledc) · interrupts on any pin · I²C on 21/22 · LED on IO2 · 3.3 V logic. VIN outputs USB 5 V.' });
  }

  /* ---- Raspberry Pi Pico ---- */
  {
    const fpL = ['GP0', 'GP1', 'GND', 'GP2', 'GP3', 'GP4', 'GP5', 'GND', 'GP6', 'GP7', 'GP8', 'GP9', 'GND', 'GP10', 'GP11', 'GP12', 'GP13', 'GND', 'GP14', 'GP15'];
    const fpR = ['VBUS', 'VSYS', 'GND', '3V3_EN', '3V3', 'ADC_VREF', 'GP28', 'GND', 'GP27', 'GP26', 'RUN', 'GP22', 'GND', 'GP21', 'GP20', 'GP19', 'GP18', 'GND', 'GP17', 'GP16'];
    const gpio = seq('GP', 0, 22).concat(['GP25', 'GP26', 'GP27', 'GP28']);
    add({ type: 'pi_pico', name: 'Raspberry Pi Pico', short: 'PICO', chip: 'RP2040', chipShort: 'RP2040', clock: '133 MHz', family: 'rp2040', color: '#2f8f3a',
      logic: 3.3, logicPin: '3V3', selfPowered: true, supplies: { '3V3': 3.3, VBUS: 5, VSYS: 4.7 }, adcBits: 10, adcRef: 3.3, pullup: 50000, pulldown: true, rOut: 30,
      pwmFreq: 1000, gpio, pwm: 'all', adc: ['GP26', 'GP27', 'GP28'], interrupts: 'any', led: 'GP25', i2c: { sda: 'GP4', scl: 'GP5' }, features: ['res'],
      pinName: n => (typeof n === 'number' && gpio.includes('GP' + Math.floor(n)) ? 'GP' + Math.floor(n) : null), analogPin: null,
      constants: { LED_BUILTIN: 25, A0: 26, A1: 27, A2: 28, SDA: 4, SCL: 5 },
      left: ['VBUS', 'VSYS', '3V3', 'GND'].concat(seq('GP', 0, 13)), right: seq('GP', 14, 22).concat(['GP26', 'GP27', 'GP28', 'GND']), symW: 4,
      footprint: { name: 'RPi_Pico_2x20_W17.78mm', dip: true, cols: [{ x: -8.89, names: fpL }, { x: 8.89, names: fpR }], outline: [21, 51] },
      body: { kind: 'module', w: 21, l: 51, color: '#2f8f3a', usb: 'micro', chip: 'qfn', label: 'PICO' },
      summary: 'GPIO by number (GP15 = 15) · ADC on GP26–28 (A0–A2), 10-bit by default, analogReadResolution(12) for 12-bit · PWM on every GPIO · interrupts on any pin · I²C on GP4/GP5 · on-board LED on GP25 · 3.3 V logic. VBUS outputs USB 5 V.' });
  }

  /* ---- STM32 Blue Pill ---- */
  {
    const fpA = ['B12', 'B13', 'B14', 'B15', 'A8', 'A9', 'A10', 'A11', 'A12', 'A15', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', '5V', 'GND', '3V3'].map(n => (/^[ABC]\d/.test(n) ? 'P' + n : n));
    const fpB = ['GND', 'GND', '3V3', 'RESET', 'B11', 'B10', 'B1', 'B0', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'C15', 'C14', 'C13', 'VBAT'].map(n => (/^[ABC]\d/.test(n) ? 'P' + n : n));
    const gpio = fpA.concat(fpB).filter(n => /^P[ABC]\d/.test(n));
    const num = name => ({ A: 0, B: 16, C: 32 })[name[1]] + +name.slice(2);
    const consts = { LED_BUILTIN: num('PC13'), SDA: num('PB7'), SCL: num('PB6') };
    gpio.forEach(n => { consts[n] = num(n); });
    ['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1'].forEach((n, i) => { consts['A' + i] = num(n); });
    add({ type: 'stm32_bluepill', name: 'STM32 Blue Pill', short: 'STM32', chip: 'STM32F103C8T6', chipShort: 'F103', clock: '72 MHz', family: 'stm32', color: '#1f4fa3',
      logic: 3.3, logicPin: '3V3', selfPowered: true, supplies: { '3V3': 3.3, '5V': 5 }, adcBits: 10, adcRef: 3.3, pullup: 40000, pulldown: true, rOut: 30,
      pwmFreq: 1000, gpio, pwm: ['PA0', 'PA1', 'PA2', 'PA3', 'PA6', 'PA7', 'PA8', 'PA9', 'PA10', 'PB0', 'PB1', 'PB6', 'PB7', 'PB8', 'PB9'],
      adc: ['PA0', 'PA1', 'PA2', 'PA3', 'PA4', 'PA5', 'PA6', 'PA7', 'PB0', 'PB1'], interrupts: 'any', led: 'PC13', ledActiveLow: true,
      i2c: { sda: 'PB7', scl: 'PB6' }, features: ['res'],
      pinName: n => { if (typeof n !== 'number') return null; n = Math.floor(n); const p = 'P' + ('ABC'[n >> 4] || '?') + (n & 15); return gpio.includes(p) ? p : null; }, analogPin: null,
      constants: consts,
      left: ['5V', '3V3', 'GND'].concat(seq('PA', 0, 12), ['PA15']), right: ['PB0', 'PB1'].concat(seq('PB', 3, 15), ['PC13', 'PC14', 'PC15', 'GND']), symW: 4,
      footprint: { name: 'STM32_BluePill_2x20_W15.24mm', cols: [{ x: -7.62, names: fpA }, { x: 7.62, names: fpB }], outline: [23, 53] },
      body: { kind: 'module', w: 23, l: 53, color: '#1f4fa3', usb: 'micro', chip: 'qfp', label: 'BLUE PILL' },
      summary: 'Pins by name (PA0, PB12, PC13) · ADC 10-bit on PA0–PA7, PB0, PB1 (A0–A9) · PWM on PA0–3, PA6–10, PB0, PB1, PB6–9 · interrupts on any pin · I²C on PB7/PB6 · on-board LED on PC13 (lights when LOW) · 3.3 V logic.' });
  }

  /* ---- ATtiny85 (bare chip, needs a supply on VCC) ---- */
  {
    const gpio = ['PB0', 'PB1', 'PB2', 'PB3', 'PB4', 'PB5'];
    const ch = ['PB5', 'PB2', 'PB4', 'PB3'];
    const pinName = n => (typeof n === 'number' && n >= 0 && n <= 5 ? 'PB' + Math.floor(n) : null);
    add({ type: 'attiny85', name: 'ATtiny85', short: 'ATtiny85', chip: 'ATtiny85', chipShort: 'T85', clock: '8 MHz', family: 'avr', color: '#26282a', chipOnly: true,
      logic: 5, logicPin: 'VCC', selfPowered: false, minV: 1.8, supplies: {}, adcBits: 10, adcRef: 'vcc', pullup: 35000, pulldown: false, rOut: 40,
      pwmFreq: 490, gpio, pwm: ['PB0', 'PB1', 'PB4'], adc: ch, noDigital: ['PB5'], inputOnly: ['PB5'], interrupts: ['PB2'], led: null, i2c: { sda: 'PB0', scl: 'PB2' },
      pinName, analogPin: n => (typeof n === 'number' && (n & 0x80) ? ch[n & 0x7f] || null : pinName(n)),
      constants: { A0: 0x80, A1: 0x81, A2: 0x82, A3: 0x83, LED_BUILTIN: 1 },
      left: ['PB5', 'PB3', 'PB4', 'GND'], right: ['VCC', 'PB2', 'PB1', 'PB0'], symW: 3,
      footprint: { name: 'DIP-8_W7.62mm', dip: true, cols: [{ x: -3.81, names: ['PB5', 'PB3', 'PB4', 'GND'] }, { x: 3.81, names: ['VCC', 'PB2', 'PB1', 'PB0'] }] },
      body: { kind: 'dip', n: 8 },
      summary: 'Pins 0–4 = PB0–PB4 · analog A1 (PB2), A2 (PB4), A3 (PB3), A0 (PB5, input only) · PWM on PB0, PB1, PB4 · interrupt INT0 on PB2 · runs from the voltage on its VCC pin (1.8–5.5 V); logic levels follow VCC.' });
  }

  CL.BOARDS = BOARDS;
  CL.BOARD_LIST = ['arduino_uno', 'arduino_nano', 'arduino_mega', 'esp32_devkit', 'pi_pico', 'stm32_bluepill', 'attiny85', 'mcu'].map(k => BOARDS[k]);
})(typeof window !== 'undefined' ? window : globalThis);
