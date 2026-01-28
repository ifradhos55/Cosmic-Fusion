<div align="center">

# Cosmic Fusion

### Interactive 3D Solar System & Galaxy Simulation

<br>

**100,000+** Particles in Galaxy View | **Real-time** Orbital Physics | **Procedural** Textures

<br>

</div>

## Technology Stack

| HTML5 | Three.js | WebGL |
| :---: | :---: | :---: |
| Structure | v0.160 | Renderer |

> Implementation relies on standard ES Modules and Vanilla CSS for maximum performance and zero build-step requirement.

---

## Code Architecture

| Component | Description |
| :--- | :--- |
| **Monolith Structure** | Logic contained in single file `cosmicfusion.html` |
| **Procedural Assets** | Textures generated via `Canvas API` (No external image downloads) |
| **Scene Graph** | Tiered Groups (Solar Group, Tilt Group, Moon Pivot) |

## Rendering Pipeline

The simulation follows a linear data flow to generate the scene every frame.
