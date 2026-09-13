import * as THREE from 'three';
import { BODY_DATA } from '../data/bodies.js';
import { createSurfaceTexture, createRadialGlow, createRingTexture, seededRandom } from './textures.js';
import { createAtmosphere, createEarthMaterial, createSunMaterial, createRingMaterial, createPlanetMaterial } from './materials.js';

import { PlanetTextureLibrary } from '../rendering/PlanetTextureLibrary.js';

const TAU = Math.PI * 2;
const EARTH_ASSETS = {
  'earth albedo.jpg': new URL('../data/textures/earth-day.jpg', import.meta.url).href,
  'earth night_lights_modified.png': new URL('../data/textures/earth-night.png', import.meta.url).href,
  'earth bump.jpg': new URL('../data/textures/earth-relief.jpg', import.meta.url).href,
  'clouds earth.png': new URL('../data/textures/earth-clouds.png', import.meta.url).href,
};
const blackTexture = () => {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
};

/**
 * Scene-owned solar system, independent of camera, UI and flight controls.
 * Positions use compressed world units; physical periods are Earth days.
 * update(days, dtSeconds) takes an absolute simulation day, not a day increment.
 */
export class Universe {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'Solar system';
    scene.add(this.group);
    this.bodies = [];
    this.orbits = new Map();
    this.textures = new Set();
    this.selectedId = null;
    this.orbitsVisible = true;
    this.disposed = false;
    this.anisotropy = Math.min(renderer?.capabilities.getMaxAnisotropy() || 4, 8);
    this.textureLibrary = new PlanetTextureLibrary(this.anisotropy);
    this.elapsed = 0;
    this._buildLights();
    this._buildStars();
    for (const data of BODY_DATA) this._buildBody(data);
    this._buildMoon();
    this._buildAsteroids();
    this.selectBody(null, false);
    this.update(0, 0);
  }

  _track(texture) { this.textures.add(texture); return texture; }

  _buildLights() {
    this.sunlight = new THREE.PointLight(0xfff4e5, 2.6, 0, 0);
    this.sunlight.name = 'Solar illumination';
    this.group.add(this.sunlight);
    this.fillLight = new THREE.AmbientLight(0x8198b5, .16);
    this.group.add(this.fillLight);
  }

  _buildBody(data) {
    const root = new THREE.Group();
    root.name = data.name;
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(data.tilt || 0);
    root.add(tiltGroup);
    const geometry = new THREE.SphereGeometry(data.radius, 96, 64);
    const texture = this._track(createSurfaceTexture(data.id, this.anisotropy));
    let material;
    if (data.id === 'sun') material = createSunMaterial(texture);
    else if (data.id === 'earth') {
      const black = this._track(blackTexture());
      material = createEarthMaterial(texture, black, black);
    } else material = createPlanetMaterial(texture, data.id);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${data.name} surface`;
    mesh.userData.bodyId = data.id;
    mesh.rotation.y = data.id === 'earth' ? 2.7 : 0;
    const flattening = { earth: .99665, jupiter: .9351, saturn: .902, uranus: .9771, neptune: .9829 }[data.id] || 1;
    mesh.scale.y = flattening;
    tiltGroup.add(mesh);
    this.textureLibrary.register(data.id, map => {
      (material.uniforms.dayMap || material.uniforms.surfaceMap).value = map;
    }, texture);
    const body = { id: data.id, data, mesh, root, tiltGroup, position: root.position, radius: data.radius, orbitRadius: data.orbitRadius, phase: data.phase || 0 };
    this.bodies.push(body);
    this.group.add(root);

    if (data.orbitRadius) this._buildOrbit(data);
    if (data.id === 'earth') this._buildEarth(body);
    if (data.id === 'sun') {
      const glowMap = this._track(createRadialGlow());
      const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0xffe2b0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, opacity: .34 }));
      corona.scale.setScalar(data.radius * 6);
      corona.name = 'Solar corona';
      root.add(corona);
      body.corona = corona;
    }
    if (['venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(data.id)) {
      const colors = { venus: '#f6c97f', mars: '#dc7344', jupiter: '#b99d75', saturn: '#d8b775', uranus: '#acd3d6', neptune: '#9bc6d0' };
      const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(data.radius * 1.012, 72, 48), createAtmosphere(colors[data.id], data.id === 'mars' ? .10 : .19));
      atmosphere.scale.y = flattening;
      tiltGroup.add(atmosphere);
      body.atmosphere = atmosphere;
    }
    if (data.id === 'saturn') this._buildRings(body);
  }

  _loadEarthTexture(filename, colorSpace, apply) {
    const texture = new THREE.TextureLoader().load(
      EARTH_ASSETS[filename],
      loaded => { if (!this.disposed) apply(loaded); },
      undefined,
      () => { /* The generated surface remains usable when a local asset is unavailable. */ },
    );
    texture.colorSpace = colorSpace;
    texture.anisotropy = this.anisotropy;
    texture.wrapS = THREE.RepeatWrapping;
    this._track(texture);
  }

  _buildEarth(body) {
    const { material } = body.mesh;
    this._loadEarthTexture('earth night_lights_modified.png', THREE.SRGBColorSpace, texture => { material.uniforms.nightMap.value = texture; });
    this._loadEarthTexture('earth bump.jpg', THREE.NoColorSpace, texture => { material.uniforms.bumpMap.value = texture; material.uniforms.hasBump.value = 1; });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(body.radius * 1.008, 96, 64), new THREE.MeshPhongMaterial({
      color: 0xf0f8ff, transparent: true, opacity: .72, depthWrite: false,
      shininess: 8, specular: 0x182531,
    }));
    clouds.scale.y = .99665;
    clouds.visible = false;
    clouds.name = 'Earth cloud layer';
    body.tiltGroup.add(clouds);
    body.clouds = clouds;
    this._loadEarthTexture('clouds earth.png', THREE.NoColorSpace, texture => {
      clouds.material.alphaMap = texture;
      clouds.material.needsUpdate = true;
      clouds.visible = true;
    });
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(body.radius * 1.018, 96, 64), createAtmosphere('#73adf6', .52));
    atmosphere.name = 'Earth atmosphere';
    atmosphere.scale.y = .99665;
    body.tiltGroup.add(atmosphere);
    body.atmosphere = atmosphere;
  }

  _buildOrbit(data) {
    const points = [];
    const inclination = THREE.MathUtils.degToRad(data.inclination || 0);
    for (let i = 0; i < 512; i++) {
      const angle = i / 512 * TAU;
      points.push(new THREE.Vector3(Math.cos(angle) * data.orbitRadius, Math.sin(angle) * data.orbitRadius * Math.sin(inclination), Math.sin(angle) * data.orbitRadius * Math.cos(inclination)));
    }
    const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x5c7794, transparent: true, opacity: .145, depthWrite: false }));
    orbit.name = `${data.name} orbital path`;
    this.group.add(orbit);
    this.orbits.set(data.id, orbit);
  }

  _buildRings(body) {
    const innerRadius = body.radius * 1.24, outerRadius = body.radius * 2.27;
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 256, 1);
    const positions = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      uv.setXY(i, (radius - innerRadius) / (outerRadius - innerRadius), .5);
    }
    const map = this._track(createRingTexture());
    const material = createRingMaterial(map, body.radius);
    const surface = body.mesh.material.uniforms;
    surface.hasRings.value = 1;
    surface.ringMap.value = map;
    surface.ringCenter.value = body.position;
    surface.planetRadius.value = body.radius;
    surface.ringNormal.value.applyAxisAngle(new THREE.Vector3(0,0,1), body.tiltGroup.rotation.z);
    this.textureLibrary.load('2k_saturn_ring_alpha.png', texture => {
      material.uniforms.ringMap.value = texture;
      surface.ringMap.value = texture;
    });
    material.uniforms.planetCenter.value = body.position;
    const rings = new THREE.Mesh(geometry, material);
    rings.rotation.x = -Math.PI / 2;
    rings.name = 'Saturn rings';
    body.tiltGroup.add(rings);
    body.rings = rings;
  }

  _buildMoon() {
    const earth = this.getBody('earth');
    const texture = this._track(createSurfaceTexture('moon', this.anisotropy));
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(.38, 40, 32), createPlanetMaterial(texture, 'moon'));
    this.textureLibrary.register('moon', map => { this.moon.material.uniforms.surfaceMap.value = map; }, texture);
    this.moon.name = 'Moon';
    this.moon.userData.bodyId = 'earth';
    earth.root.add(this.moon);
    const points = Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * TAU) * 5.1, Math.sin(i / 128 * TAU) * .45, Math.sin(i / 128 * TAU) * 5.1));
    this.moonOrbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x7199c0, transparent: true, opacity: .17, depthWrite: false }));
    earth.root.add(this.moonOrbit);
  }

  _buildStars() {
    const random = seededRandom(1701);
    const count = 3800;
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), sizes = new Float32Array(count);
    const starColors = [new THREE.Color('#b8ceee'), new THREE.Color('#e5ecfa'), new THREE.Color('#f7d4ad')];
    for (let i = 0; i < count; i++) {
      const theta = random() * TAU;
      const z = random() * 2 - 1;
      const xy = Math.sqrt(1 - z * z);
      const radius = 1500 + random() * 1600;
      positions.set([Math.cos(theta) * xy * radius, z * radius, Math.sin(theta) * xy * radius], i * 3);
      const color = starColors[Math.floor(random() * starColors.length)];
      const brightness = .18 + random() ** 3 * .65;
      colors.set([color.r * brightness, color.g * brightness, color.b * brightness], i * 3);
      sizes[i] = random() > .975 ? 2.5 : .7 + random() * 1.05;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { pixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: `attribute vec3 color; attribute float size; varying vec3 vColor; uniform float pixelRatio; void main(){ vColor=color; vec4 mvPosition=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mvPosition; gl_PointSize=size*pixelRatio; }`,
      fragmentShader: `varying vec3 vColor; void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.)discard; gl_FragColor=vec4(vColor, pow(1.-d, .7)); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(geometry, material);
    this.stars.name = 'Background stars';
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  _buildAsteroids() {
    const random = seededRandom(42), count = 1100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = random() * TAU, radius = 43.2 + random() * 4.8;
      positions.set([Math.cos(angle) * radius, (random() - .5) * 1.4, Math.sin(angle) * radius], i * 3);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.asteroids = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xa89883, size: .065, transparent: true, opacity: .28, depthWrite: false, sizeAttenuation: true }));
    this.asteroids.name = 'Main asteroid belt';
    this.group.add(this.asteroids);
  }

  getBody(id) { return this.bodies.find(body => body.id === id); }

  update(simulationDays = 0, deltaSeconds = 0) {
    if (this.disposed) return;
    this.elapsed += Math.max(0, deltaSeconds);
    for (const body of this.bodies) {
      const { data } = body;
      if (data.orbitRadius) {
        const angle = body.phase + (simulationDays % data.orbitalPeriod) / data.orbitalPeriod * TAU;
        const inclination = THREE.MathUtils.degToRad(data.inclination || 0);
        body.position.set(Math.cos(angle) * data.orbitRadius, Math.sin(angle) * data.orbitRadius * Math.sin(inclination), Math.sin(angle) * data.orbitRadius * Math.cos(inclination));
      }
      // Separate axial tilt from spin so clouds and rings share the right axis.
      body.mesh.rotation.y = (data.id === 'earth' ? 2.7 : 0) + (simulationDays % Math.abs(data.rotationPeriod)) / data.rotationPeriod * TAU;
      if (body.clouds) body.clouds.rotation.y = body.mesh.rotation.y + simulationDays * .03;
      if (data.id === 'sun') body.mesh.material.uniforms.time.value = this.elapsed;
    }
    const moonAngle = (simulationDays % 27.3217) / 27.3217 * TAU + 2.4;
    this.moon.position.set(Math.cos(moonAngle) * 5.1, Math.sin(moonAngle) * .45, Math.sin(moonAngle) * 5.1);
    this.moon.rotation.y = -moonAngle;
    this.asteroids.rotation.y = -(simulationDays % 1600) / 1600 * TAU;
  }

  selectBody(id, closeUp = true) {
    this.selectedId = id;
    this.focusDetail(closeUp ? id : null);
    for (const [bodyId, orbit] of this.orbits) {
      const selected = id === bodyId;
      orbit.material.color.set(selected ? 0x759abf : 0x51677c);
      orbit.material.opacity = selected ? .34 : .12;
    }
    if (this.moonOrbit) this.moonOrbit.visible = this.orbitsVisible && id === 'earth';
  }

  setOrbits(visible) {
    this.orbitsVisible = Boolean(visible);
    for (const orbit of this.orbits.values()) orbit.visible = this.orbitsVisible;
    if (this.moonOrbit) this.moonOrbit.visible = this.orbitsVisible && this.selectedId === 'earth';
  }

  focusDetail(id) {
    this.detailId = id;
    this.textureLibrary.focus(id);
  }

  setQuality(quality) {
    this.quality = quality;
    this.textureLibrary.focus(this.detailId, quality);
    const high = quality === 'high';
    this.stars.geometry.setDrawRange(0, high ? 3800 : 2200);
    this.asteroids.visible = high;
    this.stars.material.uniforms.pixelRatio.value = Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.textureLibrary.dispose();
    const geometries = new Set(), materials = new Set();
    this.group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.textures.forEach(texture => texture.dispose());
    this.scene.remove(this.group);
  }
}
