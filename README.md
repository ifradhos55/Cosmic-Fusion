# Cosmic Fusion

An interactive solar-system web application built with Three.js and Vite. Explore the Sun and all eight planets, inspect each world, change the pace of the simulation, and pilot a spacecraft through the scene.

Originally created by Ifrad Hossain.

## Run locally

Use Node.js 22 or newer and a browser with WebGL2 support.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open [http://localhost:5173](http://localhost:5173). The simulation runs in the browser. NASA observations use a small server endpoint, included in the local Vite server and deployed as a Vercel function. No account is required to try the shared demo key.

```sh
npm run build       # Production web application in dist/
npm run preview     # Serve the production build locally
```

## Explore

Select a planet from the world selector to focus the camera and open its information panel. Drag the scene to orbit around the selected world and scroll or pinch to zoom. Overview frames the solar system. Pause, playback speed, and reset controls manage simulation time. Flight mode holds the orbital clock so destinations stay approachable.

The simulation starts at **0.1 days per second**. Close a description with its **×** button; selecting a planet opens it again. Choose **Clean view** or press **H** to hide the navigation, sidebars, labels, and every control while the scene fills the browser window. Press **H** or **Escape**, or double-click/double-tap the scene, to restore the interface. Clean view works in Explore, Galaxy, and Flight deck independently of browser fullscreen.

The simulation uses compressed distances and enlarged planets to make exploration practical. Orbital and rotation periods are based on Earth days, but trajectories are illustrative circular orbits. The displayed date tracks elapsed simulation time from January 1, 2026; it does not represent a precise astronomical ephemeris. Spacecraft speeds use simulation units, rather than physical kilometers per second.

## NASA observations

Open **NASA updates** in the header or **NASA observations** in Worlds. On touch devices, the graph icon beside the mode selector opens the same panel. Each feed shows its publication or event date, the last successful fetch, and the next scheduled check in UTC.

- **Astronomy picture:** the latest published Astronomy Picture of the Day, with its explanation, credit and original article. Video entries link to NASA rather than embedding external players.
- **Space weather:** the past seven UTC dates of DONKI notifications from NASA CCMC and the Moon to Mars Space Weather Analysis Office. Reports may describe observations, analysis or forecasts. The panel shows the twelve most recent notifications.
- **Asteroid approaches:** Earth close approaches across seven UTC dates starting today, using NASA JPL NeoWs. Upcoming approaches include estimated size ranges, miss distance in kilometers and lunar distances, speed and JPL orbit links. The potentially hazardous designation is a classification, not an impact prediction.

These are periodically refreshed NASA records, not a continuous sensor stream. They use the current real date even when the simulation is paused or time warp is active. The simulated planets remain illustrative and are not driven by these feeds.

APOD uses NASA's September 2026 [replacement API](https://github.com/nasa/apod-api). Space weather uses the September 30, 2026 [replacement DONKI endpoint](https://ccmc.gsfc.nasa.gov/news/major-updates/). The old api.nasa.gov DONKI endpoint currently redirects to an announcement page.

For production, obtain a free key from [NASA Open APIs](https://api.nasa.gov/) and add `NASA_API_KEY` to the Vercel project's server environment, then redeploy. For local use, copy `.env.example` to `.env.local` and replace `DEMO_KEY`. Keep this variable server-side. Do not use a `VITE_` prefix. Keys never appear in browser requests or responses.

Without a personal key, NeoWs uses NASA's shared `DEMO_KEY`, which permits 30 requests per IP per hour and 50 per day. Asteroid data is cached for two hours in demo mode and one hour with a personal key. APOD is cached for one hour and DONKI for fifteen minutes; their current public endpoints do not need a key. The Vercel CDN shares successful responses, while each server instance coalesces simultaneous requests. Refresh does not bypass these caches. A busy deployment can still exhaust the shared demo quota, so use a personal key for public traffic.

Requests stop when the panel closes and automatic checks run only while it is visible. Failed feeds remain independent of working feeds. A server instance can retain the last successful result for up to a day during an outage, clearly marked **Saved update**, with its original timestamp. Cold server instances may have no saved result. Nothing is replaced with sample data when NASA is unavailable.

`npm run preview` includes the same API adapter as development. A plain static host needs an equivalent `/api/nasa` backend; `dist/` alone does not contain one.

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
| `server/nasa.js` | NASA adapters, validation, caching, failure handling and HTTP handler |
| `api/nasa.js` | Vercel function entry point |
| `tests/` | Clock tests and browser integration checks |
| `public/` | Static assets served directly by Vite |
| `legacy/` | Archived pre-2.0 monolithic source kept for reference |

## Verification

```sh
npm test
npm run build
npx playwright install chromium
npm run test:smoke
npm run test:touch
npm run test:nasa
```

The unit tests cover simulation time, flight mathematics, navigation, and collision protection. The browser smoke test launches Chromium, verifies nonblank WebGL rendering, exercises planet selection and time controls, checks thrust, braking, autopilot and camera modes, and captures desktop and mobile layouts. It fails on uncaught browser errors or failed local resources.

NASA tests cover the new upstream schemas, UTC date windows, numeric units, HTML handling, key redaction, shared requests, cache expiration, rate limits and saved results. The NASA browser test uses deterministic feed fixtures to check desktop and touch layouts, independent failures, keyboard input isolation, closing, and refreshing. It does not consume NASA API quota.

The smoke test reuses a server at `http://127.0.0.1:5173`, or starts and stops its own Vite server. Screenshots are written to `work/smoke/`. Set `SMOKE_BASE_URL` to use another development server, `SMOKE_OUTPUT_DIR` to change the screenshot directory, or `CHROME_PATH` to use an existing Chromium/Chrome executable. `PLAYWRIGHT_MODULE_PATH` optionally points to an external Playwright package directory.

Phones, tablets, and foldables use a compact touch interface. The Worlds drawer keeps every planet available in portrait and landscape, and the details drawer scrolls independently of the scene. Controls are at least 44 pixels tall. Narrow phones show an animated rotation suggestion with a Continue in portrait option; tablets work in either orientation.

Drag with one finger to rotate, pinch to zoom, and move two fingers together to pan. Zoom and recenter buttons are also available. Hide UI fills the screen with the scene; double-tap to restore the controls.

In flight, touch the left steering area to reveal a temporary joystick. Small movements turn slowly; longer drags turn faster. Hold the right area to thrust, slide up for more thrust, or slide down to reverse. Releasing thrust slows the ship. Boost is a separate hold button and Stop cancels movement. Selecting a planet previews the destination; Fly to starts assisted navigation. Rotation, folding, losing pointer capture, and leaving the app clear held controls.

The touch browser tests exercise eight viewport configurations from 344-pixel folded screens to 1366-pixel tablets, using Chromium touch input for drag, pinch, pan, scrolling, steering, and simultaneous thrust. These are emulation checks, not physical-device certification.
