import { val } from './test_module.js';
console.log('Importer loaded. Val:', val);
document.getElementById('status').textContent = 'Importer success: ' + val;
