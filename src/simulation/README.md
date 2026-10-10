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
Negative time works. Installed JPL tables supply date-based positions, including
the Moon's geocentric vector. Before those tables load, circular paths and their
phases are illustrative. Body sizes and orbital distances are compressed; this
is not a gravity solver. Procedural textures and star positions are seeded.

`orientation.js` puts geographic texture axes into that same J2000 ecliptic
frame. The center of each equirectangular map is longitude 0° (+X on the sphere),
north is +Y and east is -Z. Earth rotates its tilt group using mean Greenwich
sidereal time and Lieske precession angles, leaving its root and lunar orbit
unrotated. Clouds share the geographic frame with an illustrative drift.
The Moon uses the IAU 2009 pole and prime-meridian series in NASA NAIF
[pck00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc),
including libration. Before JPL loads, its near side points directly at Earth.

These are approximate cartographic orientations: Earth uses UTC as UT1, omits
nutation and polar motion, and the lunar series uses TT≈TDB with the contemporary
69.184-second TT−UTC offset (no historical/future leap-second lookup). They are
not precision ITRF/DE440 attitudes. The Earth's mean sidereal calculation is
described by [USNO](https://aa.usno.navy.mil/faq/GAST); precession uses the standard
IAU 1976/Lieske angle polynomials. Enlarging Earth and the Moon changes their
apparent geometry; physical geographic directions are anchored at their centers.

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
