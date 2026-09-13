import * as THREE from 'three';

export function createRenderer(container, quality = 'high') {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1.25));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x060a10);
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D solar system. Drag to orbit, scroll to zoom.');
  renderer.domElement.setAttribute('tabindex', '0');
  container.appendChild(renderer.domElement);
  return renderer;
}
