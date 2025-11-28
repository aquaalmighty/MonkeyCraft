// MonkeyCraft.js - Main game initialization and loop

import { WorldEngine } from './WorldEngine.js';
import { EntityManager } from './EntityManager.js';
import { PlayerController } from './PlayerController.js';
import { UIManager } from './UIManager.js';
import { DayNightCycle } from './DayNightCycle.js';
import { ObjectiveManager } from './ObjectiveManager.js';

class MonkeyCraft {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.isGameActive = false;
        this.lastTime = performance.now();
        
        this.worldEngine = null;
        this.entityManager = null;
        this.playerController = null;
        this.uiManager = null;
        this.dayNightCycle = null;
        this.objectiveManager = null;
    }

    init() {
        // Setup Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 60);
        
        this.camera = new THREE.PerspectiveCamera(
            70,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        document.body.appendChild(this.renderer.domElement);

        // Pointer lock controls
        this.controls = new THREE.PointerLockControls(this.camera, document.body);
        this.scene.add(this.controls.getObject());
        this.controls.getObject().position.set(0, 30, 0);

        // Initialize game subsystems
        this.worldEngine = new WorldEngine(this.scene);
        this.uiManager = new UIManager(this.controls);
        this.entityManager = new EntityManager(this.scene, this.worldEngine);
        this.dayNightCycle = new DayNightCycle(this.scene);
        this.objectiveManager = new ObjectiveManager();
        this.playerController = new PlayerController(
            this.camera,
            this.controls,
            this.worldEngine,
            this.entityManager,
            this.uiManager
        );

        // Setup event listeners
        this.setupEventListeners();

        // Generate initial world
        this.worldEngine.generateWorld();
        this.worldEngine.loadSaplingModel();
        
        // Initialize campfire
        this.entityManager.initCampfire(() => this.endGame());

        // Setup objectives
        this.setupObjectives();

        // Initialize UI
        this.uiManager.updateUI();

        // Start game loop
        this.animate();
    }

    setupObjectives() {
        // Objective 1: Prepare for nightfall (1 minute timer)
        this.objectiveManager.addObjective(
            'PREPARE FOR NIGHTFALL',
            60, // 1 minute in seconds
            () => {
                // When timer completes, start spawning monkeys
                this.entityManager.allowContinuousSpawning = true;
                for (let i = 0; i < 5; i++) {
                    this.entityManager.spawnMonkey(this.controls.getObject().position);
                }
            }
        );

        // Objective 2: Survive (no timer)
        this.objectiveManager.addObjective(
            'SURVIVE',
            0, // No timer
            null
        );

        // Start objectives
        this.objectiveManager.start();
    }

    setupEventListeners() {
        const startBtn = document.getElementById('start-btn');
        startBtn.addEventListener('click', () => this.controls.lock());

        this.controls.addEventListener('lock', () => {
            document.getElementById('menu').style.display = 'none';
            document.getElementById('inventory-screen').style.display = 'none';
            this.isGameActive = true;
            this.uiManager.isInventoryOpen = false;
        });

        this.controls.addEventListener('unlock', () => {
            if (!this.uiManager.isInventoryOpen && this.entityManager.campfire.health > 0) {
                document.getElementById('menu').style.display = 'flex';
            }
            this.isGameActive = false;
        });

        document.addEventListener('keydown', (e) => this.playerController.onKeyEvent(e));
        document.addEventListener('keyup', (e) => this.playerController.onKeyEvent(e));
        document.addEventListener('mousedown', (e) => this.playerController.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.playerController.onMouseUp(e));
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (!this.isGameActive) return;

        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        // Update all game systems
        this.dayNightCycle.update(dt, () => this.uiManager.incrementDay());
        
        this.objectiveManager.update(dt);
        
        this.entityManager.updateCampfire(dt, this.camera);
        
        this.entityManager.updateMonkeys(
            dt,
            this.controls.getObject().position,
            this.dayNightCycle.getGameTime(),
            this.camera,
            (monkey) => {
                const dir = new THREE.Vector3()
                    .subVectors(this.controls.getObject().position, monkey.mesh.position)
                    .normalize();
                this.playerController.takeDamage(1, dir);
            }
        );
        
        this.worldEngine.updateSaplings(dt, this.camera);
        this.entityManager.updateDroppedItems(dt);
        this.entityManager.updateParticles(dt);
        this.playerController.update(dt);
        this.uiManager.updateHunger(dt);
        
        if (this.uiManager.checkPlayerDeath(this.controls)) {
            // Player respawned
        }

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    endGame() {
        this.isGameActive = false;
        document.exitPointerLock();
        document.getElementById('game-over-screen').style.display = 'flex';
    }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    const game = new MonkeyCraft();
    game.init();
    window.game = game; // For debugging
});