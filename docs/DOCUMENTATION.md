# Copperline Studio — Technical Documentation

1. [Architecture](#1-architecture)
2. [Project file format](#2-project-file-format)
3. [Component library](#3-component-library)
4. [Netlist extraction and ERC](#4-netlist-extraction-and-erc)
5. [Circuit simulator](#5-circuit-simulator)
6. [Microcontroller runtime](#6-microcontroller-runtime)
7. [PCB engine](#7-pcb-engine)
8. [3D viewer](#8-3d-viewer)
9. [Export formats](#9-export-formats)
10. [User interface](#10-user-interface)
11. [Testing](#11-testing)
12. [Extending Copperline](#12-extending-copperline)

---

## 1. Architecture

Copperline is a static single-page app. There is no build step and no server code.

```
               ┌────────────── app.js (React UI) ──────────────┐
               │ Schematic · PCB · 3D · Code · Dock · Export   │
               └───────┬──────────┬──────────┬─────────┬───────┘
                       │          │          │         │
 boards.js ─► parts.js ─► netlist.js ─► sim.js ◄─ mcu.js │
    │             │                                    │
    └──────► pcb.js (pads, routing, DRC, render) ──► export.js
                  │
                  └──► three3d.js (Three.js)
 core.js: units, geometry, stroke font (used by all)
```

**Design rules followed throughout:**

- **One global.** Every engine module wraps itself in an IIFE and attaches to `window.CL` (or `globalThis.CL` in Node). Load order is the order in `index.html`.
- **The project is plain data.** All state that matters lives in one JSON-serialisable object (§2). Views derive everything else from it, so undo/redo is a stack of project snapshots and saving is `JSON.stringify`.
- **Engines are DOM-free.** `core`, `parts`, `netlist`, `sim`, `mcu`, `pcb` (except its two render functions), `export` and `examples` run unchanged in Node, which is how the test suite works.
- **Third-party code** comes from CDNs: React 18.3.1 and ReactDOM (UMD), htm 3.1.1 (JSX-like templates without a compiler), Three.js r128, JSZip 3.10.1.

**Why not React Three Fiber?** R3F ships only as ES modules that need a bundler to resolve `react` imports, and this project deliberately has no build step. `three3d.js` uses Three.js directly, and React owns its lifecycle (mount, rebuild on project change, dispose). Porting to R3F in a Vite project means turning `Board3D.part()` into JSX components; the geometry code carries over as is.

---

## 2. Project file format

A project is saved as `*.copperline.json`.

```jsonc
{
  "name": "Junction controller",
  "version": 1,
  "components": [
    {
      "id": "c1a2b",              // unique, stable
      "type": "resistor",         // key into CL.DEFS
      "ref": "R1",                // reference designator
      "x": 12, "y": 6,            // schematic position in grid units (1 grid = 10 px = 0.1")
      "rot": 1,                   // quarter turns clockwise, 0–3
      "props": { "resistance": "220", "package": "Axial THT" },
      "pcb": { "x": 41.275, "y": 22.86, "rot": 1, "side": "F" }   // mm; absent for virtual parts
    }
  ],
  "wires": [
    { "id": "w9", "pts": [[6, 2], [12, 2], [12, 3]] }  // schematic polyline, grid units
  ],
  "board": {
    "w": 105, "h": 70,            // outline, mm (origin top-left in the editor)
    "layers": 2,                  // 2 or 4
    "thickness": 1.6,
    "traceWidth": 0.3, "clearance": 0.2,
    "viaD": 0.8, "viaDrill": 0.4,
    "grid": 0.635,
    "mask": "#1d6b45", "silk": "#f4f4ef", "finish": "ENIG",
    "pour": { "B.Cu": "GND" },    // layer -> net flooded with copper
    "traces": [ { "id": "t1", "net": "GND", "layer": "F.Cu", "w": 0.3, "pts": [[10, 20], [15, 25]] } ],
    "vias":   [ { "id": "v1", "x": 15, "y": 25, "d": 0.8, "drill": 0.4, "net": "GND" } ]
  },
  "sim": { "dt": 0.0001, "timebase": 0.01 }   // time step (s) and scope window (s)
}
```

**Conventions**

- Schematic Y grows downward. Rotation is clockwise on screen: `CL.rotQ(x, y, 1)` maps `(x, y) → (−y, x)`.
- PCB coordinates are millimetres with the origin at the board's top-left in the editor. Exports flip Y so the manufacturing origin is the bottom-left corner.
- Bottom-side footprints (`side: "B"`) are mirrored in X before rotation, as seen from the top.
- Property values are strings with optional SI prefixes, parsed by `CL.parseSI` (§3.4). Live properties (switch state, wiper position, duty cycle) are booleans or numbers.

---

## 3. Component library

`src/parts.js` defines every component with `def(type, {...})`. The resulting table is `CL.DEFS`.

### 3.1 Definition fields

| Field | Type | Purpose |
|---|---|---|
| `name` | string | Palette and inspector label |
| `cat` | string | Palette category (one of `CL.CATEGORIES`) |
| `prefix` | string | Reference prefix (`R`, `C`, `U`…). A `#` prefix hides the reference |
| `pins` | `[{n, x, y}]` | Pin names and positions in grid units relative to the origin. **Order matters**: simulator, netlist and footprint pads refer to pins by index |
| `props` | object | Default property values |
| `meta` | object | Inspector editors per property: `{label, unit, kind: 'si'│'select'│'range'│'bool'│'text', options, live}` |
| `labels` | `{ref, val}` | Label anchors in local px. Defaults put the reference above and the value below; vertical parts stack both on the right |
| `val(c)` | function | Value text shown on the schematic and in the BOM |
| `draw(c, st)` | function → SVG string | Symbol in local px (10 px per grid). `st` is the part's live simulation reading or `undefined` |
| `fp(c)` | function → footprint │ `null` | PCB footprint; `null` for virtual parts |
| `virtual` | bool | No physical part (ground, labels, probes, voltmeter) |
| `net(c)` | function → string | Forces the pin onto a named net (ground, power port, net label) |
| `interactive` | `'toggle'│'momentary'` | Click behaviour during simulation |
| `selfOriented` | bool | `draw` handles rotation itself (net labels keep text upright) |

### 3.2 Symbol drawing classes

Symbols are SVG strings styled by theme-aware CSS classes:

| Class | Use |
|---|---|
| `s` | Stroke in ink colour, no fill. Add `w` (thick) or `w2` (thicker) |
| `f` | Solid ink fill (arrowheads, diode triangles) |
| `b` | Body: paper fill with ink stroke. Variants: `dark`, `mcu`, `inst` |
| `t`, `lbl` | Monospace text |
| `pinlbl` | Small pin-name text; `hi` highlights a driven pin |
| `acc`, `bad` | Accent and error strokes |
| `glow` | Blurred halo (LEDs, lamps) |

### 3.3 Footprints

A footprint is `{name, pads, silk, body, size, smd?}` in millimetres:

- `pads[]`: `{num, pin, x, y, shape: 'rect'│'circle'│'oval', w, h, drill, hidden?}`. `pin` is the schematic pin index, or `-1` for no connection. Several pads may share a pin (tactile switches). `hidden: 'GND'│'VCC'` ties an unused pad to that net if it exists (logic IC power pins).
- `silk[]`: `{t:'l', pts}` polylines, `{t:'c', x, y, r}` circles, `{t:'arc', x, y, r, a0, a1}`.
- `body`: `{kind, …}` tells the 3D viewer which model to build (§8).
- `size`: `[w, h]` courtyard, used for selection, placement and overlap avoidance.

Generators in `CL.FP`: `axial`, `smd('0603'|'0805'|'1206')`, `radial`, `disc`, `led5`, `to92(order)`, `to220(order)`, `dip(n, map, hidden)`, `header(n)`, `terminal2`, `tact`, `slide`, `pot`, `hc49`, `buzzer`, `sevenseg`, `mcuboard`. The `order`/`map` arguments map pad numbers to schematic pins using standard pinouts: 2N3904 is E-B-C, 78xx is IN-GND-OUT, LM358 output is pad 1.

### 3.4 Values and units

`CL.parseSI("4.7k") → 4700`. Recognised prefixes: `f p n u µ m k K M G` and `meg`. Note `m` is milli and `M` is mega. Trailing units (`Ω V A F H Hz`) are ignored. `CL.formatSI(0.0047, 'F') → "4.70 mF"`.

### 3.5 Full component list

| Category | Components |
|---|---|
| Passive | Resistor (axial / 0603 / 0805 / 1206), Capacitor (disc / SMD), Electrolytic, Inductor, Potentiometer, Crystal, Fuse |
| Semiconductor | Diode (1N4148, 1N4007, 1N5819), Zener, LED (6 colours, 5 mm / 0805), RGB LED (common cathode / anode), Bridge rectifier, NPN (2N3904, 2N2222, BC547, TIP120), PNP (2N3906, BC557, TIP125), N-MOSFET (2N7000, IRLZ44N, IRF540N), P-MOSFET (BS250, IRF9540N) |
| Sources | DC supply, Battery, AC source, Function generator, Current source, Ground, Power port, Net label, No connect |
| Integrated | Op-amp LM358, Comparator LM393, 555 timer, Regulator 78xx, LM317, AMS1117 (1.8–5.0 V), Motor driver L298N |
| Logic | AND, NAND, OR, NOR, XOR, NOT (74HC series), 74HC595 shift register, CD4017 decade counter |
| Microcontroller | Arduino Uno R3, Arduino Nano, Arduino Mega 2560, ESP32 DevKit V1, Raspberry Pi Pico, STM32 Blue Pill, ATtiny85, Mini AVR board |
| Input | Toggle switch, Push button, Joystick module (KY-023) |
| Sensors | LDR, NTC thermistor, DHT22, HC-SR04, PIR HC-SR501 |
| Output | Lamp, DC motor, Buzzer, 7-segment display, Relay SPDT (5 V / 12 V coil), Servo SG90, LCD 16×2 I²C |
| Instruments | Voltmeter, Ammeter, Scope probe |
| Connector | Pin headers 1×2, 1×4, 1×6 |

Transistor parts are chosen with the **Part** property, which also sets the gain or threshold and picks the right package and pinout (TO-92 E-B-C, BC547 C-B-E, TO-220 B-C-E or G-D-S). Sensor values that change during a run (light level, temperature, humidity, distance, joystick position, motion) are live sliders or toggles in the inspector.

### 3.6 Microcontroller board registry

`src/boards.js` defines `CL.BOARDS`. Each profile drives the symbol, the footprint, the simulator and the sketch runtime:

| Field | Meaning |
|---|---|
| `type`, `name`, `chip`, `clock`, `color` | Identity and the colour of the symbol's title bar |
| `left`, `right`, `symW` | Pin names down each side of the schematic symbol, and its half-width in grid units |
| `logic`, `logicPin` | Logic-high voltage and the pin that supplies output drivers and pull-ups |
| `selfPowered`, `supplies` | Dev boards are USB-powered: `supplies` lists pins that output a voltage (Norton source, 0.05 Ω). Bare chips (`selfPowered: false`) run only when their VCC pin is above `minV` |
| `adcBits`, `adcRef` | Default `analogRead()` resolution and reference (`'vcc'` follows the supply pin) |
| `rOut`, `pullup`, `pulldown` | Output resistance, pull-up value, whether `INPUT_PULLDOWN` exists |
| `pwm`, `pwmFreq`, `pwmFreqPins` | PWM-capable pins (or `'all'`) and their frequency. `analogWrite` on other pins behaves like `digitalWrite` (≥ 50 % = HIGH), as on real AVR boards |
| `adc`, `inputOnly`, `noDigital`, `dac` | Analog inputs, input-only pins (ESP32 IO34–39, Nano A6/A7), DAC pins |
| `interrupts` | Interrupt number → pin (AVR) or `'any'` |
| `led`, `ledActiveLow`, `i2c` | On-board LED and the default I²C pins |
| `pinName(n)`, `analogPin(n)`, `constants` | How numbers in a sketch map to pins (`13 → D13`, `A0 → 14`, `PA0 → 0`, ATtiny `A1 → PB2`) |
| `footprint`, `body` | Header columns (DIP numbering where it applies) and the 3D model |
| `summary` | The text shown in the Code tab |

| Board | Logic | ADC | PWM | Interrupts | I²C | LED |
|---|---|---|---|---|---|---|
| Arduino Uno R3 | 5 V | 10-bit, A0–A5 | 3, 5, 6, 9, 10, 11 | 2, 3 | A4/A5 | D13 |
| Arduino Nano | 5 V | 10-bit, A0–A7 (A6/A7 input only) | 3, 5, 6, 9, 10, 11 | 2, 3 | A4/A5 | D13 |
| Arduino Mega 2560 | 5 V | 10-bit, A0–A15 | 2–13, 44–46 | 2, 3, 18–21 | 20/21 | D13 |
| ESP32 DevKit V1 | 3.3 V | 12-bit, 15 pins; IO34–39 input only | any output | any | 21/22 | IO2 |
| Raspberry Pi Pico | 3.3 V | 10-bit default (12 with `analogReadResolution`), GP26–28 | any | any | GP4/GP5 | GP25 (on board) |
| STM32 Blue Pill | 3.3 V | 10-bit, PA0–PA7, PB0, PB1 | 15 timer pins | any | PB7/PB6 | PC13 (active low) |
| ATtiny85 | VCC (1.8–5.5 V) | 10-bit, PB2–PB5 | PB0, PB1, PB4 | PB2 (INT0) | PB0/PB2 | — |

## 4. Netlist extraction and ERC

`CL.buildNetlist(project)` returns `{nets, pinNet, wireNet, junctions, warnings}`.

**Connection rules** (the same as KiCad's):

1. All vertices of one wire are on the same net.
2. A wire **endpoint** that lands on another wire's segment or vertex joins it (T-junction).
3. A **pin** connects only at a wire endpoint or vertex. A wire passing straight through a pin does *not* connect.
4. Pins that coincide connect directly, without a wire.
5. Net labels and power ports with the same name join their nets. The ground symbol is the net `GND`.
6. The MCU board's two GND pins are tied internally.

Unnamed nets are numbered `N$1`, `N$2`, … in component order. Junction dots appear where three or more connections meet.

**ERC warnings:** an unconnected pin on a physical part (board pins excluded), and a design with no ground reference. Put a **No Connect** marker on a pin that is deliberately unused to silence its warning.

---

## 5. Circuit simulator

`src/sim.js` · class `CL.Sim(project, {dt, serial})`

### 5.1 Method

The simulator uses **modified nodal analysis**. Unknowns are the voltages of every non-ground net plus one current for each element that needs a branch variable (voltage sources, ammeters, op-amp outputs, the regulator and the MCU's 5 V rail).

Each time step:

1. Clear the matrix `A` and right-hand side `b`.
2. Every element *stamps* its linearised contribution using `addG` (conductance), `addI` (current source), `addV` (voltage source) and direct `addA`/`addB` entries.
3. Add `GMIN = 1e-12` S from every node to ground so floating nodes stay solvable.
4. Solve `A·x = b` by Gaussian elimination with partial pivoting.
5. For non-linear circuits, repeat Newton–Raphson iterations (up to 120) until the largest change is below 1e-7 **and** no junction voltage was limited in that iteration. Node changes are damped to ±10 V per iteration.
6. Call each element's `accept(dt, t)` to update its state (capacitor voltage, inductor current, LED brightness average, fuse timer, MCU sketch).

A singular matrix stops the run with a message, usually caused by two voltage sources in parallel or a source shorted by a wire.

### 5.2 Device models

| Device | Model |
|---|---|
| Resistor, lamp, motor, buzzer | Linear conductance. The motor integrates current into a rotation angle; the lamp's brightness follows power |
| Switch, button | 0.02 Ω closed, 1 GΩ open |
| Fuse | 0.05 Ω; opens permanently when current exceeds its rating for 2 ms |
| Capacitor | Backward-Euler companion: `G = C/dt` in parallel with `−G·v(n−1)` |
| Inductor | Companion: `G = dt/L` in parallel with the previous current |
| Diode | Shockley equation `I = Is·(e^(V/nVt) − 1)` with SPICE `pnjlim` voltage limiting. 1N4148 Is 2.52 nA n 1.752; 1N4007 Is 7.03 nA n 1.808; 1N5819 Is 10 µA n 1.1 |
| Zener | Diode plus a reverse exponential at −Vz |
| LED | Diode with n = 2 and Is chosen to give the colour's forward voltage at 10 mA (red 1.8, orange 1.9, yellow 2.0, green 2.1, blue 3.0, white 3.1 V). Brightness is a 15 ms moving average of current, full at 10 mA |
| NPN / PNP | Ebers–Moll transport model, Is 10 fA, βr 1, βf from the *Gain* property, with analytic Jacobian and junction limiting |
| MOSFET | Square law with K = 0.25 A/V², λ = 0.01, threshold from the *Threshold* property, smooth sub-threshold transition, source/drain swapping and a numeric Jacobian |
| Op-amp | Voltage source `Vout = mid + half·tanh(A·(V+ − V−)/half)` clamped to the rails. Unconnected supply pins default to ±12 V |
| 78xx regulator | Output follows `min(Vin − 2 V, Vout)` with smooth corners; input current equals output current |
| Logic gates | Inputs read high above 2.5 V; output is a 5 V / 0 V source behind 50 Ω, updated each step |
| 7-segment | Eight LEDs to a common cathode or anode |
| Sources | Ideal voltage/current sources; the function generator computes its waveform from simulated time |
| Voltmeter | 10 MΩ. Ammeter: 0 V source whose branch current is the reading |
| Darlington (TIP120/125) | Ebers–Moll with emission coefficient 2, so V(BE) ≈ 1.3 V, β 1000 |
| Power MOSFETs | Same square law with K = 30 (IRLZ44N), 20 (IRF540N), 10 (IRF9540N) A/V² |
| LDR | R = R_dark^(1−L) · R_bright^L, with L the light level 0–1 (log interpolation) |
| NTC thermistor | R = R25 · e^(B(1/T − 1/298.15)) |
| Bridge rectifier | Four 1N4007 diodes |
| RGB LED | Three LEDs (1.8, 2.1, 3.0 V) to a common cathode or anode |
| 555 timer | Internal divider (5 k / 10 k Thevenin of the 3 × 5 k chain) on CTRL; trigger below CTRL/2 sets, threshold above CTRL resets, RESET below 0.7 V forces low; output 15 Ω to VCC / 10 Ω to GND; discharge 10 Ω when low |
| LM393 | Open collector: 30 Ω to GND when IN+ < IN−, otherwise off |
| LM317 | V(OUT) − V(ADJ) = 1.25 V with 1.5 V dropout, smooth-min formulation |
| AMS1117 | 78xx model with 1.1 V dropout |
| 74HC595 | Shifts SER on SRCLK rising edges, latches on RCLK, /SRCLR clears, /OE floats the outputs; outputs 50 Ω to VCC or GND |
| CD4017 | Counts on CLK rising edges while EN is low, RST forces Q0, CO high for counts 0–4; outputs 300 Ω |
| L298N | Each output is a 1 Ω switch to VS or GND according to its IN pin while EN is high; floats when EN is low. On-board 5 V regulator when VS > 7 V |
| Relay | Coil 70 Ω (5 V) or 400 Ω (12 V); pulls in at 75 %, drops out below 10 % of rated voltage; contacts 0.05 Ω / 1 GΩ |
| Servo SG90 | Measures each pulse's high time on SIG with sub-step accuracy, maps 544–2400 µs to 0–180°, moves at 600°/s when V+ ≥ 4 V; draws 200 mA while moving |
| HC-SR04 | On a TRIG rising edge (VCC ≥ 4.5 V) drives ECHO high for 2d / 343 m/s after 0.4 ms; 38 ms timeout pulse beyond 400 cm. Partial steps are stamped as fractions so `pulseIn` resolves well below one time-step |
| DHT22, LCD I²C | Bus-level: linked to a board when their DATA or SDA/SCL nets match the board's pins and they are powered (§6.6) |
| PIR | OUT = 3.3 V behind 100 Ω while motion is set and for the hold time after it |
| Joystick | Two 10 kΩ potentiometers between +5V and GND, SW shorts to GND while pressed |
| Microcontroller pins | Outputs are switch conductances to the logic supply pin and GND, weighted by the fraction of the step the pin is high, so PWM, servo pulses and `tone()` keep their exact average at any time step |

### 5.3 Time step and speed

- The **dt** menu sets the step (1 µs – 1 ms). The default is 100 µs. Use 5 µs or less for kHz signals; MCU PWM is drawn as a real 490 Hz square wave when dt ≤ 100 µs and as its average voltage otherwise.
- The UI spends up to 13 ms per animation frame stepping, aiming to match real time × the **speed** setting. The top bar shows the achieved percentage when the circuit is too heavy.
- **Topology changes** (adding parts, moving wires, uploading code) rebuild the simulator. Value edits and live controls apply on the next step without a restart.

### 5.4 API

```js
const sim = new CL.Sim(project, { dt: 1e-4, serial: (ref, text) => console.log(ref, text) });
for (let i = 0; i < 10000; i++) sim.step();
sim.nodeV('GND');            // 0
const r = sim.readAll();     // { [componentId]: { v, i, p, bright, … } }
sim.probes;                  // [{ id, node, ref, color }]
sim.errors;                  // human-readable problems
```

---

## 6. Microcontroller runtime

`src/mcu.js` · class `CL.McuRuntime(code, {read, serial})`

### 6.1 How a sketch runs

1. **Translate.** `CL.transpileSketch` converts Arduino-style C into JavaScript:
   - strips comments, `#include`; turns `#define X v` into `const`
   - typed declarations (`int`, `unsigned long`, `float`, `bool`, `byte`, `String`, `uint8_t`…) become `let`/`const`
   - functions become generator functions (`function*`) and calls to them become `yield*` so `delay()` can pause anywhere
   - arrays `int a[] = {…}` become JS arrays; `sizeof(a)/sizeof(a[0])` becomes `a.length`
   - binary literals `B1010`, numeric suffixes `UL`/`L`/`f` and C casts are handled
   - every loop body gets a guard that yields to the simulator every 4000 iterations, so busy-wait loops such as `while (digitalRead(2));` advance time instead of freezing
2. **Bind** the Arduino API to the runtime and evaluate the result with `new Function`.
3. **Run.** The simulator calls `tick(t)` after each accepted step. The runtime resumes the sketch until it yields a delay; `delay(ms)` sets a wake-up time in simulated seconds. Each pass through `loop()` also yields once so a loop with no delay still lets time move.

### 6.2 Board and electrical model

- Each board's pins, logic level, ADC, PWM and interrupts come from its profile (§3.6). Pin numbers in a sketch map to that board's names, so `digitalWrite(13, HIGH)` drives D13 on an Uno and `digitalWrite(2, HIGH)` drives IO2 on an ESP32.
- `OUTPUT`: a switch to the logic supply pin (5 V or 3.3 V) or to GND through `rOut` (25–40 Ω). `INPUT_PULLUP` / `INPUT_PULLDOWN`: 35–50 kΩ. `INPUT`: high impedance.
- `digitalRead` threshold is half the logic supply. `analogRead` returns `round(V / ref × (2^bits − 1))`.
- Dev boards are powered from USB: their `5V`, `3V3`, `VIN` (ESP32, 4.7 V) and `VBUS`/`VSYS` (Pico) pins supply other parts. The ATtiny85 needs a supply on VCC; it starts (and restarts) when VCC rises above 1.8 V.
- Wrong use is reported the way the real toolchain or board would report it: writing to an input-only pin, `analogRead` on a non-analog pin, `attachInterrupt` on a pin without an interrupt, `INPUT_PULLDOWN` on an AVR.

### 6.3 Supported API

`pinMode, digitalWrite, digitalRead, analogRead, analogWrite, analogReadResolution / analogWriteResolution (32-bit boards), tone, noTone, delay, delayMicroseconds, millis, micros, attachInterrupt, detachInterrupt, digitalPinToInterrupt, interrupts, noInterrupts, pulseIn, pulseInLong, shiftOut, shiftIn, Serial.begin / print / println / write / printf, map, constrain, random, randomSeed, abs, min, max, pow, sqrt, sq, sin, cos, tan, asin, acos, atan, atan2, exp, log, log10, floor, ceil, round, isnan, isinf, radians, degrees, bitRead, bitSet, bitClear, bitWrite, bit, lowByte, highByte, F()`, plus ESP32 `ledcSetup / ledcAttachPin / ledcAttach / ledcWrite / ledcWriteTone / dacWrite`.

Constants: `HIGH LOW INPUT OUTPUT INPUT_PULLUP INPUT_PULLDOWN RISING FALLING CHANGE MSBFIRST LSBFIRST DEC HEX BIN OCT PI DHT11 DHT22`, and each board's own (`LED_BUILTIN`, `A0`…, `PA0`…, `DAC1`, `SDA`, `SCL`).

Libraries (`#include` lines are accepted):

| Library | Supported |
|---|---|
| `Servo` | `attach(pin[, min, max])`, `write(angle or µs)`, `writeMicroseconds`, `read`, `attached`, `detach`. Drives a real 50 Hz pulse train on the pin |
| `LiquidCrystal_I2C` | `LiquidCrystal_I2C lcd(addr, cols, rows)`, `init`, `begin`, `backlight`, `noBacklight`, `clear`, `home`, `setCursor`, `print`, `write`, `display`, `noDisplay` |
| `DHT` | `DHT dht(pin, DHT22)`, `begin`, `readTemperature([fahrenheit])`, `readHumidity` — returns `nan` when no powered DHT22 is wired to the pin |
| `Wire` | Accepted so sketches compile; I²C devices are linked by wiring |

Interrupt handlers run between simulation steps whenever their pin's level changes in the selected direction. `pulseIn` and `shiftOut` are real-time: they wait for and produce actual edges on the pins.

### 6.4 Not supported

Timers and registers (`PORTB`, `DDRB`, `TCCR1A`), `Serial.read`, other libraries (`SPI`, `Adafruit_*`, `WiFi`), pointers, structs, classes, C integer semantics (division and overflow follow JavaScript) and `String` methods other than `.length()`. Errors appear in the code status bar, the Checks tab and the serial monitor.

### 6.6 Bus-level peripherals

The 16×2 LCD and the DHT22 are not simulated bit by bit. Instead the simulator links them to a board when the wiring is right:

- **LCD (I²C)**: its SDA and SCL nets must be the board's SDA and SCL pins (§3.6), its VCC must be at least 3 V, and the sketch's address must match the module's **I²C address** property (0x27 or 0x3F). `lcd.init()` prints a warning on Serial if no device answers. An LCD that is powered but not initialised shows a row of blocks, as a real HD44780 does.
- **DHT22**: its DATA net must be the pin passed to `DHT dht(pin, DHT22)` and it must be powered. Values come from its live temperature and humidity sliders, rounded to 0.1.

### 6.5 Built-in example sketches

`blink` (every board), `traffic`, `fade`, `button`, `knight`, `analog`, `sevenseg`, `servo_sweep`, `counter_isr` (AVR boards), `parking` (Uno/Nano), `weather` and `esp32_dac` (ESP32), `shiftbar` (Pico), `nightlight` (ATtiny85), `thermostat` (Nano/Uno), `tank` (Blue Pill), in `CL.SKETCHES`. Each has a `boards` field, and the Code tab lists the ones for the selected board first.

---

## 7. PCB engine

`src/pcb.js`

### 7.1 Layers

| Layer | Meaning | Editor colour |
|---|---|---|
| F.Cu, B.Cu | Top and bottom copper | red-copper, blue |
| In1.Cu, In2.Cu | Inner copper (4-layer boards) | gold, violet |
| F.SilkS, B.SilkS | Silkscreen legend | cream, lilac |
| Edge.Cuts | Board outline | yellow |
| Drill | Plated holes | grey |
| Ratsnest | Unrouted connections | white |

Through-hole pads exist on every copper layer; SMD pads exist only on their side's outer layer. Vias are through vias.

### 7.2 Placement

`CL.ensurePlacement(project)` parks any new footprint in a column to the right of the board. `CL.autoPlace(project)` (used by the examples) maps schematic positions to board positions (1.7 mm per grid unit), pushes overlapping courtyards apart, snaps to 0.635 mm and sizes the board to fit.

### 7.3 Connectivity, ratsnest and shorts

`CL.analyze(project)` builds world-space pads (`CL.boardPads`), then unions copper items that touch: track vertices inside pads, track ends on other tracks of the same layer, and tracks or pads at vias. For each net, the pads' copper clusters are joined with a minimum spanning tree; each tree edge is a ratsnest line. A cluster containing pads of two different nets is reported as a **short**.

### 7.4 Design rules check

`CL.runDRC(project)` reports:

- shorts between nets
- copper-to-copper spacing below the board's **clearance**, per layer (pads, tracks and vias as capsules)
- pads outside the outline, tracks leaving the outline
- annular ring below 0.125 mm
- every unrouted connection

Up to 400 issues are returned, each with a position for the on-board marker.

### 7.5 Autorouter

`CL.autoroute(project)` is a two-or-four-layer **A\* maze router**:

- 0.25 mm grid. Each cell records the net occupying it; other nets' copper is inflated by `clearance + trackWidth/2` so a centreline route keeps the required spacing.
- Eight-direction moves (diagonals cannot cut blocked corners). Layer changes cost a via and are allowed only where a via pad fits on all layers.
- Directional preference (horizontal on even layers, vertical on odd) reduces blocking.
- Connections are routed shortest first from the ratsnest. Each route is simplified to straight segments, its ends snapped to pad centres, and marked as an obstacle for later routes.
- It returns `{traces, vias, routed, failed, total}`. It adds to existing copper and never rips anything up.

### 7.6 Rendering

`CL.drawPCB(ctx, project, opts)` draws each copper layer on an off-screen canvas: pour first, other-net clearances cut out with `destination-out`, then tracks, pads and vias. The active layer is composited on top at higher opacity. `CL.boardTexture(project, side, pxPerMm)` paints one face for the 3D view: mask colour, copper visible through the mask, exposed pads in the finish colour, silkscreen and drill holes.

---

## 8. 3D viewer

`src/three3d.js` · class `CL.Board3D(container)`

- The board is a box `w × thickness × h`. Its top and bottom faces use canvas textures from `CL.boardTexture`; the edges are FR-4 coloured.
- `part(c, fp)` builds a model from `fp.body.kind`: `module` (dev boards on headers, with USB, chip and on-board LED), `lcd` (screen texture redrawn from the live LCD text), `servo` (horn follows the simulated angle), `relay`, `l298n`, `hcsr04`, `dht`, `pir`, `joystick`, `ldr`, `ntc`, `bridge`, `sot223`, `axial` (with resistor colour bands computed from the value), `diode`, `fuse`, `smdR`, `smdC`, `smdD`, `smdLED`, `ecap`, `inductor`, `disc`, `led`, `to92`, `to220`, `dip`, `header`, `terminal`, `tact`, `slide`, `pot`, `crystal`, `buzzer`, `sevenseg`, `mcuboard`.
- Models are positioned from `c.pcb`. Bottom-side parts are mirrored with `scale(−1, −1, 1)`.
- `setReadings(readings)` drives emissive intensity of LEDs, display segments and the MCU's D13 LED, plus a point light per through-hole LED.
- A small built-in orbit control handles mouse and touch. `view('iso'│'top'│'bottom')` resets the camera.

---

## 9. Export formats

All exporters live in `src/export.js` and return strings.

### 9.1 Gerber RS-274X (X2)

`CL.exportGerbers(project)` returns `{filename: content}`:

| File | Content | X2 FileFunction |
|---|---|---|
| `*-F_Cu.gtl` / `*-B_Cu.gbl` | Outer copper | `Copper,L1,Top` / `Copper,Ln,Bot` |
| `*-In1_Cu.g2` / `*-In2_Cu.g3` | Inner copper (4-layer) | `Copper,L2,Inr` / `Copper,L3,Inr` |
| `*-F_Mask.gts` / `*-B_Mask.gbs` | Solder mask openings (+0.05 mm per side) | `Soldermask,Top/Bot` (negative) |
| `*-F_Silkscreen.gto` / `*-B_Silkscreen.gbo` | Legend: outlines, references, board name | `Legend,Top/Bot` |
| `*-F_Paste.gtp` / `*-B_Paste.gbp` | SMD stencil (only if there are SMD pads) | `Paste,Top/Bot` |
| `*-Edge_Cuts.gm1` | Board outline, 0.1 mm line | `Profile,NP` |

Format: `%FSLAX46Y46*%`, millimetres, absolute coordinates, origin at the bottom-left board corner. Pads are flashed with circle, rectangle or obround apertures; tracks are drawn with circle apertures. Copper pours are a G36/G37 region, followed by clear-polarity (`%LPC*%`) flashes and draws for other-net items enlarged by the clearance, then dark polarity again.

### 9.2 Excellon drill

`*-PTH.drl`: metric, decimal coordinates, absolute, one tool per hole size, with an X2-style `FileFunction,Plated` comment. Contains component holes and vias.

### 9.3 Assembly files

- **BOM** (`*-BOM.csv`): `Item, Designator, Qty, Value, Description, Footprint`, grouped by part, value and footprint.
- **Pick and place** (`*-CPL.csv`): `Designator, Val, Package, Mid X, Mid Y, Rotation, Layer`, in mm from the bottom-left with counter-clockwise rotation. The column names match common assembly services.

### 9.4 Netlists

- **KiCad** (`*.net`): `(export (version "E") …)` s-expression with components, footprints and nets, using footprint pad numbers.
- **SPICE** (`*.cir`): R, C, L, D, Q, M, V, I, E and B elements with `.model` cards and a `.tran` line. Parts without a SPICE primitive (MCU, logic) become comments.

### 9.5 Design files

- Project JSON (§2), re-openable with the folder button.
- Schematic SVG in light colours, suitable for documents.

The **Fabrication package** zip contains every Gerber and drill file, the BOM, pick-and-place file and a `README.txt` with the board specification.

---

## 10. User interface

`src/app.js` is written with React hooks and `htm` tagged templates (`html\`<div>…</div>\``), so no JSX compiler is needed.

| Component | Role |
|---|---|
| `App` | Owns the project, undo history, mode, simulator and all panels |
| `SchematicView` | SVG editor: pan/zoom, placement ghost, wire drawing, rubber-band drag, net tooltips |
| `Palette` | Searchable component list with live symbol previews |
| `InspectorSch` | Properties, live readings, pins and nets, ERC summary |
| `PCBView` | Canvas editor: select, route, via and delete tools, layer switching |
| `LayersPanel` / `InspectorPCB` | Layer visibility, board setup, pours, routing actions; footprint, track and via properties |
| `View3D` / `Panel3D` | Three.js viewer and appearance options |
| `CodeView` / `ApiRef` / `PinTable` | Sketch editor, API reference, live pin states |
| `Scope`, `SerialPane`, Checks | Dock instruments |
| `ExportDialog` | File list, preview, copy, save and zip |
| `Tour` / `buildTourSteps` | In-app guided tour. Each step has `title`, `body`, optional `tip`, a `target` (CSS selector or function returning an element), the `mode` (tab) to show and an optional `before()` action. The spotlight follows the target every 200 ms; the card places itself beside, above or below it. Completion is stored in `localStorage` (`copperline.tour`). Targets use `data-tour` attributes where no stable class exists |

**State and history.** `commit(fn)` clones the project, applies `fn`, places any new footprints and pushes the previous project onto the undo stack. `live(id, patch)` updates interactive properties without history. Drags update the project on every move and push a single history entry when released.

**Persistence.** The project autosaves to `localStorage` (`copperline.project`) 700 ms after each change. Inside claude.ai, files are saved through the artifact `downloads` capability; when opened standalone, they download through a normal browser link.

**Theming.** Colours are CSS custom properties with light and dark sets that follow the system setting or a `data-theme` attribute. The PCB and 3D stages are always dark, as in desktop EDA tools.

---

## 11. Testing

```bash
node tests/run-tests.js
```

112 checks: device models against hand calculations (LED, RC, BJT and Darlington, 7805, AMS1117, LM317, NTC, LDR, relay, 555 frequency, LM393, bridge rectifier, RGB LED); every board blinks its LED; ATtiny85 power-up; board rules (ESP32 input-only pins, 12-bit ADC, Pico ADC resolution, AVR PWM pins, interrupt pins); every example sketch on its board; interrupts counting real button presses; HC-SR04 distance through `pulseIn` within 0.5 cm; every example autoroutes completely with zero DRC errors and a clean ERC; each example's behaviour (LCD text, servo angle, 4017 sequence, 595 patterns, night light, thermostat relay, tank steering, wrong I²C address warning); Gerber, drill, BOM and netlist structure. The process exits non-zero on failure, so it can run in CI.

For UI checks, serve the folder and drive it with Playwright. All interactive controls have stable `id`s or visible labels.

---

## 12. Extending Copperline

The [Claude skill](../skill/copperline-dev/SKILL.md) contains step-by-step recipes. In short:

- **New board:** add a profile to `boards.js` (§3.6) and include it in `CL.BOARD_LIST`. The symbol, footprint, simulator model and runtime are generated from it.
- **New component:** add a `def(...)` in `parts.js` with pins, symbol, properties, value text and footprint; add a `case` in `Sim.makeElement` if it conducts; add a 3D `body.kind` if no existing model fits; add a SPICE line in `exportSpice`; add a test.
- **New sketch function:** add it to `McuRuntime.api()`. If it must pause, define it as a generator in the prelude of `transpileSketch` and add its name to the set passed to `wrapCalls`.
- **New example:** add an entry to `CL.EXAMPLES` using the `builder` helpers (`add`, `w`), then run the tests to confirm it routes and passes DRC.
- **New export format:** write a pure function `(project) → string` in `export.js` and list it in `ExportDialog`'s `files`.
