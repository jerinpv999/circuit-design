# Copperline Studio — Guided Tour

This tour takes about 20 minutes. You'll explore the example project, build a small circuit from scratch, program a microcontroller, lay out the board and export files a manufacturer can build from.

Each stop says **what to do**, then **what to look for**.

> **Prefer an in-app walkthrough?** The app offers a 16-step interactive tour on your first visit, and the **Tour** button in the top bar replays it. It highlights each area, switches tabs and starts the simulation for you. Use `→`/`←` to move between steps and `Esc` to leave. This document goes further, including building a circuit from scratch.

---

## Stop 1 · Get your bearings

Open the app. You'll see five areas:

```
┌──────────────────────── Top bar ───────────────────────────────┐
│ Logo │ Schematic · PCB · 3D · Code │ Simulate ■ clock │ … Export │
├──────────┬───────────────────────────────────┬────────────────┤
│ Left     │                                   │ Right          │
│ panel    │            Stage                  │ inspector      │
│ (palette │   (schematic, board, 3D or code)  │ (properties,   │
│ / layers)│                                   │  readings)     │
├──────────┴───────────────────────────────────┴────────────────┤
│ Dock: Oscilloscope · Serial monitor · Checks                   │
└────────────────────────────────────────────────────────────────┘
```

- The **tabs** switch between four views of the *same* design. A part added on the schematic appears on the PCB and in 3D automatically.
- The **left panel** changes with the tab: component palette, layer list, board appearance or sketch reference.
- The **inspector** on the right shows whatever is selected.
- On a phone, the two side panels open from the ☰ and ▯ buttons in the top bar.

**Look for:** the *Junction controller* example is already loaded: a microcontroller running a traffic light, a push button, a potentiometer and a PWM fan driver.

---

## Stop 2 · Run the simulation

1. Press **Simulate** (or `Space`).
2. Watch the three LEDs cycle green → amber → red → red + amber.
3. In the dock, the **Oscilloscope** shows two traces: CH1 is the PWM signal on pin D9, CH2 is the motor transistor's collector.
4. Hover any wire. A tooltip shows its net name and live voltage.
5. Wires change colour with voltage: teal near 0 V, copper at the highest voltage in the circuit.

**Try it:**
- Click the **push button** (SW1) while green is lit. The light changes early and the **Serial monitor** prints `Pedestrian request`.
- Select the **potentiometer** (RV1) and drag the *Wiper* slider in the inspector. Green lasts longer or shorter, and the PWM duty on the scope changes.
- The clock in the top bar shows simulated time and whether the simulation keeps up with real time. Use the **speed** menu (×0.001 to ×10) to slow down fast signals.

Press **■** to stop and reset.

---

## Stop 3 · Build a circuit from scratch

Press the **+** button (New project) in the top bar. You now have an empty sheet. Undo (`Ctrl Z`) brings the example back if you need it.

1. In the palette, open **Sources** and click **Battery**. Move the mouse onto the sheet; a ghost follows the cursor. Click to place it.
2. Click **Resistor** (Passive). Press `R` once to rotate it before placing, or leave it horizontal. Click to place.
3. Place an **LED** (Semiconductor) and a **Ground** symbol (Sources).
4. Wire them up:
   - Click the battery's **+** pin. A dashed wire follows the cursor.
   - Click the resistor's left pin. The wire finishes because it landed on a pin.
   - Connect resistor → LED anode, LED cathode → ground, ground → battery **−**.
   - To add a corner, click an empty grid point; double-click or press `Esc` to end a wire anywhere.
5. Check the **Electrical rules** box in the inspector. It reads *clean* once every pin is connected and there is a ground.
6. Press **Simulate**. The LED glows. Select it to see its voltage, current and brightness.

**Experiment:**
- Select the resistor and change *Resistance* to `100` (press Enter). The LED gets brighter. Try `10k`.
- Change the LED *Colour* to blue. Its forward voltage rises to about 3 V.
- Add a **Fuse** in series with a `5` Ω resistor and watch it blow.

> Values accept SI prefixes: `4.7k`, `100n`, `2.2u`, `1M`, `10m` (milli). Units are optional.

---

## Stop 4 · Measure with the oscilloscope

1. Load **Examples → Astable multivibrator**. Press **Simulate**.
2. Two LEDs flash alternately. The scope shows the classic waveform: CH1 (collector) jumps between 0 and 9 V; CH2 (base) dips negative and recovers along an RC curve.
3. Change the scope **Window** to `5 s` to see several periods.
4. Select capacitor **C1** and change it from `10u` to `22u`. The simulation restarts and the period gets longer.

**To probe your own circuit:** place a **Scope Probe** (Instruments) so its tip sits on a wire end, a wire corner or a pin. Change its trace colour in the inspector. Up to four channels look good.

---

## Stop 5 · Program the microcontroller

