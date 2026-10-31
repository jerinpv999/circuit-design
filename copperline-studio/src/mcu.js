/* Copperline MCU runtime: Arduino-style sketch -> generator-based JS, run against simulation time */
(function (G) {
  const CL = (G.CL = G.CL || {});

  function skipString(s, i) {
    const q = s[i]; let j = i + 1;
    while (j < s.length && s[j] !== q) { if (s[j] === '\\') j++; j++; }
    return j + 1;
  }
  function matchBracket(s, i, open, close) {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (ch === '"' || ch === "'" || ch === '`') { j = skipString(s, j) - 1; continue; }
      if (ch === open) depth++;
      else if (ch === close) { depth--; if (depth === 0) return j; }
    }
    throw new Error(`Unbalanced '${open}' — check your brackets`);
  }
  function stripComments(s) {
    let out = '', i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"' || ch === "'") { const j = skipString(s, i); out += s.slice(i, j); i = j; continue; }
      if (ch === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (ch === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); const chunk = s.slice(i, j < 0 ? s.length : j + 2); out += chunk.replace(/[^\n]/g, ''); i = j < 0 ? s.length : j + 2; continue; }
      out += ch; i++;
    }
    return out;
  }
  function wrapCalls(s, set) {
    let out = '', i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"' || ch === "'" || ch === '`') { const j = skipString(s, i); out += s.slice(i, j); i = j; continue; }
      if (/[A-Za-z_$]/.test(ch) && (i === 0 || !/[\w$.]/.test(s[i - 1]))) {
        let j = i; while (j < s.length && /[\w$]/.test(s[j])) j++;
        const word = s.slice(i, j);
        let k = j; while (k < s.length && /\s/.test(s[k])) k++;
        if (set.has(word) && s[k] === '(' && !/function\*\s*$/.test(out)) {
          const close = matchBracket(s, k, '(', ')');
          out += `(yield* ${word}(${wrapCalls(s.slice(k + 1, close), set)}))`;
          i = close + 1; continue;
        }
        out += word; i = j; continue;
      }
      out += ch; i++;
    }
    return out;
  }
  function guardLoops(s) {
    let out = '', i = 0;
    const re = /\b(while|for)\s*\(|\bdo\s*\{/g;
    let m;
    while ((m = re.exec(s))) {
      if (m[0].startsWith('do')) { const end = m.index + m[0].length; out += s.slice(i, end) + ' if(__g()) yield 0; '; i = end; re.lastIndex = end; continue; }
      const p = s.indexOf('(', m.index);
      const close = matchBracket(s, p, '(', ')');
      let k = close + 1; while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === '{') { out += s.slice(i, k + 1) + ' if(__g()) yield 0; '; i = k + 1; }
      else if (s[k] === ';') { out += s.slice(i, close + 1) + ' { if(__g()) yield 0; }'; i = k + 1; }
      else { // single statement body
        let e = k, depth = 0;
        for (; e < s.length; e++) { const ch = s[e]; if (ch === '(') depth++; else if (ch === ')') depth--; else if (ch === ';' && depth === 0) break; }
        out += s.slice(i, k) + '{ if(__g()) yield 0; ' + s.slice(k, e + 1) + ' }'; i = e + 1;
      }
      re.lastIndex = i;
    }
    return out + s.slice(i);
  }

  const BASE = '(?:unsigned\\s+long\\s+long|unsigned\\s+long|unsigned\\s+int|unsigned\\s+char|unsigned\\s+short|unsigned|long\\s+long|long|int|short|float|double|bool|boolean|byte|char|String|word|void|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t)';
  const LIB_CLASSES = 'Servo|LiquidCrystal_I2C|DHT';
  /* generators available to every sketch; they can pause on simulated time */
  const PRELUDE = `function* delay(ms){ yield Math.max(0, +ms || 0); }
function* delayMicroseconds(us){ yield Math.max(0, +us || 0) / 1000; }
function* shiftOut(d, c, order, val){ for (let i = 0; i < 8; i++) { const b = order === LSBFIRST ? (val >> i) & 1 : (val >> (7 - i)) & 1; digitalWrite(d, b); yield 0; digitalWrite(c, 1); yield 0; digitalWrite(c, 0); } yield 0; }
function* shiftIn(d, c, order){ let v = 0; for (let i = 0; i < 8; i++) { digitalWrite(c, 1); yield 0; const b = digitalRead(d); if (order === LSBFIRST) v |= b << i; else v |= b << (7 - i); digitalWrite(c, 0); yield 0; } return v; }
function* pulseIn(pin, state, timeout){
  if (timeout === undefined) timeout = 1000000;
  const want = state ? 1 : 0, lim = __now() + timeout / 1e6, dt = __dt();
  while (__lvl(pin) === want) { if (__now() > lim) return 0; yield 0; }
  let pv = __volt(pin), pt = __now();
  while (__lvl(pin) !== want) { if (__now() > lim) return 0; pv = __volt(pin); pt = __now(); yield 0; }
  const rv = __volt(pin), rt = __now();
  let vmax = rv, lv = rv, lt = rt;
  yield 0;
  while (__lvl(pin) === want) { if (__now() > lim) return 0; lv = __volt(pin); lt = __now(); if (lv > vmax) vmax = lv; yield 0; }
  const fv = __volt(pin), ft = __now();
  if (!want) return Math.round((ft - rt) * 1e6);
  const fr = v => Math.max(0, Math.min(1, vmax > 0 ? v / vmax : 0));
  let t0 = rt - dt; if (fr(pv) > 0.02) t0 = pt - fr(pv) * dt; else if (fr(rv) < 0.98) t0 = rt - fr(rv) * dt;
  let t1 = ft - dt; if (fr(lv) < 0.98 && lt > rt) t1 = lt - dt + fr(lv) * dt; else if (fr(fv) > 0.02) t1 = ft - dt + fr(fv) * dt;
  return Math.max(0, Math.round((t1 - t0) * 1e6));
}
function* pulseInLong(pin, state, timeout){ return yield* pulseIn(pin, state, timeout); }
`;
  const GENERATORS = ['delay', 'delayMicroseconds', 'shiftOut', 'shiftIn', 'pulseIn', 'pulseInLong'];
  CL.transpileSketch = function (src) {
    let s = stripComments(src);
    s = s.replace(/^\s*#include.*$/gm, '');
    s = s.replace(/^\s*#define\s+(\w+)\s+(.+)$/gm, 'const $1 = $2;');
    s = s.replace(/^\s*#(?:ifdef|ifndef|endif|else|pragma|undef).*$/gm, '');
    s = s.replace(/\bB([01]{1,8})\b/g, '0b$1');
    s = s.replace(/\b(0x[0-9a-fA-F]+|\d+)(?:UL|ul|LL|ll|L|l|U|u)\b/g, '$1');
    s = s.replace(/(\d+\.\d*)f\b/g, '$1');
    s = s.replace(/sizeof\s*\(\s*(\w+)\s*\)\s*\/\s*sizeof\s*\(\s*\w+\s*\[\s*0\s*\]\s*\)/g, '$1.length');
    s = s.replace(/\.length\s*\(\s*\)/g, '.length');
    // library objects: Servo s;  LiquidCrystal_I2C lcd(0x27, 16, 2);  DHT dht(2, DHT22);
    s = s.replace(new RegExp('\\b(' + LIB_CLASSES + ')\\s+(\\w+)\\s*(?:\\(([^;]*?)\\))?\\s*;', 'g'), (m, cls, name, args) => `let ${name} = new ${cls}(${args || ''});`);
    s = s.replace(new RegExp('(' + BASE + ')\\s*\\*+\\s*(?=[A-Za-z_])', 'g'), '$1 ');
    s = s.replace(new RegExp('\\(\\s*' + BASE + '\\s*\\)', 'g'), '');
    s = s.replace(new RegExp('(?:static\\s+|inline\\s+)*' + BASE + '\\s+\\w+\\s*\\([^)]*\\)\\s*;', 'g'), '');
    const fnNames = [];
    s = s.replace(new RegExp('(?:static\\s+|inline\\s+)*\\b' + BASE + '\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*\\{', 'g'), (m, name, params) => {
      fnNames.push(name);
      const pt = params.trim();
      const ps = !pt || pt === 'void' ? '' : pt.split(',').map(p => { const t = p.replace(/=.*$/, '').replace(/[&*\[\]]/g, ' ').trim().split(/\s+/); return t[t.length - 1]; }).join(', ');
      return `function* ${name}(${ps}) {`;
    });
    s = s.replace(new RegExp('\\bconst\\s+(?:static\\s+|volatile\\s+)*' + BASE + '\\s+(?=[A-Za-z_])', 'g'), 'const ');
    s = s.replace(new RegExp('\\b(?:static\\s+|volatile\\s+)*' + BASE + '\\s+(?=[A-Za-z_])', 'g'), 'let ');
    // arrays: let a[] = {..};  let a[5];
    s = s.replace(/\b(let|const)\s+(\w+)\s*\[\s*(\w*)\s*\]\s*(=\s*\{|;)/g, (m, kw, name, size, tail) => tail === ';' ? `${kw} ${name} = new Array(${size || 0}).fill(0);` : `${kw} ${name} = \u0001`);
    let idx;
    while ((idx = s.indexOf('\u0001')) >= 0) {
      const close = matchBracket(s, idx - 0, '\u0001', '}') ;
      s = s.slice(0, idx) + '[' + s.slice(idx + 1, close) + ']' + s.slice(close + 1);
    }
    s = guardLoops(s);
    s = wrapCalls(s, new Set(fnNames.concat(GENERATORS)));
    return `${PRELUDE}\n${s}\nreturn { setup: typeof setup === 'function' ? setup : null, loop: typeof loop === 'function' ? loop : null };`;
  };
  /* bracket matcher that treats \u0001 as an opener */
  const _mb = matchBracket;
  matchBracket = function (s, i, open, close) {
    if (open !== '\u0001') return _mb(s, i, open, close);
    let depth = 1;
    for (let j = i + 1; j < s.length; j++) { const ch = s[j]; if (ch === '"' || ch === "'") { j = skipString(s, j) - 1; continue; } if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) return j; } }
    throw new Error('Unbalanced array initialiser');
  };

  const fmtNum = (x, base) => {
    if (typeof x === 'boolean') return x ? '1' : '0';
    if (typeof x !== 'number') return String(x);
    if (Number.isNaN(x)) return 'nan';
    if (base === undefined) return Number.isInteger(x) ? String(x) : x.toFixed(2);
    if (Number.isInteger(x) && (base === 16 || base === 2 || base === 8)) return (x >>> 0).toString(base).toUpperCase();
    if (Number.isInteger(x) && base === 10) return String(x);
    return x.toFixed(Math.max(0, Math.min(8, base)));
  };
  const printf = (fmt, args) => {
    let i = 0;
    return String(fmt).replace(/%([-+ 0#]*)(\d*)(?:\.(\d+))?(l{0,2}|h{0,2})([diufFeExXsco%])/g, (m, flags, width, prec, len, conv) => {
      if (conv === '%') return '%';
      let a = args[i++], out;
      switch (conv) {
        case 'd': case 'i': out = String(Math.trunc(+a)); break;
        case 'u': out = String(Math.trunc(+a) >>> 0); break;
        case 'f': case 'F': out = Number.isNaN(+a) ? 'nan' : (+a).toFixed(prec === undefined ? 6 : +prec); break;
        case 'e': case 'E': out = (+a).toExponential(prec === undefined ? 6 : +prec); if (conv === 'E') out = out.toUpperCase(); break;
        case 'x': out = (Math.trunc(+a) >>> 0).toString(16); break;
        case 'X': out = (Math.trunc(+a) >>> 0).toString(16).toUpperCase(); break;
        case 'o': out = (Math.trunc(+a) >>> 0).toString(8); break;
        case 'c': out = typeof a === 'number' ? String.fromCharCode(a) : String(a)[0] || ''; break;
        default: out = String(a);
      }
      const w = +width || 0;
      if (out.length < w) out = flags.includes('-') ? out.padEnd(w) : out.padStart(w, flags.includes('0') && conv !== 's' ? '0' : ' ');
      return out;
    });
  };

  class McuRuntime {
    constructor(code, io, board) {
      this.B = board || (CL.BOARDS && CL.BOARDS.mcu);
      this.io = io; this.pins = {}; this.ok = false; this.error = null; this.wake = 0; this.t = 0; this.done = false; this.ops = 0;
      this.adcBits = this.B.adcBits; this.pwmBits = 8; this.ints = []; this.ledc = {}; this.ledcPin = {}; this.lcds = {};
      this.compile(code);
    }
    vdd() { return this.io.vdd ? this.io.vdd() : this.B.logic; }
    pin(p, fn) {
      const B = this.B;
      let n = typeof p === 'string' ? p.trim().toUpperCase() : B.pinName(p);
      if (n && B.family === 'esp32') n = n.replace(/^GPIO/, 'IO');
      if (!n || !B.gpioSet.has(n)) throw new Error(`${fn}(): pin ${p} is not available on the ${B.name}`);
      return n;
    }
    analogPin(p, fn) {
      const B = this.B;
      let n = typeof p === 'string' ? p.trim().toUpperCase() : B.analogPin ? B.analogPin(p) : B.pinName(p);
      if (!n || !B.adcSet.has(n)) throw new Error(`${fn}(): ${n || 'pin ' + p} is not an analog input on the ${B.name}`);
      return n;
    }
    level(n) { return this.io.read(n) > this.vdd() / 2 ? 1 : 0; }
    api() {
      const self = this, io = this.io, B = this.B;
      const st = n => (self.pins[n] = self.pins[n] || { mode: 'INPUT', level: 0, pwm: null, freq: null });
      const setPwm = (n, duty, freq) => { const s = st(n); s.mode = 'OUTPUT'; s.dac = null; if (duty <= 0) { s.pwm = null; s.level = 0; } else if (duty >= 1) { s.pwm = null; s.level = 1; } else { s.pwm = duty; s.freq = freq; } };
      const runSync = fn => { const g = fn(); let n = 0; while (n++ < 100000) { if (g.next().done) break; } };
      const api = {
        HIGH: 1, LOW: 0, INPUT: 'INPUT', OUTPUT: 'OUTPUT', INPUT_PULLUP: 'INPUT_PULLUP', INPUT_PULLDOWN: 'INPUT_PULLDOWN',
        CHANGE: 1, FALLING: 2, RISING: 3, NOT_AN_INTERRUPT: -1, MSBFIRST: 1, LSBFIRST: 0,
        DEC: 10, HEX: 16, BIN: 2, OCT: 8, PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2, DHT11: 11, DHT22: 22, DHT21: 21,
        pinMode(p, m) {
          const n = self.pin(p, 'pinMode'), s = st(n);
          if (m === 'OUTPUT' && B.inputOnlySet.has(n)) throw new Error(`pinMode(): ${n} is input-only on the ${B.name}`);
          if (m === 'INPUT_PULLDOWN' && !B.pulldown) throw new Error(`pinMode(): INPUT_PULLDOWN is not available on the ${B.name}`);
          if (m === 'INPUT_PULLUP' && B.inputOnlySet.has(n) && B.family === 'esp32') throw new Error(`pinMode(): ${n} has no internal pull-up on the ESP32`);
          s.mode = m; s.pwm = null; s.dac = null; if (m !== 'OUTPUT') s.level = 0;
        },
        digitalWrite(p, v) {
          const n = self.pin(p, 'digitalWrite'), s = st(n);
          if (B.noDigitalSet.has(n)) throw new Error(`digitalWrite(): ${n} is analog-input only on the ${B.name}`);
          s.pwm = null; s.dac = null; s.toneUntil = null;
          if (s.mode === 'OUTPUT') s.level = v ? 1 : 0;
          else if (B.family === 'avr') s.mode = v ? 'INPUT_PULLUP' : 'INPUT';
        },
        digitalRead(p) { const n = self.pin(p, 'digitalRead'); if (B.noDigitalSet.has(n)) throw new Error(`digitalRead(): ${n} is analog-input only on the ${B.name}; use analogRead()`); return self.level(n); },
        analogRead(p) {
          const n = self.analogPin(p, 'analogRead');
          const ref = B.adcRef === 'vcc' ? self.vdd() : B.adcRef;
          return Math.round(CL.clamp(io.read(n) / ref, 0, 1) * (Math.pow(2, self.adcBits) - 1));
        },
        analogWrite(p, v) {
          const n = self.pin(p, 'analogWrite');
          if (B.inputOnlySet.has(n)) throw new Error(`analogWrite(): ${n} is input-only on the ${B.name}`);
          const max = Math.pow(2, self.pwmBits) - 1; v = CL.clamp(Math.floor(v), 0, max);
          if (!B.hasPwm(n)) { const s = st(n); s.mode = 'OUTPUT'; s.pwm = null; s.level = v >= (max + 1) / 2 ? 1 : 0; return; }
          setPwm(n, v / max, (B.pwmFreqPins && B.pwmFreqPins[n]) || B.pwmFreq);
        },
        tone(p, f, dur) { const n = self.pin(p, 'tone'); if (!(f > 0)) return; setPwm(n, 0.5, f); st(n).toneUntil = dur ? self.t + dur / 1000 : null; },
        noTone(p) { const n = self.pin(p, 'noTone'), s = st(n); s.pwm = null; s.level = 0; s.toneUntil = null; },
        digitalPinToInterrupt(p) {
          const n = self.pin(p, 'digitalPinToInterrupt');
          if (B.interrupts === 'any') return typeof p === 'number' ? p : B.pinName ? p : -1;
          return B.interrupts.indexOf(n);
        },
        attachInterrupt(num, isr, mode) {
          let n;
          if (B.interrupts === 'any') n = self.pin(num, 'attachInterrupt');
          else { n = B.interrupts[num]; if (!n) throw new Error(`attachInterrupt(): interrupt ${num} does not exist on the ${B.name} (pins ${B.interrupts.join(', ')})`); }
          if (typeof isr !== 'function') throw new Error('attachInterrupt(): the second argument must be a function');
          self.ints = self.ints.filter(x => x.pin !== n);
          self.ints.push({ pin: n, isr, mode, prev: self.level(n) });
        },
        detachInterrupt(num) { const n = B.interrupts === 'any' ? self.pin(num, 'detachInterrupt') : B.interrupts[num]; self.ints = self.ints.filter(x => x.pin !== n); },
        interrupts() {}, noInterrupts() {}, yield() {},
        millis() { return Math.floor(self.t * 1000); },
        micros() { return Math.floor(self.t * 1e6); },
        randomSeed() {},
        random(a, b) { if (b === undefined) { b = a; a = 0; } return Math.floor(a + Math.random() * (b - a)); },
        map(x, a, b, c, d) { return Math.trunc((x - a) * (d - c) / (b - a) + c); },
        constrain(x, a, b) { return Math.min(b, Math.max(a, x)); },
        abs: Math.abs, fabs: Math.abs, min: Math.min, max: Math.max, pow: Math.pow, sqrt: Math.sqrt, sq: x => x * x, sin: Math.sin, cos: Math.cos, tan: Math.tan,
        asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2, exp: Math.exp, log: Math.log, log10: Math.log10, floor: Math.floor, ceil: Math.ceil, round: Math.round,
        isnan: Number.isNaN, isinf: x => !Number.isFinite(x) && !Number.isNaN(x), radians: x => x * Math.PI / 180, degrees: x => x * 180 / Math.PI,
        bitRead(x, n) { return (x >> n) & 1; }, bitSet(x, n) { return x | (1 << n); }, bitClear(x, n) { return x & ~(1 << n); },
        bitWrite(x, n, b) { return b ? x | (1 << n) : x & ~(1 << n); }, bit(n) { return 1 << n; }, lowByte(x) { return x & 0xff; }, highByte(x) { return (x >> 8) & 0xff; },
        F: x => x,
        Serial: {
          begin() {}, end() {}, flush() {}, available() { return 0; }, read() { return -1; }, peek() { return -1; }, parseInt() { return 0; }, parseFloat() { return 0; },
          print(x, b) { const s = fmtNum(x, b); io.serial(s); return s.length; },
          println(x = '', b) { const s = fmtNum(x, b); io.serial(s + '\n'); return s.length + 1; },
          write(x) { io.serial(typeof x === 'number' ? String.fromCharCode(x) : String(x)); return 1; },
          printf(fmt, ...args) { const s = printf(fmt, args); io.serial(s); return s.length; }
        },
        Wire: { begin() {}, setClock() {}, beginTransmission() {}, endTransmission() { return 0; }, write() { return 1; }, requestFrom() { return 0; }, available() { return 0; }, read() { return -1; } },
        Servo: class Servo {
          constructor() { this.p = null; this.mn = 544; this.mx = 2400; this.us = 1500; }
          attach(p, mn, mx) { this.p = self.pin(p, 'Servo.attach'); if (mn !== undefined) { this.mn = mn; this.mx = mx === undefined ? 2400 : mx; } const s = st(this.p); s.mode = 'OUTPUT'; s.servo = true; this._apply(); return 1; }
          write(a) { if (a < 200) { a = CL.clamp(a, 0, 180); this.us = this.mn + (this.mx - this.mn) * a / 180; } else this.us = a; this._apply(); }
          writeMicroseconds(us) { this.us = us; this._apply(); }
          read() { return Math.round((this.us - this.mn) * 180 / (this.mx - this.mn)); }
          readMicroseconds() { return this.us; }
          attached() { return !!this.p; }
          detach() { if (this.p) { const s = st(this.p); s.pwm = null; s.level = 0; s.servo = false; } this.p = null; }
          _apply() { if (!this.p) return; const s = st(this.p); s.mode = 'OUTPUT'; s.pwm = this.us / 20000; s.freq = 50; }
        },
        LiquidCrystal_I2C: class LiquidCrystal_I2C {
          constructor(addr = 0x27, cols = 16, rows = 2) { this.addr = addr; this.cols = cols; this.rows = rows; this.cx = 0; this.cy = 0; this.bl = false; this.ready = false; this.on = true; this._blank(); self.lcds[addr] = this; }
          _blank() { this.buf = Array.from({ length: this.rows }, () => ' '.repeat(this.cols)); }
          _probe() { if (!io.i2cProbe || io.i2cProbe(this.addr)) return; if (!this.warned) { io.serial(`\n[I2C] No device answered at 0x${this.addr.toString(16).toUpperCase()}. Check SDA/SCL wiring (${B.i2c ? B.i2c.sda + '/' + B.i2c.scl : 'no I2C pins'}), power and the address.\n`); this.warned = true; } }
          init() { this._probe(); this.ready = true; this.clear(); }
          begin(c, r) { if (c) { this.cols = c; this.rows = r || this.rows; } this.init(); }
          backlight() { this.bl = true; } noBacklight() { this.bl = false; } setBacklight(v) { this.bl = !!v; }
          display() { this.on = true; } noDisplay() { this.on = false; }
          clear() { this._blank(); this.cx = 0; this.cy = 0; } home() { this.cx = 0; this.cy = 0; }
          setCursor(c, r) { this.cx = Math.max(0, Math.floor(c)); this.cy = Math.max(0, Math.floor(r)); }
          print(x, b) { const s = fmtNum(x, b); for (const ch of s) { if (this.cy < this.rows && this.cx < this.cols) { const row = this.buf[this.cy]; this.buf[this.cy] = row.slice(0, this.cx) + ch + row.slice(this.cx + 1); } this.cx++; } return s.length; }
          write(c) { return this.print(typeof c === 'number' ? String.fromCharCode(c) : String(c)); }
          cursor() {} noCursor() {} blink() {} noBlink() {} createChar() {} scrollDisplayLeft() {} scrollDisplayRight() {} leftToRight() {} rightToLeft() {} autoscroll() {} noAutoscroll() {}
        },
        DHT: class DHT {
          constructor(pin, type = 22) { this.pin = pin; this.type = type; }
          begin() {}
          _r() { return io.dht ? io.dht(self.pin(this.pin, 'DHT')) : null; }
          readTemperature(f) { const r = this._r(); if (!r) return NaN; const t = this.type === 11 ? Math.round(r.t) : Math.round(r.t * 10) / 10; return f ? t * 1.8 + 32 : t; }
          readHumidity() { const r = this._r(); if (!r) return NaN; return this.type === 11 ? Math.round(r.h) : Math.round(r.h * 10) / 10; }
          computeHeatIndex(t, h) { return t; }
        },
        __g() { self.ops++; return self.ops % 4000 === 0; },
        __now() { return self.t; },
        __dt() { return io.dt ? io.dt() : 1e-4; },
        __lvl(p) { return self.level(self.pin(p, 'pulseIn')); },
        __volt(p) { return io.read(self.pin(p, 'pulseIn')); }
      };
      if ((B.features || []).includes('res')) {
        api.analogReadResolution = bits => { self.adcBits = CL.clamp(Math.floor(bits), 1, 16); };
        api.analogWriteResolution = bits => { self.pwmBits = CL.clamp(Math.floor(bits), 1, 16); };
      }
      if ((B.features || []).includes('ledc')) {
        api.analogReadResolution = bits => { self.adcBits = CL.clamp(Math.floor(bits), 9, 12); };
        api.analogWriteResolution = bits => { self.pwmBits = CL.clamp(Math.floor(bits), 1, 16); };
        api.ledcSetup = (ch, freq, bits) => { self.ledc[ch] = { freq, bits, pins: (self.ledc[ch] && self.ledc[ch].pins) || [] }; return freq; };
        api.ledcAttachPin = (p, ch) => { const n = self.pin(p, 'ledcAttachPin'); if (!self.ledc[ch]) self.ledc[ch] = { freq: 5000, bits: 8, pins: [] }; self.ledc[ch].pins.push(n); st(n).mode = 'OUTPUT'; };
        api.ledcAttach = (p, freq, bits) => { const n = self.pin(p, 'ledcAttach'); self.ledcPin[n] = { freq, bits }; st(n).mode = 'OUTPUT'; return true; };
        api.ledcDetachPin = p => { const n = self.pin(p, 'ledcDetachPin'); Object.values(self.ledc).forEach(c => { c.pins = c.pins.filter(x => x !== n); }); const s = st(n); s.pwm = null; s.level = 0; };
        api.ledcWrite = (chOrPin, duty) => {
          const c = self.ledc[chOrPin];
          if (c && c.pins.length) { c.pins.forEach(n => setPwm(n, duty / (Math.pow(2, c.bits) - 1), c.freq)); return; }
          const n = self.pin(chOrPin, 'ledcWrite'), cfg = self.ledcPin[n] || { freq: 5000, bits: 8 };
          setPwm(n, duty / (Math.pow(2, cfg.bits) - 1), cfg.freq);
        };
        api.ledcWriteTone = (chOrPin, f) => { const c = self.ledc[chOrPin]; const pins = c && c.pins.length ? c.pins : [self.pin(chOrPin, 'ledcWriteTone')]; pins.forEach(n => setPwm(n, f > 0 ? 0.5 : 0, f)); return f; };
      }
      if ((B.features || []).includes('dac')) {
        api.dacWrite = (p, v) => { const n = self.pin(p, 'dacWrite'); if (!B.dacSet.has(n)) throw new Error(`dacWrite(): ${n} has no DAC (use 25 or 26)`); const s = st(n); s.mode = 'DAC'; s.pwm = null; s.dac = CL.clamp(v, 0, 255) / 255 * B.logic; };
      }
      Object.assign(api, B.constants || {});
      api.__runSync = runSync;
      return api;
    }
    compile(code) {
      try {
        if (!code || !code.trim()) { this.error = 'No sketch uploaded'; return; }
        const js = CL.transpileSketch(code);
        this.js = js;
        const api = this.api(), names = Object.keys(api);
        this.runSync = api.__runSync;
        const mod = new Function(...names, js)(...names.map(n => api[n]));
        if (!mod.setup && !mod.loop) throw new Error('Sketch needs a setup() and a loop() function');
        this.gen = (function* () { if (mod.setup) yield* mod.setup(); if (!mod.loop) return; while (true) { yield* mod.loop(); yield 0; } })();
        this.ok = true;
      } catch (e) { this.error = 'Compile error: ' + e.message; this.ok = false; }
    }
    tick(t) {
      this.t = t;
      if (!this.ok || this.error || this.done) return;
      for (const name in this.pins) { const s = this.pins[name]; if (s.toneUntil != null && t >= s.toneUntil) { s.pwm = null; s.level = 0; s.toneUntil = null; } }
      try {
        for (const it of this.ints) {
          const lv = this.level(it.pin);
          const fire = it.mode === 3 ? (lv && !it.prev) : it.mode === 2 ? (!lv && it.prev) : it.mode === 1 ? lv !== it.prev : it.mode === 0 ? !lv : false;
          it.prev = lv;
          if (fire) this.runSync(it.isr);
        }
      } catch (e) { this.error = 'Runtime error in interrupt: ' + e.message; this.io.serial('\n[' + this.error + ']\n'); return; }
      let guard = 0;
      while (t >= this.wake - 1e-12 && guard++ < 2000) {
        let r;
        try { r = this.gen.next(); }
        catch (e) { this.error = 'Runtime error: ' + e.message; this.io.serial('\n[' + this.error + ']\n'); return; }
        if (r.done) { this.done = true; return; }
        const ms = +r.value || 0;
        if (ms <= 0) { this.wake = t + 1e-12; break; }
        this.wake = t + ms / 1000;
      }
    }
  }
  CL.McuRuntime = McuRuntime;

  CL.SKETCHES = {
    blink: { name: 'Blink', code: `// Blink the on-board LED once a second (works on every board)
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Blink started");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
` },
    traffic: { name: 'Traffic light + button + pot', code: `// Traffic light on D11 (red), D12 (amber), D13 (green)
// Push button on D2 (to GND) requests a pedestrian crossing.
// Potentiometer on A0 sets how long green lasts.
// PWM on D9 drives the fan motor through Q1.

const int RED = 11;
const int AMBER = 12;
const int GREEN = 13;
const int BUTTON = 2;
const int FAN = 9;

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(AMBER, OUTPUT);
  pinMode(GREEN, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Junction controller ready");
}

void lights(int r, int a, int g) {
  digitalWrite(RED, r);
  digitalWrite(AMBER, a);
  digitalWrite(GREEN, g);
}

void loop() {
  int pot = analogRead(A0);
  int greenTime = map(pot, 0, 1023, 300, 3000);
  analogWrite(FAN, pot / 4);
  Serial.print("green ms = ");
  Serial.println(greenTime);

  lights(LOW, LOW, HIGH);
  unsigned long start = millis();
  while (millis() - start < greenTime) {
    if (digitalRead(BUTTON) == LOW) {
      Serial.println("Pedestrian request");
      break;
    }
    delay(10);
  }
  lights(LOW, HIGH, LOW);
  delay(600);
  lights(HIGH, LOW, LOW);
  delay(1500);
  lights(HIGH, HIGH, LOW);
  delay(400);
}
` },
    fade: { name: 'Fade (PWM)', code: `// Fade an LED on PWM pin D9 up and down
int brightness = 0;
int step = 5;

void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  analogWrite(9, brightness);
  brightness = brightness + step;
  if (brightness <= 0 || brightness >= 255) {
    step = -step;
  }
  delay(30);
}
` },
    button: { name: 'Button toggles LED', code: `// Toggle the LED on D13 each time the button on D2 is pressed
bool ledOn = false;
int last = HIGH;

void setup() {
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  int now = digitalRead(2);
  if (last == HIGH && now == LOW) {
    ledOn = !ledOn;
    digitalWrite(13, ledOn ? HIGH : LOW);
    Serial.println(ledOn ? "ON" : "OFF");
    delay(30); // debounce
  }
  last = now;
}
` },
    knight: { name: 'Knight rider (D6–D13)', code: `// Bounce a light along LEDs on D6..D13
int leds[] = {6, 7, 8, 9, 10, 11, 12, 13};
int count = sizeof(leds) / sizeof(leds[0]);

void setup() {
  for (int i = 0; i < count; i++) {
    pinMode(leds[i], OUTPUT);
  }
}

void sweep(int from, int to, int dir) {
  for (int i = from; i != to; i += dir) {
    digitalWrite(leds[i], HIGH);
    delay(70);
    digitalWrite(leds[i], LOW);
  }
}

void loop() {
  sweep(0, count - 1, 1);
  sweep(count - 1, 0, -1);
}
` },
    analog: { name: 'Analog read to Serial', code: `// Print the voltage on A0 every 250 ms
void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);
  float volts = raw * 5.0 / 1023.0;
  Serial.print("A0 = ");
  Serial.print(raw);
  Serial.print("  (");
  Serial.print(volts, 2);
  Serial.println(" V)");
  delay(250);
}
` },
    sevenseg: { name: '7-segment counter', code: `// Count 0-9 on a common-cathode display, segments a..g on D2..D8
