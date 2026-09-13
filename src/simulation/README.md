# Solar-system rendering

`Universe` owns scene content and lighting. It does not own the camera, renderer,
DOM, input handlers, or animation loop.

```js
const universe = new Universe(scene, renderer);
const earth = universe.getBody('earth');
universe.update(absoluteSimulationDays, elapsedFrameSeconds);
universe.selectBody('earth');
universe.setOrbits(true);
universe.setQuality('balanced'); // 'high' restores the full star count and belt
universe.dispose();
```

`bodies` contains the Sun and eight planets in solar order. Each entry exposes
`id`, `data`, `mesh`, `root`, `position`, `radius`, and `orbitRadius`.
`position` is the same Vector3 as `root.position`; it updates in place. The mesh
is below an axial-tilt group, so use the root/position for navigation. Ring and
atmosphere meshes are visual layers, not selectable or collidable surfaces. The
Moon is a visual satellite of Earth; `getBody('moon')` is not a catalog target.

`update` accepts absolute Earth days and retains real orbital/rotation periods.
Negative time works. Initial phases, circular orbital paths, body sizes and
orbital radii are illustrative; they are not date-based ephemerides or a gravity
solver. All procedural textures and star positions are deterministically seeded.

The Earth maps in `src/data/textures` are reduced-resolution derivatives of the
project's existing `public/assets/img/59-earth/textures` images. Day/night maps
are capped at 4096 pixels wide, relief/clouds at 2048. Their original authorship
is inherited from those existing assets. They load from the local Vite bundle;
there are no remote imagery requests. Generated surfaces remain available while
Earth imagery loads. Day/night textures use sRGB; relief/cloud alpha maps are
linear data. Atmosphere shaders transform normals into world space before
computing the view and sunlight directions.

Physical catalog values are sourced from NASA's Planetary Fact Sheet. Moon
counts are a September 2026 NASA/JPL snapshot; see the source links in
`src/data/bodies.js`.
