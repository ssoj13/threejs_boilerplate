import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Global variables
let scene, camera, renderer, controls;
let autoRotate = true;
let autoRotateSpeed = 0.5;
let userInteracting = false;
let userInteractionTimeout;
let autoRotateStartTime = 0;
let autoRotateStartAngle = 0;

// Initialize the basic scene setup
function init(container) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }
}

// Create a procedural checker texture
function createCheckerTexture(size = 512, checkers = 8, c1 = '#ffffff', c2 = '#000000') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    const checkerSize = size / checkers;
    
    for (let i = 0; i < checkers; i++) {
        for (let j = 0; j < checkers; j++) {
            const isEven = (i + j) % 2 === 0;
            context.fillStyle = isEven ? c1 : c2;
            context.fillRect(i * checkerSize, j * checkerSize, checkerSize, checkerSize);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    
    return texture;
}

// Create a roughness texture from checker pattern (remapped to 0.5-0.75 range)
function createCheckerRoughnessTexture(size = 512, checkers = 8, c1 = 0.1, c2 = 0.5) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const checkerSize = size / checkers;
    for (let i = 0; i < checkers; i++) {
        for (let j = 0; j < checkers; j++) {
            const isEven = (i + j) % 2 === 0;
            // Use provided roughness values for each checker color
            const grayValue = isEven ? Math.round(c1 * 255) : Math.round(c2 * 255);
            const hexValue = grayValue.toString(16).padStart(2, '0');
            context.fillStyle = `#${hexValue}${hexValue}${hexValue}`;
            context.fillRect(i * checkerSize, j * checkerSize, checkerSize, checkerSize);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
}

// Create a plane with customizable options
function createPlane(options = {}) {
    const {
        width = 50,
        height = 50,
        color = 0x808080,
        position = { x: 0, y: 0, z: 0 },
        rotation = { x: -Math.PI / 2, y: 0, z: 0 },
        receiveShadow = true,
        useChecker = false,
        checkerSize = 4,
        metalness = 0.1,
        roughness = 0.3
    } = options;
    
    const geometry = new THREE.PlaneGeometry(width, height);
    
    let material;
    if (useChecker) {
        const checkerTexture = createCheckerTexture(512, checkerSize);
        const roughnessTexture = createCheckerRoughnessTexture(512, checkerSize);
        
        checkerTexture.repeat.set(width / 20, height / 20); // Scale texture to plane size (half frequency)
        roughnessTexture.repeat.set(width / 20, height / 20); // Match the diffuse texture repeat
        
        material = new THREE.MeshStandardMaterial({
            map: checkerTexture,
            roughnessMap: roughnessTexture,
            metalness: metalness,
            roughness: 1.0 // This will be multiplied by the roughness map
        });
    } else {
        material = new THREE.MeshLambertMaterial({ color });
    }
    
    const plane = new THREE.Mesh(geometry, material);
    
    plane.position.set(position.x, position.y, position.z);
    plane.rotation.set(rotation.x, rotation.y, rotation.z);
    plane.receiveShadow = receiveShadow;
    
    scene.add(plane);
    return plane;
}

// Create a box with customizable options
function createBox(options = {}) {
    const {
        width = 2,
        height = 2,
        depth = 2,
        color = 0x00ff00,
        position = { x: 0, y: 1, z: 0 },
        castShadow = true,
        material = 'standard' // 'lambert' or 'standard'
    } = options;
    
    const geometry = new THREE.BoxGeometry(width, height, depth);
    
    // Use PBR material for better environment reflections
    const mat = material === 'standard' 
        ? new THREE.MeshStandardMaterial({ 
            color, 
            metalness: 0.1, 
            roughness: 0.7 
          })
        : new THREE.MeshLambertMaterial({ color });
    
    const box = new THREE.Mesh(geometry, mat);
    
    box.position.set(position.x, position.y, position.z);
    box.castShadow = castShadow;
    
    scene.add(box);
    return box;
}

// Setup lighting with customizable options
function setupLighting(options = {}) {
    const {
        ambientColor = 0x404040,
        ambientIntensity = 0.4,
        directionalColor = 0xffffff,
        directionalIntensity = 1,
        directionalPosition = { x: 10, y: 10, z: 5 },
        shadowMapSize = 2048
    } = options;
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambientLight);
    
    // Directional light
    const directionalLight = new THREE.DirectionalLight(directionalColor, directionalIntensity);
    directionalLight.position.set(directionalPosition.x, directionalPosition.y, directionalPosition.z);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = shadowMapSize;
    directionalLight.shadow.mapSize.height = shadowMapSize;
    scene.add(directionalLight);
    
    return { ambientLight, directionalLight };
}

// Setup camera and controls
function setupCameraControls(options = {}) {
    const {
        cameraPosition = { x: 10, y: 10, z: 10 },
        enableDamping = true,
        dampingFactor = 0.05,
        autoRotateSpeed = 0.5
    } = options;
    
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = enableDamping;
    controls.dampingFactor = dampingFactor;
    controls.autoRotate = false; // We'll handle this manually
    
    // Event listeners for user interaction
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('end', onControlsEnd);
    
    return controls;
}

// Load HDR environment map
function loadEnvironment(hdrPath = null) {
    const loader = new RGBELoader();
    
    // If no HDR path provided, create a simple gradient environment
    if (!hdrPath) {
        // Create a simple procedural environment
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        const envScene = new THREE.Scene();
        
        // Create gradient background
        const geometry = new THREE.SphereGeometry(100, 32, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x87CEEB, // Sky blue
            side: THREE.BackSide
        });
        const skybox = new THREE.Mesh(geometry, material);
        envScene.add(skybox);
        
        const envTexture = pmremGenerator.fromScene(envScene).texture;
        scene.environment = envTexture;
        scene.background = envTexture;
        
        pmremGenerator.dispose();
        return;
    }
    
    // Load HDR file
    loader.load(hdrPath, (texture) => {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        
        scene.environment = envMap;
        scene.background = envMap;
        
        texture.dispose();
        pmremGenerator.dispose();
        
        console.log('HDR environment loaded successfully');
    }, undefined, (error) => {
        console.error('Error loading HDR environment:', error);
        // Fallback to simple environment
        loadEnvironment();
    });
}