1. Reload the **Junction controller** example and open the **Code** tab.
2. The editor holds the sketch running on U1. The left panel lists the available functions; the right panel is a live **pin monitor**.
3. Choose **Load example sketch → Blink** and press **Upload & run** (or `Ctrl Enter`).
4. Only the green LED (D13) blinks now, and the pin monitor shows D13 toggling between OUT high and low.
5. Change `delay(500)` to `delay(100)` and upload again.

**Write your own:** replace the sketch with this and upload:

```c
void setup() {
  pinMode(11, OUTPUT);
  pinMode(12, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int level = analogRead(A0);          // potentiometer, 0–1023
  analogWrite(11, level / 4);          // red LED brightness follows the knob
  digitalWrite(12, level > 512 ? HIGH : LOW);
  Serial.println(level);
  delay(100);
}
```

Turn the potentiometer from the schematic inspector and watch the red LED dim, the amber LED switch at half-way, and the numbers stream into the Serial monitor.

If the sketch has a mistake, the status line under the editor shows the compile error and nothing is uploaded.

---

## Stop 6 · Lay out the PCB

Open the **PCB** tab.

1. Every component with a physical package has a **footprint**. Thin white lines (the *ratsnest*) show connections that still need copper.
2. The example is already routed. Press **Clear tracks** to start over; the ratsnest returns.
3. **Route by hand:**
   - Press `X` (or the **Route** button). Pick the **F** (top) layer in the toolbar.
   - Click a pad. The track's net comes from that pad, and every pad on the same net is outlined.
   - Click to add corners; segments snap to 45°. Click a pad on the same net to finish.
   - While routing, press `V` to drop a via and continue on the bottom layer. `L` switches layer without a via.
4. **Autoroute** the rest. The status message reports how many connections were routed.
5. **Run DRC.** The *Checks* tab lists clearance problems, shorts, unrouted nets and parts off the board, and red crosses mark them on the board.

**Other things to try:**
- Drag a footprint; `R` rotates it, `F` flips it to the bottom side.
- In **Board setup**, switch to **4 layers**. Inner layers In1 and In2 appear in the layer list and the autorouter can use them.
- Set **Copper pours → F.Cu** to `GND`. The top layer floods with ground copper that keeps clear of other nets.
- Toggle layer visibility with the eye icons.

---

## Stop 7 · Inspect in 3D

Open the **3D** tab.

- Drag to orbit, right-drag (or Shift-drag) to pan, scroll to zoom. **Top** and **Bottom** buttons give straight-on views.
- Pick a **solder mask** colour, **ENIG** gold or **HASL** tin finish, board thickness and silkscreen colour.
- Read the colour bands on each resistor; they match the schematic values.
- Start the simulation and come back. The LEDs on the 3D board light up in step with the circuit.

---

## Stop 8 · Export for manufacturing

1. Press **Export** in the top bar.
2. The left column lists every generated file; click one to preview it on the right.
   - **Fabrication:** Gerber files for each copper layer, solder mask, silkscreen, paste (if there are SMD parts) and board outline, plus the Excellon drill file.
   - **Assembly:** bill of materials and pick-and-place CSV.
   - **Netlists:** KiCad `.net` and SPICE `.cir`.
   - **Design files:** the project JSON and a schematic SVG.
3. Press **Fabrication package (.zip)**. The zip contains Gerbers, drill, BOM, pick-and-place and a README with the board specification. Upload it to your PCB manufacturer's quote page.
4. Save the **project JSON** to keep your design. Open it later with the folder button in the top bar.

**Before ordering:** run DRC with zero errors, check the Gerbers in your manufacturer's online viewer, and confirm the board size and layer count on their order form match the README in the zip.

---

## Stop 9 · Try the other microcontrollers

1. Load **Examples → Weather station (ESP32)** and press **Simulate**. The LCD shows the DHT22's temperature and humidity and the light level read by the ESP32's 12-bit ADC.
2. Select the DHT22 and drag its **Temperature** slider; the LCD follows within a second. Drag the light sensor's **Light level** too.
3. Open the **Code** tab. The left panel now describes the ESP32: its pins, ADC, PWM and extras such as `dacWrite` and `ledcWrite`. The sketch menu lists the examples for this board first.
4. Load **Parking sensor (Arduino Uno)**, select the HC-SR04 and slide **Distance** below 30 cm. The servo raises the barrier, the buzzer beeps and the LCD shows the distance that `pulseIn` measured.
5. **Night light (ATtiny85)** uses a bare chip: it only runs because the 5 V supply is wired to its VCC pin. Delete that supply and the chip shows **NO POWER**.

To use a board in your own design, place it from the **Microcontroller** group. Each one starts with a Blink sketch that works on every board.

## Where next

- Load the other examples: **555 + 4017 LED chaser**, **Shift-register LED bar (Pico)**, **Thermostat with relay (Nano)**, **Joystick tank drive (Blue Pill)**, **Inverting amplifier + filter**, **Half adder**, **7-segment counter**.
- Read [DOCUMENTATION.md](DOCUMENTATION.md) for the simulator models, sketch language and file formats.
- Add your own component with the [Claude skill](../skill/copperline-dev/SKILL.md).
