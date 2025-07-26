import { initScene } from './scene.js';

// Initialize the Three.js scene
const sceneAPI = initScene();

// Example of how to use the exported API
// sceneAPI.createBox({ color: 0xffff00, position: { x: 2, y: 1, z: 2 } });
// sceneAPI.loadEnvironment('path/to/another.hdr');

console.log('Three.js scene initialized!');