byte digits[] = {
  B0111111, B0000110, B1011011, B1001111, B1100110,
  B1101101, B1111101, B0000111, B1111111, B1101111
};

void setup() {
  for (int p = 2; p <= 8; p++) pinMode(p, OUTPUT);
}

void show(int n) {
  for (int s = 0; s < 7; s++) {
    digitalWrite(2 + s, bitRead(digits[n], s));
  }
}

void loop() {
  for (int n = 0; n < 10; n++) {
    show(n);
    delay(500);
  }
}
` },
    servo_sweep: { name: 'Servo follows a knob', code: `// Potentiometer on A0 sets the servo angle on pin 9.
#include <Servo.h>
Servo arm;

void setup() {
  arm.attach(9);
  Serial.begin(9600);
}

void loop() {
  int angle = map(analogRead(A0), 0, 1023, 0, 180);
  arm.write(angle);
  Serial.println(angle);
  delay(20);
}
` },
    counter_isr: { name: 'Interrupt button counter', code: `// Count button presses with an interrupt. Button on D2 to GND.
volatile int presses = 0;
int shown = -1;

void onPress() {
  presses++;
}

void setup() {
  pinMode(2, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Press the button on D2");
}

void loop() {
  if (presses != shown) {
    shown = presses;
    Serial.print("presses: ");
    Serial.println(shown);
    digitalWrite(LED_BUILTIN, shown % 2);
  }
  delay(20);
}
` },
    parking: { name: 'Parking sensor (Uno)', code: `// Parking sensor: the HC-SR04 measures the gap, the LCD shows it,
// the servo raises the barrier when a car is close and the buzzer beeps faster as it gets closer.
#include <Servo.h>
#include <LiquidCrystal_I2C.h>

const int TRIG = 9;
const int ECHO = 10;
const int BUZZER = 8;
const int GATE = 6;

Servo gate;
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  gate.attach(GATE);
  gate.write(0);
  lcd.init();
  lcd.backlight();
  lcd.print("Parking sensor");
  Serial.begin(9600);
}

