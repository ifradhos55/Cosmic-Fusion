import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENE_CONFIG } from './config.js';
import { createPlanetTexture } from './textures.js';
import { planetData } from './data.js';
import { createGalaxy, createBackgroundGalaxies } from './galaxy.js';

// --- Setup Scene ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050505, 0.001);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 15000);
const SOLAR_CAM_POS = new THREE.Vector3(0, 60, 120);
const GALAXY_CAM_POS = new THREE.Vector3(0, 1500, 2500);
camera.position.copy(SOLAR_CAM_POS);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 10;
controls.maxDistance = 10000;
controls.zoomSpeed = 0.8;

// --- Zoom Control Logic ---
const zoomSlider = document.getElementById('zoom-slider');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');

const ZOOM_RANGES = {
    solar: { min: 20, max: 2000 },
    galaxy: { min: 500, max: 6000 }
};

function getCurrentZoomRange() {
    return isGalaxyView ? ZOOM_RANGES.galaxy : ZOOM_RANGES.solar;
}

function sliderToDistance(val) {
    const range = getCurrentZoomRange();
    const percent = val / 100;
    return range.max - (percent * (range.max - range.min));
}

function distanceToSlider(dist) {
    const range = getCurrentZoomRange();
    const clampedDist = Math.max(range.min, Math.min(range.max, dist));
    const percent = (range.max - clampedDist) / (range.max - range.min);
    return percent * 100;
}

zoomSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    const newDist = sliderToDistance(val);
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    camera.position.copy(controls.target).add(direction.multiplyScalar(newDist));
});

function stepZoom(direction) {
    let currentVal = parseFloat(zoomSlider.value);
    const step = 10 * direction;
    const newVal = Math.min(100, Math.max(0, currentVal + step));
    zoomSlider.value = newVal;
    const newDist = sliderToDistance(newVal);
    const vec = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    camera.position.copy(controls.target).add(vec.multiplyScalar(newDist));
}

zoomInBtn.addEventListener('click', () => stepZoom(1));
zoomOutBtn.addEventListener('click', () => stepZoom(-1));

document.getElementById('zoom-controls').addEventListener('mousedown', (e) => e.stopPropagation());
document.getElementById('zoom-controls').addEventListener('touchstart', (e) => e.stopPropagation());
document.getElementById('zoom-controls').addEventListener('wheel', (e) => e.stopPropagation());

// --- Lock Orbit Logic ---
let isOrbitLocked = false;
const lockOrbitBtn = document.getElementById('lock-orbit-btn');

lockOrbitBtn.addEventListener('click', () => {
    isOrbitLocked = !isOrbitLocked;
    if (isOrbitLocked) {
        lockOrbitBtn.textContent = "Unlock Orbit";
        lockOrbitBtn.classList.add('active');
    } else {
        lockOrbitBtn.textContent = "Lock Orbit";
        lockOrbitBtn.classList.remove('active');
    }
});

// --- Lighting ---
const sunLight = new THREE.PointLight(0xffffff, 3.0, 1500, 1);
sunLight.position.set(0, 0, 0);
sunLight.castShadow = true;
sunLight.shadow.bias = -0.0001;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

// --- SOLAR SYSTEM GROUP ---
const solarSystemGroup = new THREE.Group();
scene.add(solarSystemGroup);

// --- GALAXY GROUP ---
const galaxyGroup = new THREE.Group();
galaxyGroup.visible = false;
scene.add(galaxyGroup);

// --- Background Galaxies Group ---
const bgGalaxyGroup = new THREE.Group();
// Add to galaxy group so it rotates with it, or separate if static
galaxyGroup.add(bgGalaxyGroup);

createGalaxy(galaxyGroup);
createBackgroundGalaxies(bgGalaxyGroup);

// --- Objects (Stars) ---
function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(6000 * 3);
    for (let i = 0; i < 6000; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 3000;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 3000;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 3000;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.8 }));
    solarSystemGroup.add(stars);
}
createStars();

