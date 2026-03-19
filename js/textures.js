import * as THREE from 'three';
import { darkenColor } from './utils.js';

export function createPlanetTexture(name, baseColor, type) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (type === 'sun') {
        const radGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        radGrad.addColorStop(0, '#FFFFFF'); radGrad.addColorStop(0.2, '#FFFFAA');
        radGrad.addColorStop(0.4, '#FFCC33'); radGrad.addColorStop(0.7, '#FF8800');
        radGrad.addColorStop(1, '#CC4400'); ctx.fillStyle = radGrad; ctx.fillRect(0, 0, size, size);
        for (let j = 0; j < 6; j++) {
            const layerSize = 3000 / (j + 1);
            for (let i = 0; i < layerSize; i++) {
                const x = Math.random() * size; const y = Math.random() * size;
                const r = (Math.random() * 50 + 10) / (j + 1); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
                const blur = ctx.createRadialGradient(x, y, 0, x, y, r);
                const color = Math.random() > 0.4 ? '#FFAA00' : '#FFFFFF';
                blur.addColorStop(0, color + '99'); blur.addColorStop(1, color + '00');
                ctx.fillStyle = blur; ctx.fill();
            }
        }
    } else if (name === 'Mars') {
        ctx.fillStyle = '#BC2732'; ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * size; const y = Math.random() * size;
            const rx = Math.random() * 300 + 50; const ry = Math.random() * 200 + 50;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, rx);
            grad.addColorStop(0, 'rgba(40, 20, 10, 0.4)'); grad.addColorStop(1, 'rgba(40, 20, 10, 0)');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(30, 10, 0, 0.6)'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(300, 512);
        for (let i = 320; i < 800; i += 20) { ctx.lineTo(i, 512 + (Math.random() * 20 - 10)); }
        ctx.stroke();
        for (let i = 0; i < 100000; i++) {
            const x = Math.floor(Math.random() * size); const y = Math.floor(Math.random() * size);
            const r = Math.random() * 1.5; const cT = Math.random();
            if (cT > 0.8) ctx.fillStyle = '#8B000022';
            else if (cT > 0.6) ctx.fillStyle = '#D2691E22';
            else ctx.fillStyle = '#E9967A11';
            ctx.fillRect(x, y, r, r);
        }
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * size; const y = Math.random() * size; const r = Math.random() * 20 + 2;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; ctx.lineWidth = 1; ctx.stroke();
            const g = ctx.createRadialGradient(x, y, r * 0.8, x + r*0.2, y + r*0.2, r); g.addColorStop(0, 'rgba(255, 255, 255, 0.05)'); g.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            ctx.fillStyle = g; ctx.fill();
        }
    } else if (type === 'pluto') {
        ctx.fillStyle = '#C0A080'; ctx.fillRect(0, 0, size, size);
        // Tombaugh Regio (The Heart)
        ctx.fillStyle = '#F5F5F0';
        ctx.beginPath();
        const hX = size * 0.45; const hY = size * 0.5;
        ctx.moveTo(hX, hY);
        ctx.bezierCurveTo(hX - 120, hY - 100, hX - 220, hY + 150, hX, hY + 220);
        ctx.bezierCurveTo(hX + 220, hY + 150, hX + 120, hY - 100, hX, hY);
        ctx.fill();
        // Cthulhu Macula (Dark Tholins)
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * size; const y = size * 0.65 + Math.random() * size * 0.35;
            const rx = Math.random() * 250 + 100; const ry = Math.random() * 120 + 40;
            const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
            g.addColorStop(0, 'rgba(50, 20, 10, 0.8)'); g.addColorStop(1, 'rgba(50, 20, 10, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2); ctx.fill();
        }
        // Surface Detail & Nitrogen Ice
        for (let i = 0; i < 80000; i++) {
            const x = Math.floor(Math.random() * size); const y = Math.floor(Math.random() * size);
            const c = Math.random();
            if (c > 0.98) ctx.fillStyle = 'rgba(173, 216, 230, 0.15)'; // Blue tint nitrogen ice
            else if (c > 0.85) ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            else ctx.fillStyle = `rgba(80, 40, 20, ${Math.random() * 0.03})`;
            ctx.fillRect(x, y, 1, 1);
        }
    } else if (type === 'moon') {
        ctx.fillStyle = '#666666'; ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 20000; i++) {
            const x = Math.random() * size; const y = Math.random() * size; const r = Math.random() * 2;
            ctx.fillStyle = `rgba(${Math.random()*50+50}, ${Math.random()*50+50}, ${Math.random()*50+50}, ${Math.random()*0.2})`; ctx.fillRect(x, y, r, r);
        }
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * size; const y = Math.random() * size; const r = Math.random() * 150 + 50;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(20, 20, 20, 0.5)'); g.addColorStop(1, 'rgba(20, 20, 20, 0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
    } else if (name === 'Jupiter') {
        ctx.fillStyle = '#E3D3A3'; ctx.fillRect(0, 0, size, size);
        const bands = [
            { y: 0.1, h: 0.1, c: '#C88B3A' }, { y: 0.25, h: 0.15, c: '#DAB686' },
            { y: 0.4, h: 0.08, c: '#A26F3A' }, { y: 0.5, h: 0.12, c: '#E2975D' },
            { y: 0.65, h: 0.1, c: '#B57D3E' }, { y: 0.8, h: 0.1, c: '#6B4226' }
        ];
        bands.forEach(b => {
            ctx.fillStyle = b.c; ctx.beginPath(); ctx.moveTo(0, b.y * size);
            for (let x = 0; x <= size; x += 10) { const wave = Math.sin(x * 0.02) * 15 + Math.sin(x * 0.05) * 5; ctx.lineTo(x, b.y * size + wave); }
            ctx.lineTo(size, (b.y + b.h) * size);
            for (let x = size; x >= 0; x -= 10) { const wave = Math.sin(x * 0.02) * 15 + Math.sin(x * 0.05) * 5; ctx.lineTo(x, (b.y + b.h) * size + wave); }
            ctx.closePath(); ctx.fill();
            for(let i=0; i<400; i++) {
                const wx = Math.random() * size; const wy = (b.y + Math.random() * b.h) * size;
                ctx.fillStyle = b.c + '44'; ctx.fillRect(wx, wy, Math.random()*50, 1);
            }
        });

        // --- GREAT RED SPOT (Scientifically Scaled to "Dot" status) ---
        const grsX = size * 0.72; const grsY = size * 0.62; 
        const grsW = 32; const grsH = 18; 
        ctx.fillStyle = 'rgba(60, 0, 0, 0.6)'; ctx.beginPath(); ctx.ellipse(grsX, grsY, grsW + 2, grsH + 2, 0.1, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 5; i++) {
            const sW = grsW * (1 - i * 0.2); const sH = grsH * (1 - i * 0.2);
            const rot = 0.2 + (i * 0.1); const color = i % 2 === 0 ? '#D44A27' : '#A52A2A';
            ctx.save(); ctx.translate(grsX, grsY); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, sW, sH, 0, 0, Math.PI * 2);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sW); g.addColorStop(0, color); g.addColorStop(1, darkenColor(color, 30));
            ctx.fillStyle = g; ctx.fill(); ctx.restore();
        }
        for (let i = 0; i < 15; i++) {
            const wx = grsX + (Math.random() * 60 - 30); const wy = grsY + (Math.random() * 16 - 8);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; ctx.beginPath(); ctx.ellipse(wx, wy, Math.random()*12, Math.random()*6, Math.random()*Math.PI, 0, Math.PI * 2); ctx.fill();
        }
        for (let i = 0; i < 40; i++) {
            const ex = Math.random() * size; const ey = Math.random() * size; const er = Math.random() * 15 + 2;
            const color = Math.random() > 0.7 ? '#FFFFFF' : '#443322';
            const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, er); grad.addColorStop(0, color + '66'); grad.addColorStop(1, color + '00');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
        }
        for (let i = 0; i < 50000; i++) {
            const x = Math.floor(Math.random()*size); const y = Math.floor(Math.random()*size);
            ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.05})`; ctx.fillRect(x,y,1,1);
        }
    } else if (type === 'earth') {
        ctx.fillStyle = '#0a1a2e'; // Deep Deep Blue
        ctx.fillRect(0, 0, size, size);

        const drawPolygon = (points, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(points[0].x * size, points[0].y * size);
            for (let i = 1; i < points.length; i++) { ctx.lineTo(points[i].x * size, points[i].y * size); }
            ctx.closePath();
            ctx.fill();
        };

        // --- EARTH: CONTINENT MAPPING (High Fidelity Procedural) ---
        
        // North America
        drawPolygon([
            {x: 0.12, y: 0.15}, {x: 0.28, y: 0.12}, {x: 0.35, y: 0.18}, {x: 0.32, y: 0.25},
            {x: 0.38, y: 0.32}, {x: 0.42, y: 0.35}, {x: 0.40, y: 0.42}, {x: 0.35, y: 0.45},
            {x: 0.28, y: 0.48}, {x: 0.22, y: 0.45}, {x: 0.18, y: 0.38}, {x: 0.15, y: 0.32},
            {x: 0.10, y: 0.28}, {x: 0.08, y: 0.22}
        ], '#2D5A27');
        
        // South America
        drawPolygon([
            {x: 0.28, y: 0.48}, {x: 0.35, y: 0.50}, {x: 0.42, y: 0.55}, {x: 0.40, y: 0.65},
            {x: 0.38, y: 0.75}, {x: 0.32, y: 0.88}, {x: 0.28, y: 0.92}, {x: 0.22, y: 0.85},
            {x: 0.20, y: 0.75}, {x: 0.22, y: 0.65}, {x: 0.25, y: 0.55}
        ], '#1E4620');
        
        // Africa
        drawPolygon([
            {x: 0.45, y: 0.42}, {x: 0.52, y: 0.40}, {x: 0.62, y: 0.42}, {x: 0.65, y: 0.48},
            {x: 0.63, y: 0.60}, {x: 0.58, y: 0.75}, {x: 0.52, y: 0.88}, {x: 0.48, y: 0.85},
            {x: 0.45, y: 0.75}, {x: 0.42, y: 0.65}, {x: 0.40, y: 0.55}, {x: 0.42, y: 0.48}
        ], '#3D5A27');
        
        // Eurasia
        drawPolygon([
            {x: 0.48, y: 0.38}, {x: 0.45, y: 0.25}, {x: 0.48, y: 0.15}, {x: 0.55, y: 0.10},
            {x: 0.70, y: 0.08}, {x: 0.85, y: 0.10}, {x: 0.95, y: 0.15}, {x: 0.98, y: 0.28},
            {x: 0.95, y: 0.45}, {x: 0.88, y: 0.52}, {x: 0.82, y: 0.55}, {x: 0.75, y: 0.48},
            {x: 0.68, y: 0.45}, {x: 0.60, y: 0.48}, {x: 0.55, y: 0.52}, {x: 0.48, y: 0.42}
        ], '#224D26');
        
        // Australia
        drawPolygon([
            {x: 0.78, y: 0.68}, {x: 0.88, y: 0.65}, {x: 0.95, y: 0.72}, {x: 0.92, y: 0.85},
            {x: 0.82, y: 0.88}, {x: 0.78, y: 0.80}
        ], '#4A612B');

        // Ice Caps
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size * 0.08); // North
        ctx.fillRect(0, size * 0.92, size, size * 0.08); // South

        // Surface Grain & Biological Detail
        const pixelData = ctx.getImageData(0, 0, size, size).data;
        for (let i = 0; i < 150000; i++) {
            const x = Math.floor(Math.random()*size); const y = Math.floor(Math.random()*size); const idx = (y*size+x)*4;
            if (pixelData[idx+1] > pixelData[idx+2]) { // If green/land
                if (y < size*0.18 || y > size*0.88) ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random()*0.4})`;
                else if (y > size*0.45 && y < size*0.55) ctx.fillStyle = `rgba(10,50,10,${Math.random()*0.3})`;
                else { const c = Math.random()>0.8?'#8B4513':(Math.random()>0.5?'#1E3B21':'#3E5C31'); ctx.fillStyle = c+'77'; }
                ctx.fillRect(x,y,1,1);
            } else { // If ocean
                if (Math.random()>0.9995) { ctx.fillStyle = 'rgba(100,200,255,0.08)'; ctx.fillRect(x,y,1,1); }
            }
        }
    } else {
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, baseColor);
        try { gradient.addColorStop(0.5, darkenColor(baseColor, 20)); } catch (e) { gradient.addColorStop(0.5, baseColor); }
        gradient.addColorStop(1, baseColor); ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function createSunFlareTexture() {
    const size = 256; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size); // NEW: Ensure base is empty/transparent
    
    // REDUCED RADIUS: From size/2 to size*0.48 to guarantee zero alpha at corners
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size * 0.48);
    grad.addColorStop(0, 'rgba(255, 255, 240, 1)'); 
    grad.addColorStop(0.3, 'rgba(255, 220, 100, 0.6)');
    grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size); 
    return new THREE.CanvasTexture(canvas);
}

export function createCloudTexture() {
    const size = 1024; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,size,size);
    for (let i = 0; i < 1200; i++) { 
        const x = Math.random()*size; const y = Math.random()*size;
        const rx = Math.random()*60+5; const ry = Math.random()*12+2; const rot = Math.random()*Math.PI;
        ctx.beginPath(); const grad = ctx.createRadialGradient(x,y,0,x,y,rx);
        const o = Math.random()*0.15; grad.addColorStop(0, `rgba(255,255,255,${o})`); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.ellipse(x,y,rx,ry,rot,0,Math.PI*2); ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
}
