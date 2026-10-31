# Copperline Studio

A browser-based electronics design suite. Draw a schematic, simulate it (including microcontroller firmware), lay out a multi-layer PCB, inspect it in 3D, and export manufacturing files — all in one page, with no install and no server.

Built with **React 18** for the interface and **Three.js** for the 3D board view. The circuit solver, sketch runtime, autorouter and Gerber writer are plain JavaScript with no dependencies.

---

## Features

| Area | What you get |
|---|---|
| **Schematic** | 69 components in 11 categories (including 8 microcontroller boards and a Sensors group), grid snapping, wire drawing with automatic corners, rubber-band dragging, junction dots, net labels and power ports, electrical rules check (ERC), undo/redo |
| **Simulation** | Modified nodal analysis with Newton–Raphson for non-linear parts and backward-Euler transient analysis. Diodes, LEDs, RGB LEDs, Zeners, bridge rectifiers, BJTs and Darlingtons, MOSFETs, op-amps, comparators, 555 timer, 78xx / LM317 / AMS1117 regulators, logic gates, 74HC595, CD4017, L298N motor driver, relays, servos, sensors, fuses, motors, lamps |
| **Instruments** | 4-channel oscilloscope, voltmeter, ammeter, live voltage on hover, wire colouring by voltage |
| **Microcontrollers** | Arduino Uno R3, Arduino Nano, Arduino Mega 2560, ESP32 DevKit V1, Raspberry Pi Pico, STM32 Blue Pill and a bare ATtiny85, each with its real pin names, logic level, ADC resolution, PWM pins and interrupt pins. They run Arduino-style sketches with `Servo`, `LiquidCrystal_I2C`, `DHT` and `Wire`, `attachInterrupt`, `pulseIn`, `shiftOut`, `tone`, `Serial.printf`, plus ESP32 `ledcWrite` and `dacWrite` |
| **PCB** | 2- or 4-layer boards, footprints generated from the schematic, ratsnest, manual 45° routing, vias, copper pours, maze autorouter, design rules check (DRC) |
| **3D** | Real-time board model: solder mask colours, ENIG/HASL finish, board thickness, component bodies with resistor colour bands, LEDs that light up during simulation |
| **Guided tour** | 16-step interactive walkthrough inside the app: spotlights each area, switches tabs, starts the simulation and suggests something to try at every step. Offered on first visit; replay from the **Tour** button |
| **Export** | Gerber RS-274X with X2 attributes (copper, mask, silkscreen, paste, outline), Excellon drill, BOM CSV, pick-and-place CSV, KiCad netlist, SPICE netlist, schematic SVG, project JSON, one-click fabrication zip |

---

## Parts library

| Group | Parts |
|---|---|
| Passive | Resistor, Capacitor, Electrolytic, Inductor, Potentiometer, Crystal, Fuse |
| Semiconductor | Diode (1N4148 / 1N4007 / 1N5819), Zener, LED (6 colours), RGB LED, Bridge rectifier, NPN (2N3904 / 2N2222 / BC547 / TIP120), PNP (2N3906 / BC557 / TIP125), N-MOSFET (2N7000 / IRLZ44N / IRF540N), P-MOSFET (BS250 / IRF9540N) |
| Sources | DC supply, Battery, AC source, Function generator, Current source, Ground, Power port, Net label, No-connect marker |
| Integrated | Op-amp LM358, Comparator LM393, 555 timer, Regulator 78xx, LM317, AMS1117, Motor driver L298N |
| Logic | AND, NAND, OR, NOR, XOR, NOT, Shift register 74HC595, Decade counter CD4017 |
| Microcontroller | Arduino Uno R3, Arduino Nano, Arduino Mega 2560, ESP32 DevKit V1, Raspberry Pi Pico, STM32 Blue Pill, ATtiny85, Mini AVR board (older projects) |
| Input | Toggle switch, Push button, Joystick module |
| Sensors | Light sensor (LDR), NTC thermistor, DHT22 temperature & humidity, HC-SR04 ultrasonic, PIR motion |
| Output | Lamp, DC motor, Buzzer, 7-segment display, Relay (SPDT), Servo SG90, 16×2 LCD (I²C) |
| Instruments | Voltmeter, Ammeter, Scope probe |
| Connector | Pin headers 1×2, 1×4, 1×6 |