float readDistance() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long duration = pulseIn(ECHO, HIGH, 30000);
  return duration * 0.0343 / 2;
}

void loop() {
  float cm = readDistance();
  lcd.setCursor(0, 1);
  lcd.print("Gap: ");
  lcd.print(cm, 1);
  lcd.print(" cm    ");
  Serial.print("distance ");
  Serial.println(cm, 1);

  if (cm > 0 && cm < 30) {
    gate.write(90);
    tone(BUZZER, 2000, 60);
    delay(map(cm, 0, 30, 60, 400));
  } else {
    gate.write(0);
    noTone(BUZZER);
    delay(200);
  }
}
` },
    weather: { name: 'Weather station (ESP32)', code: `// ESP32 weather station: DHT22 on GPIO4, light sensor (LDR divider) on GPIO34,
// readings on a 16x2 I2C LCD (SDA 21, SCL 22) and the serial monitor.
#include <DHT.h>
#include <LiquidCrystal_I2C.h>

DHT dht(4, DHT22);
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  dht.begin();
  lcd.init();
  lcd.backlight();
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  int light = analogRead(34);              // 12-bit: 0-4095
  int pct = map(light, 0, 4095, 0, 100);

  lcd.setCursor(0, 0);
  lcd.print("T ");
  lcd.print(t, 1);
  lcd.print("C  H ");
  lcd.print(h, 0);
  lcd.print("%  ");
  lcd.setCursor(0, 1);
  lcd.print("Light ");
  lcd.print(pct);
  lcd.print("%     ");

  Serial.printf("T=%.1f C  H=%.0f %%  light=%d %%\\n", t, h, pct);
  digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  delay(1000);
}
` },
    esp32_dac: { name: 'DAC sine + LEDC fade (ESP32)', code: `// ESP32: sine wave on the DAC (GPIO25) and an LED fading on GPIO2 with LEDC PWM.
