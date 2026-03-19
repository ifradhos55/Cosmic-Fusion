import * as THREE from 'three';

export function createGalaxy(parentGroup) {
    const parameters = {
        count: 100000,
        size: 0.7,
        radius: 1300,
        branches: 3,
        spin: 1.3,
        randomness: 0.25,
        randomnessPower: 3,
        insideColor: '#fffcd1', // Bright white/pale yellow core (Overexposed look)
        outsideColor: '#1b3984' // Cool blue base for arms
    };

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(parameters.count * 3);
    const colors = new Float32Array(parameters.count * 3);

    const colorInside = new THREE.Color(parameters.insideColor);
    const colorOutside = new THREE.Color(parameters.outsideColor);

    for (let i = 0; i < parameters.count; i++) {
        const i3 = i * 3;
        const radius = Math.random() * parameters.radius;
        const spinAngle = radius * parameters.spin;
        const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2;

        const randomX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
        const randomY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
        const randomZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;

        positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
        positions[i3 + 1] = randomY * 0.9;
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        // Color Mixing with Cool Blues, Purples, and Magenta Accents
        const mixedColor = colorInside.clone();
        mixedColor.lerp(colorOutside, radius / parameters.radius);

        // Add "Secondary tones: pink, magenta"
        // Randomly boost Red/Blue component for particles further out to create magenta/pink
        if (Math.random() < 0.15) {
            mixedColor.r += 0.4;
            mixedColor.b += 0.2;
        }

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: parameters.size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });

    const points = new THREE.Points(geometry, material);

    const hitGeometry = new THREE.SphereGeometry(200, 32, 32);
    const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
    hitMesh.userData = {
        isGalaxy: true,
        data: {
            name: "The Milky Way",
            type: "Barred Spiral Galaxy",
            orbitalPeriod: "N/A",
            rotationPeriod: 0,
            details: {
                temp: "N/A",
                speed: "600 km/s",
                atmo: "Interstellar Medium",
                wind: "100-400 Billion Stars"
            }
        }
    };

    parentGroup.add(points);
    parentGroup.add(hitMesh);
}

export function createBackgroundGalaxies(parentGroup) {
    const count = 2000; // Number of background galaxies
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const color1 = new THREE.Color('#88aaff'); // Distant blueish
    const color2 = new THREE.Color('#ffaa88'); // Distant reddish

    for (let i = 0; i < count; i++) {
        // Random spherical distribution far away
        const r = 4000 + Math.random() * 6000; // Between 4000 and 10000 units away
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Random colors for diversity
        const color = Math.random() > 0.5 ? color1 : color2;
        // Slight variation
        colors[i * 3] = color.r + (Math.random() - 0.5) * 0.2;
        colors[i * 3 + 1] = color.g + (Math.random() - 0.5) * 0.2;
        colors[i * 3 + 2] = color.b + (Math.random() - 0.5) * 0.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Use points material
    const material = new THREE.PointsMaterial({
        size: 15, // Larger size to look like distant fuzzballs
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        transparent: true,
        opacity: 0 // Start invisible, fade in with zoom
    });

    const bgGalaxies = new THREE.Points(geometry, material);
    parentGroup.add(bgGalaxies);
    parentGroup.userData = { material: material }; // Store ref to animate opacity
}
