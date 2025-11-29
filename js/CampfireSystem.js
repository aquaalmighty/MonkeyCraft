// CampfireSystem.js - Manages campfire state and behavior

import { BLOCKS } from './GameConstants.js';

export class CampfireSystem {
    constructor(scene, worldEngine) {
        this.scene = scene;
        this.worldEngine = worldEngine;
        
        this.campfire = {
            mesh: null,
            light: null,
            health: 100,
            maxHealth: 100,
            barElement: null,
            fillElement: null,
            drainTimer: 0,
            particleTimer: 0
        };
        
        this.onGameOver = null;
    }

    init(onGameOver) {
        this.onGameOver = onGameOver;
        
        let y = 32;
        while (y > 0 && this.worldEngine.getWorldBlock(0, y - 1, 0) === BLOCKS.AIR) {
            y--;
        }

        const loader = new THREE.GLTFLoader();
        loader.load('assets/models/campfire.glb', (gltf) => {
            this.campfire.mesh = gltf.scene;
            
            this.applyShaderFix(this.campfire.mesh);

            this.campfire.mesh.position.set(0.5, y, 0.5);
            this.campfire.mesh.scale.set(1.5, 1.5, 1.5);
            this.scene.add(this.campfire.mesh);

            this.campfire.light = new THREE.PointLight(0xFF4500, 1.5, 15);
            this.campfire.light.position.set(0, 1.0, 0);
            this.campfire.mesh.add(this.campfire.light);

            const bar = document.createElement('div');
            bar.className = 'world-health-bar campfire-bar';
            bar.innerHTML = '<div class="world-health-fill" style="background-color: #ff8800;"></div>';
            document.getElementById('world-labels').appendChild(bar);
            this.campfire.barElement = bar;
            this.campfire.fillElement = bar.querySelector('.world-health-fill');
        });
    }

    applyShaderFix(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.material.metalness = 0;
                child.material.roughness = 1;
                child.material.side = THREE.DoubleSide;
                child.material.needsUpdate = true;
            }
        });
    }

    update(dt, camera, spawnParticles) {
        if (!this.campfire.mesh) return;
        
        this.campfire.drainTimer += dt;
        if (this.campfire.drainTimer > 1.0) {
            this.campfire.health -= 0.5;
            this.campfire.drainTimer = 0;
        }

        if (this.campfire.light) {
            this.campfire.light.intensity = 0.5 + (this.campfire.health / 100) * 1.5 + Math.sin(performance.now() * 0.01) * 0.2;
        }

        this.campfire.particleTimer += dt;
        if (this.campfire.particleTimer > 0.1) {
            this.campfire.particleTimer = 0;
            
            if (Math.random() > 0.3) {
                const fPos = this.campfire.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));
                spawnParticles(fPos, 0xFF4500, 0.15, 0.5 + Math.random() * 0.5, false);
            }

            if (Math.random() > 0.6) {
                const sPos = this.campfire.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                spawnParticles(sPos, 0x555555, 0.3, 2.0 + Math.random() * 1.0, true);
            }
        }

        if (this.campfire.health <= 0) {
            if (this.onGameOver) this.onGameOver();
        }

        if (this.campfire.barElement) {
            this.campfire.barElement.style.display = 'block';
            this.worldEngine.updateEntityLabel(
                this.campfire.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
                this.campfire.barElement,
                camera
            );
            this.campfire.fillElement.style.width = (this.campfire.health / this.campfire.maxHealth * 100) + '%';
        }
    }

    refuel(amount, spawnParticles) {
        this.campfire.health = Math.min(this.campfire.maxHealth, this.campfire.health + amount);
        spawnParticles(this.campfire.mesh.position, 0xFFA500);
    }

    takeDamage(amount, spawnParticles) {
        this.campfire.health -= amount;
        spawnParticles(this.campfire.mesh.position, 0xFF4500);
    }

    getHealth() {
        return this.campfire.health;
    }

    getMesh() {
        return this.campfire.mesh;
    }
}