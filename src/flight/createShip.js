import * as THREE from 'three';

function prism(points, thickness, material) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.035, bevelThickness: 0.025 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -thickness / 2, 0);
  return new THREE.Mesh(geometry, material);
}

/** Original compact survey craft. The nose points down the local negative Z axis. */
export function createShip() {
  const ship = new THREE.Group();
  ship.name = 'Kestrel survey vessel';
  const titanium = new THREE.MeshStandardMaterial({ color: 0x8babbc, metalness: 0.78, roughness: 0.28 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x102631, metalness: 0.78, roughness: 0.34 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xd5e2df, metalness: 0.52, roughness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc8914f, metalness: 0.78, roughness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x153f56, metalness: 0.42, roughness: 0.12, clearcoat: 1, emissive: 0x0a3d4e, emissiveIntensity: 0.28 });
  const strip = new THREE.MeshStandardMaterial({ color: 0x88faff, emissive: 0x49d5ed, emissiveIntensity: 2.2, roughness: 0.3 });
  const add = (geometry, material, position, rotation) => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    ship.add(mesh);
    return mesh;
  };

  const body = prism([[0, -2.45], [.45, -1.8], [.67, .9], [.46, 1.55], [-.46, 1.55], [-.67, .9], [-.45, -1.8]], .38, titanium);
  ship.add(body);
  const dorsal = prism([[0, -2.18], [.27, -1.46], [.4, 1.14], [-.4, 1.14], [-.27, -1.46]], .2, ceramic);
  dorsal.position.y = .24;
  ship.add(dorsal);
  const cockpit = add(new THREE.SphereGeometry(.46, 20, 12), glass, [0, .35, -.55]);
  cockpit.scale.set(.82, .64, 1.78);
  const canopySpine = prism([[-.028, -1.35], [.028, -1.35], [.032, .24], [-.032, .24]], .035, titanium);
  canopySpine.position.y = .58;
  ship.add(canopySpine);
  add(new THREE.BoxGeometry(.06, .04, 1.9), gold, [0, .355, .77]);

  const exhausts = [];
  for (const side of [-1, 1]) {
    const wing = prism([[side * .43, -.7], [side * 2.4, 1.18], [side * 2.28, 1.65], [side * .5, .95]], .12, graphite);
    ship.add(wing);
    const wingPanel = prism([[side * .6, -.3], [side * 2.2, 1.2], [side * 2.05, 1.31], [side * .62, .75]], .05, titanium);
    wingPanel.position.y = .1;
    ship.add(wingPanel);
    add(new THREE.BoxGeometry(.045, .06, .57), strip, [side * 2.18, .1, 1.12], [0, side * -.45, 0]);
    const engine = add(new THREE.CylinderGeometry(.28, .22, 1.65, 12), graphite, [side * .88, .02, .75], [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(.3, .3, .15, 16), titanium, [side * .88, .02, 1.52], [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(.23, .25, .18, 16, 1, true), gold, [side * .88, .02, 1.63], [Math.PI / 2, 0, 0]);
    add(new THREE.CircleGeometry(.21, 24), strip, [side * .88, .02, 1.725]);
    const material = new THREE.MeshBasicMaterial({ color: 0x73e9ff, transparent: true, opacity: .68, depthWrite: false, blending: THREE.AdditiveBlending });
    const plume = add(new THREE.ConeGeometry(.19, 1.5, 12, 1, true), material, [side * .88, .02, 2.45], [Math.PI / 2, 0, 0]);
    plume.userData.baseZ = 1.72;
    exhausts.push(plume);
    const fin = prism([[side * .69, .65], [side * .94, .98], [side * .92, 1.48], [side * .69, 1.45]], .035, ceramic);
    fin.rotation.z = side * .8;
    fin.position.y = .32;
    ship.add(fin);
    engine.name = side > 0 ? 'starboard engine' : 'port engine';
  }
  add(new THREE.SphereGeometry(.055, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfb826e }), [-2.27, .1, 1.55]);
  add(new THREE.SphereGeometry(.055, 8, 8), new THREE.MeshBasicMaterial({ color: 0x91fff0 }), [2.27, .1, 1.55]);
  const light = new THREE.PointLight(0x77dcff, 3, 7, 2);
  light.position.set(0, .1, 2.2);
  ship.add(light);
  // A subtle local fill preserves the hull silhouette on the night side.
  const fill = new THREE.PointLight(0x9fbddd, 2, 8, 1);
  fill.position.set(0, 3, -1);
  ship.add(fill);
  ship.scale.setScalar(.62);
  ship.userData.exhausts = exhausts;
  ship.userData.engineLight = light;
  ship.traverse((node) => { if (node.isMesh) node.castShadow = false; });
  return ship;
}

export function updateShip(ship, thrust, boosting, elapsed) {
  const energy = boosting ? 1.6 : .25 + thrust * .7;
  for (const plume of ship.userData.exhausts) {
    plume.scale.y = energy * (1 + .04 * Math.sin(elapsed * 39));
    plume.position.z = plume.userData.baseZ + .75 * plume.scale.y;
    plume.material.opacity = .4 + Math.min(.42, thrust * .4);
    plume.material.color.setHex(boosting ? 0xb6faff : 0x73e9ff);
  }
  ship.userData.engineLight.intensity = 1 + energy * 3;
}