// Sun
const sunMat = new THREE.MeshBasicMaterial({
    map: createPlanetTexture("Sun", "#FFAA00", "gas"),
    color: 0xFFDD33
});
const sun = new THREE.Mesh(new THREE.SphereGeometry(12, 64, 64), sunMat);
sun.castShadow = false;
sun.receiveShadow = false;

sun.add(new THREE.Mesh(new THREE.SphereGeometry(13.5, 32, 32), new THREE.MeshBasicMaterial({ color: 0xFF8800, transparent: true, opacity: 0.3, side: THREE.BackSide })));
solarSystemGroup.add(sun);

sun.userData = {
    isSun: true,
    data: {
        name: "The Sun", type: "Yellow Dwarf Star", orbitalPeriod: "230M", rotationPeriod: 27,
        details: { temp: "5,500°C", speed: "220 km/s", atmo: "Hydrogen/Helium", wind: "Solar Wind" }
    }
};

const planets = [];
const moons = [];

planetData.forEach(data => {
    const orbit = new THREE.Mesh(
        new THREE.RingGeometry(data.distance - 0.2, data.distance + 0.2, 128),
        new THREE.MeshBasicMaterial({ color: 0x888888, opacity: 0.2, transparent: true, side: THREE.DoubleSide })
    );
    orbit.rotation.x = Math.PI / 2;
    solarSystemGroup.add(orbit);

    const material = new THREE.MeshPhongMaterial({
        map: createPlanetTexture(data.name, data.color, data.type),
        shininess: 10,
        emissive: new THREE.Color(data.color),
        emissiveIntensity: 0.15
    });

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.size, 64, 64), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { isPlanet: true, data: data };

    const tiltGroup = new THREE.Group();
    tiltGroup.add(mesh);
    tiltGroup.rotation.z = data.tilt * (Math.PI / 180);

    if (data.hasRings) {
        const rings = new THREE.Mesh(
            new THREE.RingGeometry(data.size * 1.4, data.size * 2.3, 128),
            new THREE.MeshStandardMaterial({
                color: data.name === "Uranus" ? 0xAAFFFF : 0xC7B492,
                side: THREE.DoubleSide, transparent: true, opacity: 0.7
            })
        );
        rings.rotation.x = Math.PI / 2;
        rings.receiveShadow = true;
        tiltGroup.add(rings);
    }

    data.moons.forEach(moonData => {
        const moonPivot = new THREE.Group();
        tiltGroup.add(moonPivot);

        const moonMat = new THREE.MeshPhongMaterial({
            map: createPlanetTexture(moonData.name, moonData.color, 'moon'),
            shininess: 5,
            emissive: new THREE.Color(moonData.color),
            emissiveIntensity: 0.1
        });
        const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(moonData.size, 32, 32), moonMat);
        moonMesh.position.set(moonData.distance, 0, 0);
        moonMesh.castShadow = true;
        moonMesh.receiveShadow = true;

        moonMesh.userData = {
            isMoon: true,
            data: {
                name: moonData.name,
                type: "Moon",
                orbitalPeriod: "N/A",
                rotationPeriod: 0,
                details: moonData.details
            }
        };

        moonPivot.add(moonMesh);

        moons.push({
            pivot: moonPivot,
            mesh: moonMesh,
            speed: moonData.speed,
            angle: Math.random() * Math.PI * 2
        });
    });

    const labelDiv = document.createElement('div');
    labelDiv.className = 'planet-label';
    labelDiv.textContent = data.name;
    document.body.appendChild(labelDiv);

    planets.push({
        mesh: mesh,
        tiltGroup: tiltGroup,
        distance: data.distance,
        orbitSpeed: (1 / data.orbitalPeriod),
        rotationSpeed: (1 / data.rotationPeriod),
        angle: Math.random() * Math.PI * 2,
        label: labelDiv
    });

    solarSystemGroup.add(tiltGroup);
});

// --- Interaction Logic ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const panel = document.getElementById('planet-info-panel');
const closeBtn = document.querySelector('.close-btn');

