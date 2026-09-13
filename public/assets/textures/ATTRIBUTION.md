# Texture sources and visual interpretation

## Planetary maps

Files named `2k_*` and `8k_*` are unmodified downloads from **Solar System Scope / INOVE**, https://www.solarsystemscope.com/textures/ . Licensed under **Creative Commons Attribution 4.0 International**, https://creativecommons.org/licenses/by/4.0/ .

These equirectangular maps are derived from NASA elevation and imagery data, including Messenger, Viking, Cassini, Hubble and Blue Marble sources. The publisher fills some unmapped areas with reconstructed terrain and enhances some colors. They are imagery-based reconstructions, not a claim of complete measured surface coverage or current weather. Venus uses the visible cloud atmosphere, not a radar surface map.

The application adjusts saturation, sunlight, and atmospheric shading at render time. Uranus and Neptune are color-adjusted toward pale blue-green, informed by the 2024 Oxford study: https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0 . This is an approximation of natural appearance, not photometric calibration. Storms/clouds are fixed to the source map's observation epoch. The Sun is rendered with neutral photospheric light and limb darkening; the source's orange display color is not preserved.

Source resolution differs from some filenames: Mercury, Mars and Earth high-detail maps are 8192×4096; Jupiter, Saturn and Sun high-detail maps are 4096×2048. Base maps are 2048×1024. Only the selected world retains its high-detail GPU texture.

## Observed Milky Way sky

`milky-way-eso.jpg`: **ESO/S. Brunier**, “The Milky Way panorama”, 6000×3000.
https://www.eso.org/public/images/eso0932a/
Downloaded from https://cdn.eso.org/images/large/eso0932a.jpg .
Licensed under **Creative Commons Attribution 4.0 International**; usage terms: https://www.eso.org/public/outreach/copyright/ .

The image is projected onto an inward-facing celestial sphere in the “From Earth” view. It is photographic, with exposure and processing appropriate to astronomical imagery, not the naked-eye brightness of the sky. The source file is unmodified. The visible credit links to the original image.

## 3D galactic structure

The separate “3D galaxy” and “Edge-on” views are deterministic statistical reconstructions containing 260,000 individually positioned star particles (130,000 in Balanced mode). They are not catalogue positions for individual real stars. The model includes a bar/bulge, an exponential disk, two dominant logarithmic arms, weaker arms, an Orion spur, a sparse halo, and illustrative dust extinction. Overall structure informed by NASA/JPL-Caltech: https://science.nasa.gov/resource/the-milky-way-galaxy/ . The observed panorama is not used as a substitute for the 3D particles.