// Handle user interaction start
function onControlsStart() {
    userInteracting = true;
    clearTimeout(userInteractionTimeout);
}

// Handle user interaction end
function onControlsEnd() {
    userInteractionTimeout = setTimeout(() => {
        userInteracting = false;
        // Calculate current angle when resuming auto-rotation
        const targetPos = controls.target;
        const currentPos = camera.position.clone().sub(targetPos);
        autoRotateStartAngle = Math.atan2(currentPos.z, currentPos.x);
        autoRotateStartTime = Date.now();
    }, 500); // Resume auto-rotation 500ms after user stops interacting
}

// Auto-rotate camera around the center
function updateAutoRotation() {
    if (!userInteracting && autoRotate) {
        // Calculate elapsed time since auto-rotation resumed
        const elapsedTime = (Date.now() - autoRotateStartTime) * 0.0005 * autoRotateSpeed;
        const currentAngle = autoRotateStartAngle + elapsedTime;
        
        // Get current camera position relative to target
        const targetPos = controls.target;
        const currentPos = camera.position.clone().sub(targetPos);
        
        // Calculate horizontal distance (x-z plane) and preserve height (y)
        const horizontalDistance = Math.sqrt(currentPos.x * currentPos.x + currentPos.z * currentPos.z);
        const height = currentPos.y;
        
        // Rotate around Y axis while preserving distance and height
        const newX = Math.cos(currentAngle) * horizontalDistance;
        const newZ = Math.sin(currentAngle) * horizontalDistance;
        
        // Set new camera position
        camera.position.set(
            targetPos.x + newX,
            targetPos.y + height,
            targetPos.z + newZ
        );
        
        camera.lookAt(targetPos);
    }
}

// Main populate function to create the scene
function populate() {
    // Create the ground plane with checker pattern
    createPlane({
        width: 50,
        height: 50,
        useChecker: true,
        checkerSize: 4,
        metalness: 0.6,
        roughness: 0.1
    });
    
    // Create some boxes
    createBox({
        color: 0x00ff00,
        position: { x: 0, y: 1, z: 0 }
    });
    
    createBox({
        color: 0xff0000,
        position: { x: 5, y: 1, z: 5 },
        width: 1,
        height: 3,
        depth: 1
    });
    
    createBox({
        color: 0x0000ff,
        position: { x: -5, y: 1, z: -5 },
        width: 3,
        height: 1,
        depth: 3
    });
    
    // Setup lighting
    setupLighting();
    
    // Load environment map
    // Try loading from Poly Haven (free HDRIs with CORS enabled)
    loadEnvironment('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/forest_slope_4k.hdr');
    
    // Setup camera and controls
    setupCameraControls();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update auto-rotation if not user interacting
    updateAutoRotation();
    
    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Initialize and start the scene
function initScene(container = null) {
    init(container);
    populate();
    // Initialize auto-rotation timing
    autoRotateStartTime = Date.now();
    const initialPos = camera.position.clone().sub(controls.target);
    autoRotateStartAngle = Math.atan2(initialPos.z, initialPos.x);
    animate();
    // Event listeners
    window.addEventListener('resize', onWindowResize);
    // Return scene object for external control
    return {
        scene,
        camera,
        renderer,
        controls,
        createBox,
        createPlane,
        loadEnvironment
    };
}

export { initScene };