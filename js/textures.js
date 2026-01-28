import * as THREE from 'three';
import { darkenColor } from './utils.js';

export function createPlanetTexture(name, baseColor, type) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, baseColor);
    try { gradient.addColorStop(0.5, darkenColor(baseColor, 20)); } catch (e) { gradient.addColorStop(0.5, baseColor); }
    gradient.addColorStop(1, baseColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    if (type === 'gas') {
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`;
            ctx.fillRect(0, Math.random() * size, size, Math.random() * 30 + 10);
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`;
            ctx.fillRect(0, Math.random() * size, size, Math.random() * 30 + 10);
        }
    } else if (type === 'rocky' || type === 'moon') {
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = Math.random() * 10 + 2;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.15})`;
            ctx.fill();
        }
    } else if (type === 'earth') {
        ctx.fillStyle = '#225533';
        for (let i = 0; i < 80; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = Math.random() * 80 + 20;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let i = 0; i < 50; i++) {
            ctx.fillRect(Math.random() * size, Math.random() * size, 300, 25);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
