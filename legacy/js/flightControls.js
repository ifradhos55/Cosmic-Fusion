import * as THREE from 'three';

const keys = {
    w: false, a: false, s: false, d: false,
    q: false, e: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    Shift: false
};

// Physics state
let velocity = 0;
const maxSpeed = 150; // Base max speed
const boostSpeed = 400; // Shift speed
const acceleration = 100;
const damping = 0.95; // Friction

// Rotation state
const rotationVelocity = new THREE.Vector3(0, 0, 0); // pitch, yaw, roll
const rotationAccel = 2.0;
const rotationDamping = 0.85;

    // Mouse state
    export const mouseState = {
        movementX: 0,
        movementY: 0,
        isLocked: false
    };

    export function initFlightControls() {
        window.addEventListener('keydown', (e) => {
            if (keys.hasOwnProperty(e.key)) {
                keys[e.key] = true;
            } else if (e.key === 'Shift') {
                keys.Shift = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (keys.hasOwnProperty(e.key)) {
                keys[e.key] = false;
            } else if (e.key === 'Shift') {
                keys.Shift = false;
            }
        });

        // Mouse movement for steering
        document.addEventListener('mousemove', (e) => {
            if (mouseState.isLocked) {
                mouseState.movementX += e.movementX;
                mouseState.movementY += e.movementY;
            }
        });
        
        // Pointer lock setup happens in main.js on button click
        document.addEventListener('pointerlockchange', () => {
            mouseState.isLocked = (document.pointerLockElement !== null);
        });
    }

export function updateFlight(spaceship, camera, dt) {
    if (!spaceship) return;

    // --- Throttle (Forward / Reverse) ---
    const currentMax = keys.Shift ? boostSpeed : maxSpeed;
    if (keys.w || keys.ArrowUp) {
        velocity += acceleration * dt;
    } else if (keys.s || keys.ArrowDown) {
        velocity -= acceleration * dt;
    }

    velocity *= damping;
    if (velocity > currentMax) velocity = currentMax;
    if (velocity < -currentMax / 3) velocity = -currentMax / 3;

    // Move ship forward along its local Z axis
    spaceship.translateZ(velocity * dt);

    // --- Rotation (Pitch, Yaw, Roll) ---
    // Keyboard inputs
    if (keys.ArrowUp) rotationVelocity.x -= rotationAccel * dt;
    if (keys.ArrowDown) rotationVelocity.x += rotationAccel * dt;
    if (keys.a || keys.ArrowLeft) rotationVelocity.y += rotationAccel * dt;
    if (keys.d || keys.ArrowRight) rotationVelocity.y -= rotationAccel * dt;
    if (keys.q) rotationVelocity.z += rotationAccel * dt;
    if (keys.e) rotationVelocity.z -= rotationAccel * dt;

    // Mouse inputs (Minecraft-style steering)
    if (mouseState.isLocked) {
        const mouseSensitivity = 0.05; // Adjust as needed
        // Mouse X controls Yaw (negative is right turn)
        rotationVelocity.y -= mouseState.movementX * mouseSensitivity * dt;
        // Mouse Y controls Pitch (positive is pitch down)
        rotationVelocity.x -= mouseState.movementY * mouseSensitivity * dt;
        
        // Reset accumulated movement after consuming
        mouseState.movementX = 0;
        mouseState.movementY = 0;
    }

    rotationVelocity.multiplyScalar(rotationDamping);

    // Apply rotation relative to local axes
    spaceship.rotateX(rotationVelocity.x);
    spaceship.rotateY(rotationVelocity.y);
    spaceship.rotateZ(rotationVelocity.z);

    // --- Camera Follow (3rd Person) ---
    const tPos = 1.0 - Math.exp(-5.0 * dt);
    const tRot = 1.0 - Math.exp(-15.0 * dt); // Rotation snaps faster than position

    // 1. Smooth Position Follow
    const idealOffset = new THREE.Vector3(0, 8, -35);
    const idealPos = idealOffset.applyMatrix4(spaceship.matrixWorld);
    camera.position.lerp(idealPos, tPos);

    // 2. Smooth Rotation (Look at ship, align with ship's UP)
    const lookAtTarget = new THREE.Vector3(0, 3, 0).applyMatrix4(spaceship.matrixWorld);
    const shipUp = new THREE.Vector3(0, 1, 0).transformDirection(spaceship.matrixWorld);
    
    const m = new THREE.Matrix4().lookAt(camera.position, lookAtTarget, shipUp);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
    
    camera.quaternion.slerp(targetQuat, tRot);

    // Update HUD Speed
    const speedEl = document.getElementById('hud-speed');
    if (speedEl) {
        speedEl.innerHTML = `${Math.abs(Math.round(velocity))} <small>km/s</small>`;
    }
}
