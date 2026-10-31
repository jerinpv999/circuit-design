---
name: copperline-dev
description: Use when adding to or fixing Copperline Studio, the browser EDA app (React + Three.js) — new components, footprints, simulator models, Arduino-style sketch functions, example projects, PCB/DRC/autorouter changes or export formats — then testing and shipping it.
---

# Copperline Studio development

Copperline is a static web app: `index.html` + `src/*.js`, no build step. Engine modules attach to one global, `CL`, and run unchanged in Node. Read `docs/DOCUMENTATION.md` for the full reference; this skill is the working checklist.

## Ground rules

1. **Keep the engines DOM-free.** Only `app.js`, `three3d.js`, `CL.drawPCB` and `CL.boardTexture` may touch `document` or `window`. Everything else must `require()` cleanly in Node.
2. **The project object is the single source of truth.** Never store derived data (nets, pads, ratsnest) in it. Every field must survive `JSON.stringify`.
3. **Pin order is a contract.** `def.pins` order is used by the netlist, the simulator (`nd[i]`), footprint pads (`pad.pin`) and SPICE export. Never reorder pins of an existing component; saved projects depend on it.
4. **No new dependencies or build tools.** Libraries load as UMD scripts from cdnjs in `index.html`, pinned to exact versions.
5. **Run `node tests/run-tests.js` before and after every change.** It must end with `0 failed`.

## Orientation

| File | Edit it to… |
|---|---|
| `src/boards.js` | add or change microcontroller boards (pins, power, ADC, PWM, interrupts, footprint) |
| `src/parts.js` | add or change components, symbols, properties, footprints |
| `src/sim.js` | add device models (`makeElement` switch) or change the solver |
| `src/mcu.js` | extend the sketch language, API or example sketches |
| `src/netlist.js` | change connection rules or ERC |
| `src/pcb.js` | pads, connectivity, DRC, autorouter, 2D rendering |
| `src/export.js` | Gerber, drill, BOM, CPL, netlist formats |
| `src/three3d.js` | 3D component models |
| `src/examples.js` | example projects |
| `src/app.js` | user interface (React + htm templates) |

Coordinates: schematic in grid units (1 grid = 10 px in symbol drawings), Y down, rotation clockwise via `CL.rotQ`. PCB in millimetres, origin top-left in the editor; exporters flip Y to a bottom-left origin.

## Recipe: add a component

1. **Define it** in `src/parts.js` next to similar parts:
   ```js
   def('photoresistor', {
     name: 'Photoresistor (LDR)', cat: 'Passive', prefix: 'R',
     pins: H2,                                   // [{n:'1',x:-3,y:0},{n:'2',x:3,y:0}]
     props: { dark: '1M', light: '1k', level: 0.5 },
     meta: {
       dark:  { label: 'Dark resistance',  unit: 'Ω', kind: 'si' },
       light: { label: 'Light resistance', unit: 'Ω', kind: 'si' },
       level: { label: 'Light level', kind: 'range', live: true }   // live = no restart, no undo entry
     },
     val: c => 'LDR',
     draw: (c, st) => `<path class="s" d="M-30 0H-12M12 0H30"/><rect class="b" x="-12" y="-6" width="24" height="12" rx="6"/>`,
     fp: () => FP.axial(5.08, 4, 5, 'disc')        // reuse a generator; see CL.FP
   });
   ```
   - Pins sit on integer grid points; draw leads from each pin to the body.
   - Use theme classes only (`s`, `f`, `b`, `t`, `pinlbl`, `acc`, `glow`); never hard-code colours that fail in dark mode, except deliberate ones (LED colours, display segments).
   - Use `virtual: true, fp: null` for parts with no physical package. Use `net: c => 'NAME'` for parts that force a net name.
   - If the default bounding box is wrong (tall ICs, odd shapes), add an entry to `SPECIAL_BOX` in `app.js`.
