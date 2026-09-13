# Cosmic Fusion

An interactive solar-system web application built with Three.js and Vite. Explore the Sun and all eight planets, inspect each world, change the pace of the simulation, and pilot a spacecraft through the scene.

Originally created by Ifrad Hossain.

## Run locally

Use Node.js 22 or newer and a browser with WebGL2 support.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open [http://localhost:5173](http://localhost:5173). The application runs entirely in the browser; it does not require an account, a backend, or API credentials.

```sh
npm run build       # Production web application in dist/
npm run preview     # Serve the production build locally
```

## Explore

Select a planet from the world selector to focus the camera and open its information panel. Drag the scene to orbit around the selected world and scroll or pinch to zoom. Overview frames the solar system. Pause, playback speed, and reset controls manage simulation time. Flight mode holds the orbital clock so destinations stay approachable.

The simulation starts at **0.1 days per second**. Close a description with its **×** button; selecting a planet opens it again. Choose **Clean view** or press **H** to hide the navigation, sidebars, labels, and every control while the scene fills the browser window. Press **H** or **Escape**, or double-click/double-tap the scene, to restore the interface. Clean view works in Explore, Galaxy, and Flight deck independently of browser fullscreen.

The simulation uses compressed distances and enlarged planets to make exploration practical. Orbital and rotation periods are based on Earth days, but trajectories are illustrative circular orbits. The displayed date tracks elapsed simulation time from January 1, 2026; it does not represent a precise astronomical ephemeris. Spacecraft speeds use simulation units, rather than physical kilometers per second.

## Graphics and the Milky Way

The **Galaxy** tab offers three perspectives: **3D galaxy** for the barred spiral structure, **Edge-on** for the disk, and **From Earth** for a photographic 360° Milky Way sky. Drag to look around and scroll/pinch to zoom. Clean view works in all three perspectives.

The structural model draws **260,000 independent star particles** in High quality and **130,000** in Balanced. It includes a central bar and bulge, two dominant spiral arms, weaker arms, an Orion spur, a thick halo and filamentary dust. Stellar positions are a deterministic statistical reconstruction, not a measured catalogue. The From Earth view instead uses the observed panorama by [ESO/S. Brunier](https://www.eso.org/public/images/eso0932a/).

Planetary maps are local [Solar System Scope](https://www.solarsystemscope.com/textures/) imagery-based reconstructions derived from NASA sources. Venus shows its cloud deck; Mercury, Mars and the Moon show mapped terrain; Jupiter and Saturn use spacecraft-based cloud patterns. Uranus and Neptune use restrained blue-green colors. Sunlight, dark hemispheres, atmospheric rims, gas-giant flattening, and Saturn's mutual ring/planet shadows are rendered in shaders. Source maps contain historical observations and some reconstructed areas, rather than current weather or perfectly complete coverage.

All planets keep 2K base textures. The selected planet loads up to **8K** detail (Mercury, Mars, Earth: 8K; Jupiter, Saturn, Sun: 4K); only one high-detail surface stays resident at a time. Balanced quality releases it and reduces rendering resolution while retaining over 100,000 galaxy particles. Sources, licenses, and adjustments are recorded in [asset attribution](public/assets/textures/ATTRIBUTION.md).

## Fly

Enter spaceship mode to launch near the selected world. Fly manually, or use **Fly to** on a selected planet to engage autopilot. Autopilot approaches the destination, slows down, and holds a safe distance outside its surface. Steering or thrust inputs return control to the pilot. Collision protection prevents a fast-moving spacecraft from passing through planets.

| Control | Action |
| --- | --- |
| W / S | Forward / reverse thrust |
| A / D or left / right arrows | Turn left / right |
| Up / down arrows | Pitch up / down |
| Q / E | Roll left / right |
| Shift | Boost while applying thrust |
| Space | Brake |
| Brake button | Immediately cancel velocity and autopilot |
| Cockpit view / Chase view | Switch between spacecraft camera positions |
| Reset flight | Return to a safe launch position |
| Explore | Leave flight and return to orbital camera controls |

Mouse steering is optional and activated explicitly from the flight controls. Escape releases mouse capture. Touch controls provide flight input on small screens.

## Source organization

| Location | Responsibility |
| --- | --- |
| `src/main.js` | Browser entry point |
| `src/app/` | Application lifecycle and coordination between simulation, input, and interface |
| `src/core/SimulationClock.js` | Simulation time, playback speed, pause, and reset |
| `src/data/bodies.js` | Planetary facts and display-scale parameters |
| `src/data/textures/` | Optimized local Earth surface, relief, lights, and cloud maps |
| `src/rendering/` | WebGL renderer and exploration camera |
| `src/simulation/` | Celestial bodies, procedural textures, materials, stars, and orbital motion |
| `src/flight/` | Spacecraft model, flight controller, autopilot, and collision mathematics |
| `src/ui/` | Interface components, icons, and responsive application styles |
| `tests/` | Clock tests and browser integration checks |
| `public/` | Static assets served directly by Vite |
| `legacy/` | Archived pre-2.0 monolithic source kept for reference |

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:smoke
```

The unit tests cover simulation time, flight mathematics, navigation, and collision protection. The browser smoke test launches Chromium, verifies nonblank WebGL rendering, exercises planet selection and time controls, checks thrust, braking, autopilot and camera modes, and captures desktop and mobile layouts. It fails on uncaught browser errors or failed local resources.

The smoke test reuses a server at `http://127.0.0.1:5173`, or starts and stops its own Vite server. Screenshots are written to `work/smoke/`. Set `SMOKE_BASE_URL` to use another development server, `SMOKE_OUTPUT_DIR` to change the screenshot directory, or `CHROME_PATH` to use an existing Chromium/Chrome executable. `PLAYWRIGHT_MODULE_PATH` optionally points to an external Playwright package directory.

On phones, the flight deck is designed for landscape orientation. Portrait mode shows an animated rotate-device prompt; after rotating, touch-drag anywhere in the scene to summon a temporary virtual joystick, and hold the right side of the deck to thrust. A second finger held at the same time engages boost. The joystick and touch affordances fade away as soon as the gesture ends.

GitHub Actions installs dependencies, runs unit tests, builds the web application, and runs the browser smoke test with Chromium. Browser screenshots are retained as a workflow artifact.

## Data and assets

Planet facts are maintained in `src/data/bodies.js`, which links to the NASA and JPL source tables. The active rendering system and its assets are local to the application; no remote graphics service is required at runtime. See [LICENSE](LICENSE) for the project's license.
