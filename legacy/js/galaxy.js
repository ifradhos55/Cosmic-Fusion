import * as THREE from 'three';

function createSoftCircleTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
}

const softTexture = createSoftCircleTexture();

export async function createGalaxy(parentGroup) {
    const parameters = {
        starCount: 180000,
        dustCount: 60000,
        bulgeCount: 30000,
        size: 0.8,
        radius: 1500,
        branches: 2,
        spin: 1.5,
        randomness: 0.15,
        randomnessPower: 4,
        insideColor: '#FFF8E1',
        outsideColor: '#2196F3'
    };

    const sceneGroup = new THREE.Group();
    parentGroup.add(sceneGroup);

    const yieldToMain = () => new Promise(resolve => requestAnimationFrame(resolve));

    // --- 1. THE BULGE ---
    const bulgeGeometry = new THREE.BufferGeometry();
    const bulgePos = new Float32Array(parameters.bulgeCount * 3);
    const bulgeColors = new Float32Array(parameters.bulgeCount * 3);
    const coreColor = new THREE.Color('#FFFDE7');
    const outerBulgeColor = new THREE.Color('#FFE082');

    for (let i = 0; i < parameters.bulgeCount; i++) {
        const i3 = i * 3;
        const r = Math.pow(Math.random(), 2) * 200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        bulgePos[i3] = r * Math.sin(phi) * Math.cos(theta);
        bulgePos[i3 + 1] = r * Math.cos(phi) * 0.6;
        bulgePos[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const mixedColor = coreColor.clone().lerp(outerBulgeColor, r / 200);
        bulgeColors[i3] = mixedColor.r; bulgeColors[i3 + 1] = mixedColor.g; bulgeColors[i3 + 2] = mixedColor.b;
        
        if (i % 10000 === 0) await yieldToMain();
    }
    bulgeGeometry.setAttribute('position', new THREE.BufferAttribute(bulgePos, 3));
    bulgeGeometry.setAttribute('color', new THREE.BufferAttribute(bulgeColors, 3));
    const bulgeMaterial = new THREE.PointsMaterial({
        size: 1.2, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true
    });
    sceneGroup.add(new THREE.Points(bulgeGeometry, bulgeMaterial));

    // --- 2. SPIRAL ARMS ---
    const starGeometry = new THREE.BufferGeometry();
    const starPos = new Float32Array(parameters.starCount * 3);
    const starColors = new Float32Array(parameters.starCount * 3);
    const insideColor = new THREE.Color(parameters.insideColor);
    const outsideColor = new THREE.Color(parameters.outsideColor);

    for (let i = 0; i < parameters.starCount; i++) {
        const i3 = i * 3;
        const r = Math.random() * parameters.radius;
        const spinAngle = r * parameters.spin;
        const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2;
        const rX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * r;
        const rY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * (r * 0.2);
        const rZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * r;
        starPos[i3] = Math.cos(branchAngle + spinAngle) * r + rX;
        starPos[i3 + 1] = rY;
        starPos[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rZ;
        const mixedColor = insideColor.clone().lerp(outsideColor, r / parameters.radius);
        if (Math.random() > 0.9) mixedColor.set('#BBDEFB');
        starColors[i3] = mixedColor.r; starColors[i3 + 1] = mixedColor.g; starColors[i3 + 2] = mixedColor.b;

        if (i % 10000 === 0) await yieldToMain();
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({
        size: parameters.size, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true
    });
    sceneGroup.add(new THREE.Points(starGeometry, starMaterial));

    // --- 3. DUST LANES ---
    const dustGeometry = new THREE.BufferGeometry();
    const dustPos = new Float32Array(parameters.dustCount * 3);
    const dustColors = new Float32Array(parameters.dustCount * 3);
    const dustBaseColor = new THREE.Color('#211510');

    for (let i = 0; i < parameters.dustCount; i++) {
        const i3 = i * 3;
        const r = Math.random() * (parameters.radius * 0.8);
        const spinAngle = r * parameters.spin + 0.3;
        const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2;
        const rX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 40;
        const rY = (Math.random() - 0.5) * 10;
        const rZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 40;
        dustPos[i3] = Math.cos(branchAngle + spinAngle) * r + rX;
        dustPos[i3 + 1] = rY;
        dustPos[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rZ;
        dustColors[i3] = dustBaseColor.r; dustColors[i3 + 1] = dustBaseColor.g; dustColors[i3 + 2] = dustBaseColor.b;

        if (i % 10000 === 0) await yieldToMain();
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
    const dustMaterial = new THREE.PointsMaterial({
        size: 2.5, sizeAttenuation: true, depthWrite: false, transparent: true, opacity: 0.2, vertexColors: true
    });
    sceneGroup.add(new THREE.Points(dustGeometry, dustMaterial));

    // --- 4. NEBULAE ---
    for (let i = 0; i < 40; i++) {
        const r = Math.random() * parameters.radius;
        const spinAngle = r * parameters.spin;
        const branchAngle = (i % (parameters.branches * 2)) / (parameters.branches * 2) * Math.PI * 2;
        const mat = new THREE.SpriteMaterial({
            map: softTexture, color: Math.random() > 0.6 ? '#90CAF9' : '#FFF59D',
            transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(mat);
        const x = Math.cos(branchAngle + spinAngle) * r;
        const z = Math.sin(branchAngle + spinAngle) * r;
        sprite.position.set(x, (Math.random()-0.5)*30, z);
        sprite.scale.set(Math.random()*150+100, Math.random()*150+100, 1);
        sceneGroup.add(sprite);
    }

    // --- Interaction Hit-Mesh ---
    const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(parameters.radius * 2.0, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    hitMesh.userData = {
        isGalaxy: true,
        data: {
            name: "Milky Way",
            type: "Barred Spiral Galaxy",
            orbitalPeriod: "13.6 Billion Years (Age)",
            rotationPeriod: 0,
            details: {
                temp: "2.7 K (CMB)",
                speed: "600 km/s (Relative)",
                atmo: "Interstellar Medium",
                wind: "Galactic Outflow"
            }
        }
    };
    sceneGroup.add(hitMesh);
}

export function createBackgroundGalaxies(parentGroup) {
    const count = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color('#90CAF9'); 
    const c2 = new THREE.Color('#FFAB91'); 
    for (let i = 0; i < count; i++) {
        const r = 4000 + Math.random() * 6000;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        const color = Math.random() > 0.5 ? c1 : c2;
        colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 10, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, transparent: true, opacity: 0
    });
    const bgGalaxies = new THREE.Points(geometry, material);
    parentGroup.add(bgGalaxies);
    parentGroup.userData = { material: material };
}