// Put a scope probe on GPIO25 to see the waveform.
int phase = 0;

void setup() {
  ledcAttach(2, 5000, 8);
}

void loop() {
  dacWrite(25, 128 + 127 * sin(phase * 2 * PI / 100));
  ledcWrite(2, (phase * 255) / 100);
  phase = (phase + 1) % 100;
  delay(2);
}
` },
    shiftbar: { name: 'Shift-register LED bar (Pico)', code: `// Raspberry Pi Pico drives 8 LEDs through a 74HC595 shift register.
// The button on GP15 (to GND) reverses the direction using an interrupt.
const int DATA = 2;
const int CLOCK = 3;
const int LATCH = 4;
const int BUTTON = 15;

volatile bool reverse = false;
int pos = 0;

void flip() {
  reverse = !reverse;
}

void setup() {
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON), flip, FALLING);
}

void show(byte pattern) {
  digitalWrite(LATCH, LOW);
  shiftOut(DATA, CLOCK, MSBFIRST, pattern);
  digitalWrite(LATCH, HIGH);
}

void loop() {
  show(1 << pos);
  pos = reverse ? (pos + 7) % 8 : (pos + 1) % 8;
  delay(120);
}
` },
    nightlight: { name: 'Night light (ATtiny85)', code: `// ATtiny85 night light: light sensor divider on PB2 (A1), LED on PB0 (PWM).
