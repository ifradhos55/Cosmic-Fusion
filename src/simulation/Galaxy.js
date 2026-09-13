import * as THREE from 'three';
import { generateGalaxy, STAR_COUNTS, SOLAR_POSITION } from './galaxy/distribution.js';
import { galaxyStarMaterial, galacticDustMaterial } from './galaxy/materials.js';

/** A particle-based structural model, with an observed all-sky panorama
 * available at the Solar System's position. No opaque core or rotating decal.
 */
export class Galaxy {
  constructor(scene) {
    this.scene = scene;
    this.disposed = false;
    this.group = new THREE.Group();
    this.group.name = 'Milky Way galaxy';
    this.group.visible = false;
    scene.add(this.group);
    const data = generateGalaxy();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(data.sizes, 1));
    this.stars = new THREE.Points(geometry, galaxyStarMaterial());
    this.stars.name = '260,000 individual galactic stars';
    this.stars.frustumCulled = false;
    this.stars.renderOrder = 2;
    this.group.add(this.stars);
    this.disk = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), galacticDustMaterial());
    this.disk.rotation.x = -Math.PI/2;
    this.disk.position.y = -.8;
    this.disk.name = 'Unresolved starlight and filamentary dust lanes';
    this.group.add(this.disk);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.42, 48), new THREE.MeshBasicMaterial({ color: 0xdcb878, side: THREE.DoubleSide, transparent: true, opacity: .8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.fromArray(SOLAR_POSITION); this.marker.position.y = 3;
    this.marker.name = 'Sun in the Orion spur';
    this.group.add(this.marker);
    this.setQuality('high');
  }

  loadSky() {
    if (this.sky) return;
    const texture = new THREE.TextureLoader().load('/assets/textures/milky-way-eso.jpg', () => { this.skyReady = !this.disposed; });
    texture.colorSpace = THREE.SRGBColorSpace;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 64, 32), new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false }));
    this.sky.name = 'Observed all-sky panorama: ESO/S. Brunier';
    this.sky.position.fromArray(SOLAR_POSITION);
    // Equirectangular panorama is in Galactic coordinates: center at l=0.
    this.sky.rotation.y = Math.atan2(SOLAR_POSITION[2], SOLAR_POSITION[0]);
    this.sky.renderOrder = -2;
    this.group.add(this.sky);
  }

  setPerspective(perspective) {
    this.perspective = perspective;
    const inside = perspective === 'sky';
    if (inside) this.loadSky();
    if (this.sky) this.sky.visible = inside;
    this.disk.visible = !inside;
    this.marker.visible = !inside;
    this.stars.visible = !inside;
  }

  update() { /* Galactic structure is effectively stationary on human timescales. */ }
  setQuality(quality) {
    this.quality = quality;
    this.starCount = STAR_COUNTS[quality] || STAR_COUNTS.high;
    this.stars.geometry.setDrawRange(0, this.starCount);
    this.stars.material.uniforms.pixelRatio.value = Math.min(globalThis.window?.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.group.traverse(object => { object.geometry?.dispose(); object.material?.map?.dispose(); object.material?.dispose(); });
    this.scene.remove(this.group);
  }
}
