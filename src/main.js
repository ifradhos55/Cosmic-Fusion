import './ui/styles.css';
import './ui/touch.css';
import { App } from './app/App.js';

try {
  const app = new App(document.getElementById('app'));
  app.start();
  if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
} catch (error) {
  console.error('Cosmic Fusion could not start.', error);
  document.getElementById('app').innerHTML = `<main class="startup-error"><span class="eyebrow">COSMIC FUSION</span><h1>A little turbulence.</h1><p>This simulation needs WebGL 2. Enable graphics acceleration in your browser, then reload to begin exploring.</p><button onclick="location.reload()">Try again</button></main>`;
}