// The darker it gets, the brighter the LED.
const int SENSOR = A1;
const int LED = 0;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR);          // 0 = dark, 1023 = bright
  int level = map(constrain(light, 100, 700), 100, 700, 255, 0);
  analogWrite(LED, level);
  delay(50);
}
` },
    thermostat: { name: 'Thermostat with relay (Nano)', code: `// Nano thermostat: 10k NTC thermistor on A0 (10k resistor to GND),
// relay on D7 through a transistor switches a 12 V heater lamp.
const int SENSOR = A0;
const int RELAY = 7;
const float SETPOINT = 22.0;
const float HYSTERESIS = 1.0;
bool heating = false;

float readCelsius() {
  int raw = analogRead(SENSOR);
  float r = 10000.0 * (1023.0 / raw - 1.0);        // thermistor resistance
  float kelvin = 1.0 / (1.0 / 298.15 + log(r / 10000.0) / 3950.0);
  return kelvin - 273.15;
}

void setup() {
  pinMode(RELAY, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  float c = readCelsius();
  if (!heating && c < SETPOINT - HYSTERESIS) heating = true;
  if (heating && c > SETPOINT + HYSTERESIS) heating = false;
  digitalWrite(RELAY, heating ? HIGH : LOW);
  digitalWrite(LED_BUILTIN, heating ? HIGH : LOW);
  Serial.print("temperature ");
  Serial.print(c, 1);
  Serial.println(heating ? " C  heater ON" : " C  heater off");
  delay(500);
}
` },
    tank: { name: 'Joystick tank drive (Blue Pill)', code: `// STM32 Blue Pill tank drive: joystick on PA0 (forward/back) and PA1 (left/right).
// L298N: ENA PA8, IN1 PB12, IN2 PB13 (left motor); ENB PA9, IN3 PB14, IN4 PB15 (right motor).
const int JOY_Y = PA0;
const int JOY_X = PA1;
const int ENA = PA8, IN1 = PB12, IN2 = PB13;
const int ENB = PA9, IN3 = PB14, IN4 = PB15;

void drive(int en, int a, int b, int speed) {
  digitalWrite(a, speed > 0 ? HIGH : LOW);
  digitalWrite(b, speed < 0 ? HIGH : LOW);
  analogWrite(en, min(abs(speed), 255));
}

void setup() {
  int pins[] = {IN1, IN2, IN3, IN4, ENA, ENB};
  for (int i = 0; i < 6; i++) pinMode(pins[i], OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  int y = map(analogRead(JOY_Y), 0, 1023, -255, 255);
  int x = map(analogRead(JOY_X), 0, 1023, -255, 255);
  if (abs(y) < 20) y = 0;
  if (abs(x) < 20) x = 0;
  int left = constrain(y + x, -255, 255);
  int right = constrain(y - x, -255, 255);
  drive(ENA, IN1, IN2, left);
  drive(ENB, IN3, IN4, right);
  digitalWrite(LED_BUILTIN, (left || right) ? LOW : HIGH);   // PC13 LED lights when LOW
  Serial.printf("left %4d  right %4d\\n", left, right);
  delay(50);
}
` }
  };

  const AVR5 = ['mcu', 'arduino_uno', 'arduino_nano', 'arduino_mega'];
  const TAGS = { blink: 'any', traffic: AVR5, fade: AVR5, button: AVR5, knight: AVR5, analog: AVR5, sevenseg: AVR5, servo_sweep: AVR5, counter_isr: AVR5,
    parking: ['arduino_uno', 'arduino_nano'], weather: ['esp32_devkit'], esp32_dac: ['esp32_devkit'], shiftbar: ['pi_pico'], nightlight: ['attiny85'],
    thermostat: ['arduino_nano', 'arduino_uno'], tank: ['stm32_bluepill'] };
  Object.entries(TAGS).forEach(([k, b]) => { if (CL.SKETCHES[k]) CL.SKETCHES[k].boards = b; });
})(typeof window !== 'undefined' ? window : globalThis);
