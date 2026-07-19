# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Build (produces executable JAR in target/)
mvn clean package

# Build without tests
mvn package -DskipTests

# Run all tests
mvn test

# Run a single test class
mvn test -Dtest=BasicJobTest

# Run a specific test method
mvn test -Dtest=BasicJobTest#testSimpleJob

# Run checkstyle validation (enforced during build)
mvn validate
```

The main class is `org.openpnp.Main`. Java 11 is required (CI also tests 17 and 19).

### Example Run Command on Windows

When using Java 23, OpenPnP currently needs module opens for startup reflection and AWT access:

```bash
"C:/Program Files/Eclipse Adoptium/jdk-23.0.1.11-hotspot/bin/java" --add-opens=java.base/java.lang=ALL-UNNAMED --add-opens=java.desktop/java.awt=ALL-UNNAMED --add-opens=java.desktop/java.awt.color=ALL-UNNAMED -jar "F:/Data/Sandbox/openpnp/target/openpnp-gui-0.0.1-alpha-SNAPSHOT.jar"
```
or with a  specific configuration directory
```bash
"C:/Program Files/Eclipse Adoptium/jdk-23.0.1.11-hotspot/bin/java" --add-opens=java.base/java.lang=ALL-UNNAMED --add-opens=java.desktop/java.awt=ALL-UNNAMED --add-opens=java.desktop/java.awt.color=ALL-UNNAMED -DconfigDir="F:/Data/Sandbox/openpnp-settings" -jar "F:/Data/Sandbox/openpnp/target/openpnp-gui-0.0.1-alpha-SNAPSHOT.jar"
```

Omit or change `-DconfigDir` as needed. If present, it must appear before `-jar`.

## Code Style

Checkstyle enforces these rules (checked during `mvn validate`):

- **Line endings:** LF only (no CRLF) — critical on Windows
- **Braces:** Always required (`NeedBraces`) — no braceless `if`/`for`
- **One statement per line**
- **Naming:** `camelCase` for methods/variables/members, `PascalCase` for types
- **Formatter:** `OpenPnP_Eclipse_Formatter.xml` is provided for Eclipse

Checkstyle excludes `org/openpnp/model/eagle/xml/*` (generated) and `org/openpnp/machine/neoden4/Neoden4CameraDriver*` (native DLL names).

## Architecture Overview

OpenPnP is a Swing desktop application for controlling SMT pick-and-place machines. It uses a layered architecture:

### Core Layers

**`org.openpnp.spi`** — Service Provider Interfaces: abstract hardware contracts (`Machine`, `Head`, `Camera`, `Nozzle`, `Feeder`, `Driver`, `Actuator`). `spi.base` has abstract base classes. All hardware is accessed through these interfaces.

**`org.openpnp.machine.reference`** — The primary machine implementation (`ReferenceMachine`). Most hardware logic lives here. Other `machine.*` packages (neoden4, photon, rapidplacer, pandaplacer) extend or override this.

**`org.openpnp.model`** — XML-serialized data models: `Job`, `Board`, `Placement`, `Part`, `Package`, `Location`. `Configuration` is the central singleton that loads/saves all config from `~/.openpnp2/`.

**`org.openpnp.gui`** — Swing panels and frames. `MainFrame` is the root window; each tab corresponds to a panel class (e.g., `JobPanel`, `FeedersPanel`, `MachineSetupPanel`). GUI components bind to models via `BeansBinding`.

**`org.openpnp.vision`** — OpenCV integration. `CvPipeline` runs a configurable list of `CvStage` instances, each transforming an OpenCV `Mat`. Pipelines are defined in XML and used for fiducial detection, part alignment, and inspection.

### Configuration Singleton

`Configuration.get()` is the entry point for everything. It owns the `Machine` instance, parts/packages/boards libraries, and vision settings. It's initialized before the GUI starts and fires `ConfigurationListener` events when loaded.

### Job Execution Flow

`JobProcessor` / `PnpJobProcessor` drives the placement sequence: detect board fiducials → for each placement: pick from feeder → bottom vision alignment → place on board. Motion commands flow through `Driver` (typically `GcodeDriver`) which translates abstract commands to machine-specific G-code.

### Vision Pipeline

`CvPipeline` is stage-based; stages are composable and XML-configured. Stages produce named results (e.g., `results`, `circles`, `rotatedRects`) consumed by downstream stages or the calling code. Pipelines are embedded in vision settings on `Part`, `Feeder`, and `Camera` objects.

### Compatibility Follow-Up

Investigate making configuration loading tolerant of unknown vision pipeline stages or parameters. A custom build can save `machine.xml` entries for new stages such as `org.openpnp.vision.pipeline.stages.DetectQrCode`; older/mainstream OpenPnP builds that do not contain the class fail while deserializing the config. Consider whether `CvPipeline` / Simple XML loading can skip unknown stages with a warning, preserve them for round-trip saving, or otherwise degrade gracefully instead of requiring users to delete configs.

## Current State Notes - 2026-06-09

- KiCad footprint import work is committed. Recent relevant commits:
  - `3a2d848e Support multiline KiCad footprints`
  - `305600c6 Infer KiCad footprint body extents`
  - `e2ea3284 Restore nozzle rotation after alignment test`
  - `cf1c7a82 Improve body vision compositing reachability`
  - `4457502b Add bottom vision compositing diagnostics`
  - `78d4b74e Add automatic bottom vision pre-rotate mode`
- A temporary branch `PostPlacelift` was used to test hard-coded post-place dwell/lift changes in `ReferencePnpJobProcessor`. Testing showed the original SOT23 placement issue was actually caused by off-centre pick, not place/retract motion. Treat this branch/change as experimental; do not merge it unless the feature is revisited and generalized.
- G120 bottom vision is working with shielding against stray light. Package-specific bottom vision offset that worked was X `+0.635mm`, Y `-0.08mm`; sign convention observed: positive X vision center offset moved final placement left, negative Y moved it up.
- For tiny parts bouncing/tipping, verify pick centering first. Off-centre pick can lift the part at an angle and make the later placement/retract look faulty.
- Bulk feeder feed-count reset is not currently exposed as a built-in multi-select UI action. A future useful UI patch would add a multi-selected feeder action that calls `setFeedCount(0)` on selected feeders supporting that property.

## PandaPlacer Y Position-Loss Investigation - 2026-07-19

Symptom: after a job error (No Part / No Vacuum / no available feeder) and resume, Y is "lost" and repeatedly drives into one Y hard stop (which end depends on offset direction) until killed. Operator rules out mechanical slip and collisions; machine runs at 25% speed and is watched. Firmware-side detail lives in `D:\usr_chronos\CNC\PandaPlacer\Marlin-pandaplacer\CLAUDE.md` — read both together.

Audit results (both code bases):

- **Homed-machine motion is fully protected, verified.** Marlin clamps every `G0/G1` in native space (`apply_motion_limits`); `G92` (used by `HOME_COMMAND` and `SET_GLOBAL_OFFSETS_COMMAND` visual homing) only shifts the reporting frame, never the clamp window. OpenPnP-side, Y axis soft limits 0..350 are enabled in machine.xml and `AbstractMotionPlanner.limitAxesLocation` *throws* on out-of-range targets — garbage coordinates cannot reach the serial port. So the crash requires Marlin's native frame to diverge from physical reality, or an unhomed controller.
- **Prime suspect: silent controller reboot.** The PandaPlacer Marlin fork's only functional code change makes `kill()` auto-reboot the board after ~5 s (`minkill()` → `HAL_reboot()`). After reboot: position zeroed, axes unhomed, and Marlin soft endstops *do not apply to unhomed axes at all*. `NO_MOTION_BEFORE_HOMING` then refuses moves — but the refusal is `echo:Home XY first` + `ok`, which GcodeDriver counts as success, so OpenPnP continues obliviously. If the *flashed* binary lacks `NO_MOTION_BEFORE_HOMING`, post-reboot moves execute unclamped in a zeroed frame → hard-stop crashes.
- **Pending test (user, after lawn):** reset the board, do NOT home, send `G1 Y10 F600`. Moves = flashed build has no homing gate (smoking gun). `echo:Home XYZ first` = gate present.
- **Firmware change made (needs rebuild + reflash):** `HOME_AFTER_DEACTIVATE` enabled in the Marlin fork's `Configuration.h` — any stepper disable (`M84` in DISABLE_COMMAND, the `M84 X Y Z A B` actuator, 1800 s inactivity timeout) now requires re-home before motion. Verified compatible with the `HOME_COMMAND` macro sequence.
- **OpenPnP change recommended (user to do):** set `home-after-enabled` to `true` (machine.xml ~line 2360, or Machine Setup → ReferenceMachine → "Home after enabled" checkbox; edit XML only with OpenPnP closed). Verified in code that this runs the full driver `HOME_COMMAND` *and* visual homing (`ReferenceHead.home()` does `visualHome` first), same as the Home button.
- **Instrumentation ideas:** treat Marlin's boot banner `start` as an error response in GcodeDriver to surface silent reboots; keep G-code logging on; on next incident capture `M114` before re-homing and compare `Count Y` (native belief) against physically measured carriage position.
- Ruled out: `G92`/workspace-offset defeating soft limits; spurious endstop triggers truncating moves (endstops ignored outside homing in this config); OpenPnP sending out-of-range targets; stepper-disable position drift is now mitigated by `HOME_AFTER_DEACTIVATE`.
- Upstream Marlin refs: #23095 (trust-on-disable inconsistency), #25117 (2.1.2 stepper-ISR regression — don't blind-upgrade the 2.1.1 fork).
- Useful G-code observations from console (older session):
  - `M211` reports `S1 ; ON`; min Y `0.845`, max Y `352.845` (logical/shifted frame — native window is 0..352).
  - Example `M114`: `X:94.533 Y:0.845 Z:0.000 ... Count X:15188 Y:0 Z:997` (`Count` = native steps; Y:0 here was after the clamped `G1 Y-1` test).

### Event System

Guava `EventBus` is used for decoupled events (`PlacementSelectedEvent`, `BoardLocationSelectedEvent`, etc.). `MachineListener` callbacks exist for machine state changes. GUI panels subscribe to both.

### Scripting

`org.openpnp.scripting` provides Jython, Beanshell, and Nashorn scripting hooks. Scripts can be triggered at job lifecycle points (startup, before/after placement, etc.).

## Key Test Infrastructure

Tests in `src/test/java/` use JUnit 5. Integration tests (e.g., `BasicJobTest`) create a full `Configuration` with a `NullDriver` (simulated motion) and run actual job processing. Tests requiring OpenCV must have native libraries available — `OpenCvTest` verifies the OpenCV setup.