2. **Simulate it** in `src/sim.js` → `makeElement` switch. Patterns:
   - Linear: `return resistorLike(() => R)` (optionally override `read()`).
   - Stateful: `{ stamp(dt, t), accept(dt, t), read() }` using `sim.addG / addI / addV / addA / addB`. Read properties through `P()` so live edits apply without a rebuild.
   - Needs a branch current: `const k = newBranch();` then `sim.addV(p, n, k, volts)`.
   - Non-linear: set `nl: true`. Stamp the linearised model; if you limit a junction voltage, set `sim.limited = true` whenever the limited value differs, or Newton–Raphson may stop early.
   - Return `null` for parts that don't conduct (labels, probes, headers).
   - `read()` feeds the inspector and `draw(c, st)`; common keys are `v, i, p, bright, on, angle`.
3. **3D model:** if no existing `body.kind` fits, add a `case` in `Board3D.part()` (`three3d.js`). Build at the footprint origin, Y up, base at `y = 0`, millimetres. Register glowing parts in `this.leds`.
4. **SPICE:** add a `case` to `CL.exportSpice` with the letter in the `ltr` map.
5. **Values in the BOM** come from `val(c)`; footprint names from `fp(c).name`.
6. **Test:** add a check in `tests/run-tests.js` that builds a small circuit with the part and asserts a hand-calculated reading.
7. **Check the UI:** the part appears in its palette category automatically. Place it, wire it, simulate, open PCB and 3D.

## Recipe: add a microcontroller board

1. Add a profile in `src/boards.js` with `add({...})` and list its `type` in `CL.BOARD_LIST`. Copy the closest existing board and change:
   - `left` / `right`: pin names on the symbol, top to bottom. Use the names people see on the board's silkscreen; same-named pins (two `GND`) are tied together automatically.
   - `pinName(n)` and, if channels differ from pin numbers, `analogPin(n)`; `constants` for `LED_BUILTIN`, `A0`… and any named pins.
   - `logic`, `logicPin`, `supplies` (pins that output a voltage) or `selfPowered: false` + `minV` for a bare chip.
   - `adc`, `pwm` (array or `'all'`), `inputOnly`, `noDigital`, `dac`, `interrupts` (array indexed by interrupt number, or `'any'`), `i2c`, `led` / `ledActiveLow`, `features` (`'res'`, `'ledc'`, `'dac'`).
   - `footprint.cols`: header columns with pad names top to bottom ('' leaves a gap); set `dip: true` for DIP numbering. Names not on the symbol (RESET, AREF) become unconnected pads; `alias` maps duplicates (SDA → A4).
   - `body`: `{ kind: 'module', w, l, color, usb, chip, label }` for dev boards.
2. Nothing else is required: the symbol, footprint, simulator element (`makeBoard`) and runtime come from the profile. Check the palette preview, place it, and run Blink.
3. Add a test: the Blink loop in `tests/run-tests.js` covers every board in `CL.BOARD_LIST` automatically; add rule checks (input-only pins, ADC resolution) if the board has quirks.

## Recipe: add a library

Library classes live in `McuRuntime.api()` (`Servo`, `LiquidCrystal_I2C`, `DHT`). Add the class there, add its name to `LIB_CLASSES` in `src/mcu.js` so `MyLib obj(args);` declarations are translated, and decide how it reaches the circuit:
- **Electrical** (preferred): drive pins through `st(pin)` (`pwm`, `freq`, `level`), as `Servo` does.
- **Bus-level**: expose a query on the `io` object in `Sim.makeBoard` and have the peripheral element register itself (`sim.lcds`, `sim.dhts`), matching nets with `el.netOf(pinName)`.

## Recipe: add a sketch function

- Plain function: add it to the object returned by `McuRuntime.api()` in `src/mcu.js`. Validate pins with `self.pin(p, 'name')`, which throws a readable error for pins not on the board.
- Function that waits (like `delay`): define it as a generator in the prelude string at the end of `transpileSketch`, yielding milliseconds, and add its name to the `Set` passed to `wrapCalls`.
- New C syntax: add a regex step in `transpileSketch` *before* the type-to-`let` replacement. Re-run all example sketches through the tests.
- Generators that must wait for real edges (`pulseIn`, `shiftOut`) go in `PRELUDE` and in `GENERATORS`; `yield 0` waits exactly one simulation step.
- Update the API list in `ApiRef` (`app.js`) and section 6 of `docs/DOCUMENTATION.md`.

