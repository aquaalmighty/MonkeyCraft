// EntityManager.js - Main coordinator for all entity systems

import { BLOCKS, DAY_DURATION } from './GameConstants.js';
import { MonkeyBehavior } from './MonkeyBehavior.js';
import { MonkeySpawner } from './MonkeySpawner.js';
import { CampfireSystem } from './CampfireSystem.js';
import { ParticleSystem } from './ParticleSystem.js';
import { ItemSystem } from './ItemSystem.js';

export class EntityManager {
    constructor(scene, worldEngine) {
        this.scene = scene;
        this.worldEngine = worldEngine;
        
        // Initialize subsystems
        this.monkeyBehavior = new MonkeyBehavior(worldEngine);
        this.monkeySpawner = new MonkeySpawner(scene);
        this.campfireSystem = new CampfireSystem(scene, worldEngine);
        this.particleSystem = new ParticleSystem(scene);
        this.itemSystem = new ItemSystem(scene, worldEngine);
        
        // Monkey management
        this.monkeys = [];
        this.monkeySpawnTimer = 0;
        this.allowContinuousSpawning = false;
    }

    initCampfire(onGameOver) {
        this.campfireSystem.init(onGameOver);
    }

    updateCampfire(dt, camera) {
        this.campfireSystem.update(dt, camera, (pos, color, size, life, isSmoke) => {
            this.particleSystem.spawn(pos, color, size, life, isSmoke);
        });
    }

    refuelCampfire(amount) {
        this.campfireSystem.refuel(amount, (pos, color) => {
            this.particleSystem.spawn(pos, color);
        });
    }

    spawnMonkey(playerPos, forceAggressive = false) {
        const monkey = this.monkeySpawner.createMonkey(
            playerPos, 
            forceAggressive, 
            this.campfireSystem.getHealth()
        );
        this.monkeys.push(monkey);
    }

    updateMonkeys(dt, playerPos, gameTime, camera, onPlayerDamage) {
        const isNight = (gameTime > DAY_DURATION * 0.75 || gameTime < DAY_DURATION * 0.25);
        const spawnRate = isNight ? 2.0 : 10.0;

        this.monkeySpawnTimer += dt;
        if (this.allowContinuousSpawning && this.monkeySpawnTimer >= spawnRate) {
            this.monkeySpawnTimer = 0;
            this.spawnMonkey(playerPos, true);
        }

        for (let i = this.monkeys.length - 1; i >= 0; i--) {
            const m = this.monkeys[i];
            
            // Check death
            if (m.health <= 0) {
                this.itemSystem.createDroppedItem(BLOCKS.WATERMELON, m.mesh.position.clone());
                this.monkeySpawner.destroyMonkey(m);
                this.monkeys.splice(i, 1);
                continue;
            }
            
            // Update timers
            m.timer -= dt;
            m.animTimer += dt * 5;
            m.attackCooldown -= dt;

            // Check campfire target validity
            if (m.targetEntity === 'campfire' && this.campfireSystem.getHealth() <= 0) {
                m.targetEntity = 'player';
            }

            // Update AI behavior
            this.monkeyBehavior.updateDetection(m, playerPos, dt);
            
            // Handle break state
            if (m.state === 'break') {
                this.updateBreakState(m, dt, camera, playerPos);
                continue;
            }

            // Update states
            this.monkeyBehavior.updateIdleState(m, dt);
            
            const chaseResult = this.monkeyBehavior.updateChaseState(
                m, 
                playerPos, 
                this.campfireSystem.getMesh(), 
                this.campfireSystem.getHealth(),
                onPlayerDamage
            );
            
            if (chaseResult && chaseResult.attackCampfire) {
                m.isDrainingCampfire = true;
                this.campfireSystem.takeDamage(chaseResult.damage, (pos, color) => {
                    this.particleSystem.spawn(pos, color);
                });
                m.attackCooldown = 1.5;
            }

            // Update movement and physics
            this.monkeyBehavior.updateMovement(m, dt);
            this.monkeyBehavior.updatePhysics(m, dt);

            // Update health bar
            this.updateMonkeyHealthBar(m, camera);
        }
    }