### Example projects

| Example | Shows |
|---|---|
| Junction controller | Mini AVR board, traffic lights, button, potentiometer, PWM fan |
| Astable multivibrator | Two-transistor oscillator |
| Inverting amplifier + filter | Op-amp with ±12 V rails and an RC low-pass |
| Half adder | Logic gates |
| 7-segment counter | MCU driving a display |
| 555 + 4017 LED chaser | Timer clocking a decade counter, 10 LEDs |
| Parking sensor (Arduino Uno) | HC-SR04 + `pulseIn`, servo barrier, buzzer `tone`, I²C LCD |
| Weather station (ESP32) | DHT22, light sensor on a 12-bit ADC, I²C LCD, `Serial.printf` |
| Shift-register LED bar (Pico) | 74HC595 via `shiftOut`, button on an interrupt |
| Night light (ATtiny85) | Bare chip on a 5 V supply, LDR, PWM LED |
| Thermostat with relay (Nano) | NTC thermistor, transistor-driven relay with flyback diode, 12 V lamp |
| Joystick tank drive (Blue Pill) | Joystick, L298N H-bridge, two motors |

## Quick start

### Option A · Docker (recommended)

Requires Docker with the Compose plugin (Docker Desktop on Windows/macOS, or Docker Engine on Linux).

```bash
cd copperline-studio
docker compose up -d --build
```

Open <http://localhost:7777>. The first build takes a minute or two.

The image runs the test suite during the build and refuses to build if any test fails. It bundles React, Three.js, htm and JSZip inside the image, so the running app works without internet access; only Google Fonts falls back to system fonts when offline. It is served by nginx with gzip, caching headers and a `/healthz` endpoint, from a read-only container.

| Task | Command |
|---|---|
| Start (build if needed) | `docker compose up -d --build` |
| View logs | `docker compose logs -f copperline` |
| Stop | `docker compose down` |
| Rebuild after changing code | `docker compose up -d --build` |
| Use another port | `COPPERLINE_PORT=9000 docker compose up -d` (or copy `.env.example` to `.env`) |
| Live-edit mode (serves the folder as is, refresh to see changes) | `docker compose --profile dev up dev` → <http://localhost:7778> |
| Run the tests in a container | `docker compose --profile test run --rm tests` |
| Check health | `curl http://localhost:7777/healthz` |

Without Compose:

```bash
docker build -t copperline-studio .
docker run -d --name copperline -p 7777:80 copperline-studio
```

To run it on a server for others, put it behind your usual reverse proxy (Caddy, Traefik, nginx) with HTTPS. The app is entirely client-side; each user's work stays in their own browser.

### Option B · Any static web server

The app is a static site. Any web server works; it needs internet access only to load React, Three.js, htm and JSZip from public CDNs.

```bash
# Python
python3 -m http.server 7777

# or Node
npx serve -l 7777 .
```

Open <http://localhost:7777>. The app starts with the **Junction controller** example loaded and offers a **guided tour** in the corner. Press **Start the tour**, or press **Simulate** and explore on your own. The **Tour** button in the top bar replays it any time.

> Opening `index.html` directly from disk (`file://`) also works in most browsers, but some block local scripts. Use a server if the page stays blank.

### Run the engine tests

```bash
node tests/run-tests.js
```

The suite (112 checks) verifies the simulator and each device model against hand-calculated results, blinks every microcontroller board, runs every example sketch, checks the libraries (servo angle, LCD text, ultrasonic distance within 0.5 cm, interrupts), autoroutes every example with zero DRC errors and a clean ERC, checks each example's behaviour and validates the exported files. Node 18 or newer is required; there are no packages to install.

---

## Project layout

