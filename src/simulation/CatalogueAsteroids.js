import * as THREE from 'three';
import { CATALOGUE_ASTEROIDS } from '../data/observatories.js';
import { scenePosition } from './ephemeris.js';

export class CatalogueAsteroids {
  constructor(group) {
    this.bodies = CATALOGUE_ASTEROIDS.map((item, index) => {
      const geometry = new THREE.IcosahedronGeometry(.27, 2);
      const points = geometry.attributes.position;
      for (let i = 0; i < points.count; i++) {
        const scale = .9 + .13 * Math.sin(i * 5.7 + index);
        points.setXYZ(i, points.getX(i) * scale, points.getY(i) * scale * .8, points.getZ(i) * scale);
      }
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: [0x9f9485, 0xa6a19a, 0xa69c89, 0x947563, 0xaaa294][index], shininess: 2 }));
      mesh.userData.bodyId = item.id; mesh.visible = false; mesh.name = item.name;
      group.add(mesh);
      return { id: item.id, data: { ...item, diameter: item.diameterKm, isAsteroid: true, color: '#aca394' },
        mesh, root: mesh, position: mesh.position, radius: .3, ephemeris: null };
    });
  }
  update(ephemeris, time) {
    for (const body of this.bodies) {
      const state = ephemeris?.at(body.id, time);
      body.mesh.visible = Boolean(state);
      if (state) { body.position.fromArray(scenePosition(state.position)); body.ephemeris = state; }
    }
  }
}