    updateBreakState(monkey, dt, camera, playerPos) {
        monkey.breakTimer += dt;
        monkey.limbs.armR.rotation.x = -Math.sin(monkey.animTimer * 2) * 1.5;
        
        // Check for player detection and line of sight while breaking
        const distToPlayer = monkey.mesh.position.distanceTo(playerPos);
        
        // If within alert radius, always aggro
        if (distToPlayer <= monkey.alertRadius) {
            monkey.aggro = true;
            monkey.state = 'chase';
            monkey.targetEntity = 'player';
            monkey.breakTimer = 0;
            monkey.breakingBlock = null;
            monkey.worriedTimer = 30;
        }
        // If within detection radius, check for direct line of sight
        else if (distToPlayer <= monkey.detectionRadius) {
            // Check direct line of sight from monkey head to player head while breaking
            if (this.monkeyBehavior.hasDirectLineOfSight(monkey, playerPos)) {
                monkey.aggro = true;
                monkey.state = 'chase';
                monkey.targetEntity = 'player';
                monkey.breakTimer = 0;
                monkey.breakingBlock = null;
                monkey.worriedTimer = 30;
            }
        }
        
        if (monkey.breakTimer >= 30.0) {
            if (monkey.breakingBlock) {
                this.worldEngine.setWorldBlock(
                    monkey.breakingBlock.x,
                    monkey.breakingBlock.y,
                    monkey.breakingBlock.z,
                    BLOCKS.AIR,
                    (dropId, pos) => this.itemSystem.createDroppedItem(dropId, pos)
                );
                this.particleSystem.spawn(
                    new THREE.Vector3(
                        monkey.breakingBlock.x + 0.5, 
                        monkey.breakingBlock.y + 0.5, 
                        monkey.breakingBlock.z + 0.5
                    ),
                    '#555'
                );
                this.worldEngine.updateChunks();
            }
            monkey.state = 'chase';
            monkey.breakTimer = 0;
            monkey.breakingBlock = null;
        }
        
        this.monkeyBehavior.updatePhysics(monkey, dt);
        this.updateMonkeyHealthBar(monkey, camera);
    }

    updateMonkeyHealthBar(monkey, camera) {
        if (monkey.health < monkey.maxHealth) {
            monkey.barElement.style.display = 'block';
            this.worldEngine.updateEntityLabel(
                monkey.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
                monkey.barElement,
                camera
            );
            monkey.barElement.querySelector('.world-health-fill').style.width = 
                (monkey.health / monkey.maxHealth * 100) + '%';
        } else {
            monkey.barElement.style.display = 'none';
        }
    }

    hitMonkey(raycaster) {
        for (let m of this.monkeys) {
            const hits = raycaster.intersectObject(m.mesh, true);
            if (hits.length > 0 && hits[0].distance < 4) {
                m.health--;
                m.hitCount++;
                
                // If monkey is draining campfire, only aggro after 4 hits
                // Otherwise, aggro immediately on any hit
                if (m.isDrainingCampfire) {
                    if (m.hitCount >= 4) {
                        m.aggro = true;
                        m.state = 'chase';
                        m.targetEntity = 'player';
                        m.breakTimer = 0;
                        m.breakingBlock = null;
                        m.worriedTimer = 30;
                        m.isDrainingCampfire = false;
                    }
                } else {
                    m.aggro = true;
                    m.state = 'chase';
                    m.targetEntity = 'player';
                    m.breakTimer = 0;
                    m.breakingBlock = null;
                    m.worriedTimer = 30;
                }
                
                m.mesh.scale.set(1.1, 1.1, 1.1);
                setTimeout(() => m.mesh.scale.set(1, 1, 1), 100);
                this.particleSystem.spawn(m.mesh.position, 0xFF0000);
                return true;
            }
        }
        return false;
    }

    createDroppedItem(blockId, pos) {
        this.itemSystem.createDroppedItem(blockId, pos);
    }

    updateDroppedItems(dt) {
        this.itemSystem.update(dt);
    }

    removeDroppedItem(item) {
        this.itemSystem.removeItem(item);
    }

    spawnParticles(pos, colorHex, size, life, isSmoke) {
        this.particleSystem.spawn(pos, colorHex, size, life, isSmoke);
    }

    updateParticles(dt) {
        this.particleSystem.update(dt);
    }

    // Getters for external access
    get droppedItems() {
        return this.itemSystem.getItems();
    }

    get campfire() {
        return {
            mesh: this.campfireSystem.getMesh(),
            health: this.campfireSystem.getHealth()
        };
    }
}