closeBtn.addEventListener('click', () => {
    panel.classList.remove('active');

    // Clear focus
    focusTarget = null;
    isFocusing = false;

    // Return to default view (smoothly)
    // We can use a simple GSAP-like approach or just set a flag, but for now 
    // let's rely on simple interpolation in the loop or reset
    // To make it smooth, we could set a 'returnToOrbit' flag, but as a simple v1:

    // Smooth return to center logic can be handled by simply resetting the controls target
    // and letting the camera stay where it is, or moving it back to a 'home' position.

    // Best UX: Animate back to SOLAR_CAM_POS
    // For now, let's just reset the look-at point and let the user fly back or 
    // we can tween position.

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endTarget = new THREE.Vector3(0, 0, 0);
    const endPos = SOLAR_CAM_POS.clone();

    // Simple manual tween for return
    let frame = 0;
    const maxFrames = 60; // 1 second @ 60fps

    function animateReturn() {
        if (focusTarget !== null) return; // Interrupted
        frame++;
        const t = frame / maxFrames;
        const ease = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        if (t <= 1) {
            controls.target.lerpVectors(startTarget, endTarget, ease);
            camera.position.lerpVectors(startPos, endPos, ease);
            requestAnimationFrame(animateReturn);
        } else {
            controls.target.copy(endTarget);
            // Ensure exact end pos
        }
    }
    animateReturn();
});

function onMouseClick(event) {
    // Don't trigger if clicking UI
    if (event.target.closest('#planet-info-panel') ||
        event.target.closest('.view-btn') ||
        event.target.closest('#zoom-controls') ||
        event.target.id === 'lock-orbit-btn' ||
        event.target.id === 'infographic-btn') return; // added infographic-btn check

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const targetGroup = isGalaxyView ? galaxyGroup : solarSystemGroup;
    const intersects = raycaster.intersectObjects(targetGroup.children, true);

    for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;

        if (obj.type === 'Points' && !obj.userData.isGalaxy) continue;
        if (obj.type === 'Line') continue;

        if ((!obj.userData.isPlanet && !obj.userData.isMoon && !obj.userData.isSun && !obj.userData.isGalaxy) && obj.parent) {
            const siblings = obj.parent.children;
            const planetMesh = siblings.find(child => child.userData.isPlanet);
            if (planetMesh) obj = planetMesh;
        }

        if (obj && (obj.userData.isPlanet || obj.userData.isSun || obj.userData.isMoon || obj.userData.isGalaxy)) {
            showPanel(obj.userData.data);

            // Set Focus Target
            if (obj.userData.isPlanet || obj.userData.isSun || obj.userData.isMoon) {
                focusTarget = obj;
                isFocusing = true;
                focusTransitionTime = 0;
            }
            return;
        }
    }
}

window.addEventListener('pointerdown', (e) => { window.clickStartX = e.clientX; window.clickStartY = e.clientY; });
window.addEventListener('pointerup', (e) => {
    if (Math.abs(e.clientX - window.clickStartX) < 5 && Math.abs(e.clientY - window.clickStartY) < 5) onMouseClick(e);
});

