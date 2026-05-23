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

### Event System

Guava `EventBus` is used for decoupled events (`PlacementSelectedEvent`, `BoardLocationSelectedEvent`, etc.). `MachineListener` callbacks exist for machine state changes. GUI panels subscribe to both.

### Scripting

`org.openpnp.scripting` provides Jython, Beanshell, and Nashorn scripting hooks. Scripts can be triggered at job lifecycle points (startup, before/after placement, etc.).

## Key Test Infrastructure

Tests in `src/test/java/` use JUnit 5. Integration tests (e.g., `BasicJobTest`) create a full `Configuration` with a `NullDriver` (simulated motion) and run actual job processing. Tests requiring OpenCV must have native libraries available — `OpenCvTest` verifies the OpenCV setup.