```
copperline/
├── index.html              Page shell, styles and script tags
├── Dockerfile              Two-stage build: test + bundle libraries, then nginx
├── docker-compose.yml      App service, plus dev and test profiles
├── docker/nginx.conf       nginx site configuration
├── .env.example            Port overrides for Compose
├── src/
│   ├── core.js             SI-unit parsing, geometry helpers, stroke font for silkscreen
│   ├── boards.js           Microcontroller board registry: pins, power, ADC, PWM, footprints
│   ├── parts.js            Component library: symbols, properties, footprints
│   ├── netlist.js          Turns wires and pins into nets; ERC
│   ├── sim.js              MNA circuit solver and device models
│   ├── mcu.js              Sketch translator, MCU runtime, example sketches
│   ├── pcb.js              Pads, connectivity, ratsnest, DRC, autorouter, 2D renderer
│   ├── export.js           Gerber, Excellon, BOM, pick-and-place, KiCad and SPICE netlists
│   ├── three3d.js          Three.js board viewer
│   ├── examples.js         Example projects and automatic placement
│   └── app.js              React interface
├── tests/run-tests.js      Engine test suite (Node)
├── docs/
│   ├── TOUR.md             Guided walkthrough for new users
│   └── DOCUMENTATION.md    Architecture, data model and reference
└── skill/copperline-dev/
    └── SKILL.md            Claude skill for extending the project
```

Scripts load in the order listed in `index.html`. Every engine module attaches to a single global, `window.CL`, so the same files run in the browser and in Node.

---

## Documentation

- **[Guided tour](docs/TOUR.md)**: a 20-minute hands-on walkthrough from first schematic to Gerber files.
- **[Technical documentation](docs/DOCUMENTATION.md)**: architecture, project file format, component authoring, simulator internals, sketch language, PCB engine and export formats.
- **[Claude skill](skill/copperline-dev/SKILL.md)**: instructions Claude follows when adding components, sketch functions, examples or export formats.

---

## Keyboard shortcuts

| Key | Schematic | PCB |
|---|---|---|
| `Space` | Run / pause simulation | Run / pause simulation |
| `W` | Wire tool | |
| `X` | | Route tool |
| `R` | Rotate part | Rotate footprint |
| `F` | Fit view | Flip footprint to other side (or fit view) |
| `V` | | Drop a via and switch layer while routing |
| `L` | | Next copper layer |
| `Del` | Delete selection | Delete selected track or via |
| `Ctrl D` | Duplicate part | |
| `Ctrl Z` / `Ctrl Y` | Undo / redo | Undo / redo |
| `Esc` | Cancel placement or finish wire | Finish route |
| `Ctrl Enter` | Upload sketch (Code tab) | |

---

## Known limitations

- **Firmware** runs as translated Arduino-style C on simulated time, not as machine code for each chip. Integer division follows JavaScript rules; use `floor()` where it matters. `Serial` input, timers/registers, `String` methods (other than `.length()`) and libraries beyond Servo, LiquidCrystal_I2C, DHT and Wire are not available.
- **Bus-level peripherals**: the I²C LCD and DHT22 are linked to the sketch by checking the wiring (SDA/SCL or DATA on the right board pins, module powered) rather than by simulating individual bus bits. Servos, the HC-SR04, shift registers and counters are fully electrical: they react to real pin voltages.
- **Footprints**: Nano, Pico, ESP32 DevKit (30-pin), Blue Pill and ATtiny85 footprints follow the published pinouts; Uno and Mega use a compact header layout, not the shield outline. Relay, L298N and sensor-module footprints are generic. Check every module footprint against your actual part before ordering a PCB.
- **Simulation** uses backward Euler, which slightly damps fast oscillations. Op-amps are behavioural (rail-clamped, no slew rate); the regulator draws no quiescent current.
- **Autorouter** is a single-pass grid maze router (0.25 mm grid) without rip-up-and-retry. Dense boards may leave a few connections for manual routing.
- **DRC** approximates rectangular pads as capsules, which is slightly lenient at pad corners.
- **3D** export (STEP/VRML) is not included; the 3D view is for inspection.
- **Storage**: work autosaves to the browser's local storage. Use *Export → project JSON* to keep or move a design.

---

## Browser support

Current Chrome, Edge, Firefox and Safari. The 3D view needs WebGL. Touch input works for panning, pinch zoom and placing parts; the full editor is designed for a mouse and keyboard.
# circuit-design