function showPanel(data) {
    document.getElementById('panel-name').textContent = data.name;
    document.getElementById('panel-type').textContent = data.type;

    const isStar = data.type.includes("Star");
    const isGalaxy = data.type.includes("Galaxy");

    if (isGalaxy) {
        document.getElementById('panel-year').textContent = "230 Million Years";
    } else {
        document.getElementById('panel-year').textContent = isStar ? "230 Million Years (Galactic)" : (data.orbitalPeriod === 0 ? "N/A" : `${data.orbitalPeriod} Years`);
    }

    const rot = Math.abs(data.rotationPeriod);
    const val = rot < 1 ? (rot * 24).toFixed(1) + " Hours" : rot + " Days";
    document.getElementById('panel-day').textContent = val;

    document.getElementById('panel-temp').textContent = data.details.temp;
    document.getElementById('panel-speed').textContent = data.details.speed;
    document.getElementById('panel-atmo').textContent = data.details.atmo;
    document.getElementById('panel-wind').textContent = data.details.wind;

    panel.classList.add('active');
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- View Transition Logic ---
let isGalaxyView = false;
let isTransitioning = false;
const viewGalaxyBtn = document.getElementById('view-galaxy-btn');
const viewSolarBtn = document.getElementById('view-solar-btn');

// (Utility function 'lerp' is imported from utils.js, but was inline before. Used in animate loop now)
// Actually lerp function from utils is general purpose. 
// The animation loop used direct math. Let's see.
// The animation loop implemented custom lerp for vector3 using lerpVectors.
// And scalar lerp using setScalar(1-t) etc. 

let transitionTime = 0;
const transitionDuration = 2.0;

viewGalaxyBtn.addEventListener('click', () => {
    if (isTransitioning) return;
    isTransitioning = true;
    isGalaxyView = true;

    galaxyGroup.visible = true;
    viewGalaxyBtn.style.display = 'none';
    lockOrbitBtn.style.display = 'none';

    panel.classList.remove('active');
});

viewSolarBtn.addEventListener('click', () => {
    if (isTransitioning) return;
    isTransitioning = true;
    isGalaxyView = false;

    solarSystemGroup.visible = true;
    viewSolarBtn.style.display = 'none';
    lockOrbitBtn.style.display = 'block';

    panel.classList.remove('active');
});

// --- Focus Logic Variables ---
let focusTarget = null;
let isFocusing = false;
let focusTransitionTime = 0;
const focusDuration = 1.5;
const returnDuration = 2.0;

// Store initial camera state for return
const defaultControlTarget = new THREE.Vector3(0, 0, 0);

// --- Animation Loop ---
const clock = new THREE.Clock(); // Re-declaring to be safe, though it was there.

function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    if (isTransitioning) {
        transitionTime += dt;
        let t = Math.min(transitionTime / transitionDuration, 1);
        t = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        if (isGalaxyView) {
            camera.position.lerpVectors(SOLAR_CAM_POS, GALAXY_CAM_POS, t);
            solarSystemGroup.scale.setScalar(1 - t);
            galaxyGroup.scale.setScalar(t);
        } else {
            camera.position.lerpVectors(GALAXY_CAM_POS, SOLAR_CAM_POS, t);
            solarSystemGroup.scale.setScalar(t);
            galaxyGroup.scale.setScalar(1 - t);
        }

        if (transitionTime >= transitionDuration) {
            isTransitioning = false;
            transitionTime = 0;
            if (isGalaxyView) {
                solarSystemGroup.visible = false;
                viewSolarBtn.style.display = 'block';
            } else {
                galaxyGroup.visible = false;
                viewGalaxyBtn.style.display = 'block';
            }
        }
    }

    // --- Planet Focus Logic ---
    if (focusTarget && !isGalaxyView && !isTransitioning) {
        // Calculate target camera position (relative to planet)
        // We want to be at a certain distance/offset from the planet
        const targetPos = new THREE.Vector3();
        // Get scale of planet to determine feedback distance
        let distOffset = 15; // Default fallback

        if (focusTarget.userData.data && focusTarget.userData.data.size) {
            distOffset = focusTarget.userData.data.size * 4.0;
        } else if (focusTarget.geometry && focusTarget.geometry.parameters.radius) {
            distOffset = focusTarget.geometry.parameters.radius * 4.0;
        }

        // We want to maintain the current camera angle if possible, or a fixed one.
        // Let's use a fixed offset relative to the planet for simplicity and best view
        // The side view (x-axis offset) looks good usually. 
        const offsetVec = new THREE.Vector3(distOffset, distOffset * 0.5, distOffset);

        // Real-time position of the planet
        const planetWorldPos = new THREE.Vector3();
        focusTarget.getWorldPosition(planetWorldPos);

        const desiredCamPos = planetWorldPos.clone().add(offsetVec);

        if (isFocusing) {
            focusTransitionTime += dt;
            let t = Math.min(focusTransitionTime / focusDuration, 1);
            // Easing
            t = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            camera.position.lerp(desiredCamPos, 0.1); // Smooth follow using small factor or t?
            // Since the target moves, lerp(current, desired, factor) is better for tracking than lerpVectors with time
            // But for the initial "zoom in" we might want a stronger pull.

            // Let's us simple damping for smooth follow
            camera.position.lerp(desiredCamPos, 0.05);
            controls.target.lerp(planetWorldPos, 0.05);

            if (camera.position.distanceTo(desiredCamPos) < 1 && controls.target.distanceTo(planetWorldPos) < 0.5) {
                isFocusing = false; // Arrived
            }
        } else {
            // Hard lock / Maintain relative position + user orbit ability?
            // Actually, if we update controls.target to planet, user can rotate around it.
            // We just need to nudge the camera to keep following.

            controls.target.copy(planetWorldPos);

            // Optional: Force camera to stay close? 
            // If we don't update camera.position, it will stay behind as planet moves away.
            // So we must update camera position to follow.
            // To allow user rotation, we should add the *delta* of planet movement to camera.
            // Or simpler: just let OrbitControls handle it if we update target? 
            // No, OrbitControls only orbits target. If target moves, camera stays put -> relative angle changes.
            // To "lock" the view:
            const currentOffset = camera.position.clone().sub(controls.target);
            camera.position.copy(planetWorldPos).add(currentOffset);
        }
    } else if (!focusTarget && !isGalaxyView && !isTransitioning) {
        // Return logic if needed, but usually handled by one-off transition when closing
        // We can just rely on OrbitControls damping to settle back if we reset target.
    }

    if (solarSystemGroup.visible) {
        // Rotate Sun
        if (!isOrbitLocked) {
            sun.rotation.y += 0.002;
        }

        // Move Planets
        planets.forEach(p => {
            if (!isOrbitLocked) {
                p.angle += p.orbitSpeed * SCENE_CONFIG.orbitSpeedMultiplier * 0.01;
                p.tiltGroup.position.x = Math.cos(p.angle) * p.distance;
                p.tiltGroup.position.z = Math.sin(p.angle) * p.distance;
                p.mesh.rotation.y += p.rotationSpeed * SCENE_CONFIG.rotationSpeedMultiplier;
            }
            updateLabel(p);
        });

        // Move Moons
        moons.forEach(m => {
            if (!isOrbitLocked) {
                m.angle += m.speed * SCENE_CONFIG.moonOrbitSpeedMultiplier * 0.1;
                m.mesh.position.x = Math.cos(m.angle) * m.mesh.position.length();
                m.mesh.position.z = Math.sin(m.angle) * m.mesh.position.length();
            }
        });
    }

    if (galaxyGroup.visible) {
        galaxyGroup.rotation.y += 0.0005;
        const dist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
        const fadeStart = 2500;
        const fadeEnd = 5000;
        let opacity = 0;
        if (dist > fadeStart) {
            opacity = Math.min(1, (dist - fadeStart) / (fadeEnd - fadeStart));
        }
        if (bgGalaxyGroup.children.length > 0) {
            bgGalaxyGroup.children[0].material.opacity = opacity;
        }
    }

    controls.update();

    if (!isTransitioning && !focusTarget) {
        const dist = camera.position.distanceTo(controls.target);
        zoomSlider.value = distanceToSlider(dist);
    }

    renderer.render(scene, camera);
}

function updateLabel(planet) {
    if (isGalaxyView || isTransitioning) {
        planet.label.style.display = 'none';
        return;
    }

    const tempV = new THREE.Vector3();
    tempV.setFromMatrixPosition(planet.mesh.matrixWorld);
    tempV.project(camera);

    const x = (tempV.x * .5 + .5) * window.innerWidth;
    const y = (tempV.y * -.5 + .5) * window.innerHeight;

    const dist = camera.position.distanceTo(planet.tiltGroup.position);
    const opacity = Math.max(0, 1 - (dist / 800));

    if (tempV.z > 1 || opacity <= 0) {
        planet.label.style.display = 'none';
    } else {
        planet.label.style.display = 'block';
        planet.label.style.left = `${x}px`;
        planet.label.style.top = `${y}px`;
        planet.label.style.opacity = opacity.toString();
    }
}

document.getElementById('loading').style.opacity = 0;
setTimeout(() => document.getElementById('loading').remove(), 500);

animate();
