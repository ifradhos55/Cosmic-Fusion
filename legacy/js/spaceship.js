import * as THREE from 'three';

export function createSpaceship() {
    const shipGroup = new THREE.Group();

    // --- Materials ---
    const hullMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        metalness: 0.8,
        roughness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });

    const darkMetal = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.4
    });

    const engineGlow = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });

    // --- Main Body (Sleek, curved hull) ---
    // Use an elongated sphere/capsule
    const bodyGeo = new THREE.CapsuleGeometry(1, 4, 16, 32);
    const body = new THREE.Mesh(bodyGeo, hullMaterial);
    body.rotation.x = Math.PI / 2; // Point forward along Z
    body.scale.set(1, 1, 1.5); // Flatten and elongate slightly
    shipGroup.add(body);

    // --- Cockpit Window ---
    const cockpitGeo = new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMat = new THREE.MeshStandardMaterial({
        color: 0x111111, metalness: 1.0, roughness: 0.0, transparent: true, opacity: 0.8
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.4, 2.0);
    cockpit.scale.set(1, 0.5, 1.5);
    cockpit.rotation.x = -Math.PI / 12;
    shipGroup.add(cockpit);

    // --- Swept-back Pylons / Wings ---
    const wingGeo = new THREE.CylinderGeometry(0.1, 0.5, 4, 4);
    
    // Left Wing
    const leftWing = new THREE.Mesh(wingGeo, hullMaterial);
    leftWing.position.set(-2, -0.2, -1);
    leftWing.rotation.z = Math.PI / 2;
    leftWing.rotation.y = -Math.PI / 6; // Swept back
    leftWing.scale.set(1, 1, 0.2); // Flatten
    shipGroup.add(leftWing);

    // Right Wing
    const rightWing = new THREE.Mesh(wingGeo, hullMaterial);
    rightWing.position.set(2, -0.2, -1);
    rightWing.rotation.z = -Math.PI / 2;
    rightWing.rotation.y = Math.PI / 6; // Swept back
    rightWing.scale.set(1, 1, 0.2); // Flatten
    shipGroup.add(rightWing);

    // --- Engine Nacelles ---
    const nacelleGeo = new THREE.CapsuleGeometry(0.4, 2, 8, 16);
    
    // Left Nacelle
    const leftNacelle = new THREE.Mesh(nacelleGeo, darkMetal);
    leftNacelle.position.set(-3.5, -0.2, -1.5);
    leftNacelle.rotation.x = Math.PI / 2;
    shipGroup.add(leftNacelle);

    // Right Nacelle
    const rightNacelle = new THREE.Mesh(nacelleGeo, darkMetal);
    rightNacelle.position.set(3.5, -0.2, -1.5);
    rightNacelle.rotation.x = Math.PI / 2;
    shipGroup.add(rightNacelle);

    // --- Quantum Engine Loops (Orville style) ---
    // The Orville has curved engine loops at the back
    const loopGeo = new THREE.TorusGeometry(1.5, 0.15, 16, 50, Math.PI); // Half torus
    
    const leftLoop = new THREE.Mesh(loopGeo, engineGlow);
    leftLoop.position.set(-3.5, 0, -2.5);
    leftLoop.rotation.y = Math.PI / 2;
    leftLoop.rotation.x = Math.PI / 2;
    shipGroup.add(leftLoop);

    const rightLoop = new THREE.Mesh(loopGeo, engineGlow);
    rightLoop.position.set(3.5, 0, -2.5);
    rightLoop.rotation.y = Math.PI / 2;
    rightLoop.rotation.x = Math.PI / 2;
    shipGroup.add(rightLoop);

    // Engine Lights
    const engineLight1 = new THREE.PointLight(0x00ffff, 2, 20);
    engineLight1.position.set(-3.5, 0, -3);
    shipGroup.add(engineLight1);

    const engineLight2 = new THREE.PointLight(0x00ffff, 2, 20);
    engineLight2.position.set(3.5, 0, -3);
    shipGroup.add(engineLight2);
    
    // Main thruster glow
    const thrusterGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const centerThruster = new THREE.Mesh(thrusterGeo, engineGlow);
    centerThruster.position.set(0, 0, -3.2);
    centerThruster.scale.set(2, 0.5, 1);
    shipGroup.add(centerThruster);

    const centerLight = new THREE.PointLight(0x00ffff, 3, 30);
    centerLight.position.set(0, 0, -3.5);
    shipGroup.add(centerLight);

    // Overall scale for solar system integration
    // Needs to be small enough to look like a ship, but large enough to see.
    // We will scale it dynamically based on the solar system view, or keep it fixed.
    shipGroup.scale.set(1, 1, 1); 

    return shipGroup;
}