## Recipe: add an example project

```js
CL.EXAMPLES.mything = {
  name: 'My thing', desc: 'One-line description',
  build() {
    const { p, add, w } = builder('My thing');
    add('battery', 0, 0, { voltage: '9' });
    add('resistor', 3, -3, { resistance: '470' });      // pins (0,-3) and (6,-3): (0,-3) meets battery +
    add('led', 9, -3, { color: 'green' });              // pins coincide with the resistor at (6,-3)
    w([12, -3], [12, 3], [0, 3]);                       // wire endpoints must land on pins or wires
    add('ground', 0, 3);
    p.sim = { dt: 1e-4, timebase: 0.05 };
    return p;
  }
};
```

- The builder gives you `lbl(part, pinName, net)` (a net label pointing away from the part, or a ground symbol for a downward GND pin) and `nc(part, pinName)` (no-connect marker). Label-based examples are quicker to write and stay readable.
- Compute pin positions from the def (`CL.pinPos`); a wire passing through a pin mid-segment does **not** connect.
- The tests require a clean ERC for every example: mark unused IC pins with `nc`.
- Leave at least 6–8 grid units between parallel vertical parts so labels don't collide.
- The tests autoroute every example and require 100 % routing and zero DRC errors. If routing fails, spread parts in the schematic (placement follows schematic positions) or adjust `autoPlace`'s scale.

## Recipe: add an export format

1. Write a pure function `CL.exportThing = function (project) { … return string; }` in `src/export.js`. Use `CL.buildNetlist`, `CL.boardPads` and `CL.silkItems` rather than recomputing geometry. Remember the Y flip (`H - y`).
2. Add it to the `files` list in `ExportDialog` (`app.js`) with a group name. Inside claude.ai, only `csv json svg txt md html zip` save directly; other extensions are zipped automatically.
3. Add a structural check to the test suite and a row to section 9 of the documentation.

## Changing the PCB engine

- DRC and the autorouter both treat pads as capsules (`padCapsule`). Keep them consistent.
- The autorouter marks obstacles with `markCapsule`/`markPad` and inflates by `clearance + trackWidth/2`. If you change track width rules, change the inflation too, then confirm every example still routes with zero DRC errors.
- New layers must be added to `CL.copperLayers`, `CL.LAYER_COLORS`, the Gerber filename map in `exportGerbers` and the visibility state in `App`.

## Verifying a change

1. `node tests/run-tests.js` reports `0 failed`.
2. Serve the folder (`python3 -m http.server`) and open it. Check the browser console for errors.
3. Walk the affected tab: place, wire, simulate, PCB, autoroute, DRC, 3D, export.
4. Check light and dark themes, and a 400 px wide window for anything that overflows.
5. Update `README.md` (features, limitations) and `docs/DOCUMENTATION.md` for anything user-visible. If you add or move a major UI area, update `buildTourSteps` in `app.js` so the guided tour still points at it (add a `data-tour` attribute rather than relying on fragile selectors), then click through the tour once.

## Common pitfalls

- Calling `setState` inside a `setProject` updater: create objects first, then `commit(p => p.components.push(obj))` and `setSel(...)` separately.
- `localStorage` may throw in private windows; always go through the `store` helper.
- Inside claude.ai, `alert`, `confirm`, `prompt`, `window.print` and `<a download>` do nothing; use in-page UI and the `downloads` capability (already wired into `ExportDialog`).
- Three.js materials can be arrays (`Array.isArray(o.material)`); dispose accordingly.
- The simulator rebuilds only when `topoKey` changes. If a new property changes the circuit's structure (not just a value), add it to `topoKey` in `app.js`.
