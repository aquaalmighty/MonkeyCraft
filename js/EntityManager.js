// EntityManager.js - Manages monkeys, campfire, dropped items, and particles

import { BLOCKS, BLOCK_COLORS, GRAVITY, DAY_DURATION } from './GameConstants.js';

export class EntityManager {
    constructor(scene, worldEngine) {
        this.scene = scene;
        this.worldEngine = worldEngine;
        this.monkeys = [];
        this.droppedItems = [];
        this.particles = [];
        this.monkeySpawnTimer = 0;
        this.allowContinuousSpawning = false;
        
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
    }

    initCampfire(onGameOver) {
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

    updateCampfire(dt, camera) {
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
                this.spawnParticles(fPos, 0xFF4500, 0.15, 0.5 + Math.random() * 0.5, false);
            }

            if (Math.random() > 0.6) {
                const sPos = this.campfire.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
                this.spawnParticles(sPos, 0x555555, 0.3, 2.0 + Math.random() * 1.0, true);
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

    refuelCampfire(amount) {
        this.campfire.health = Math.min(this.campfire.maxHealth, this.campfire.health + amount);
        this.spawnParticles(this.campfire.mesh.position, 0xFFA500);
    }

    spawnMonkey(playerPos) {
        const group = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

        const faceTex = new THREE.TextureLoader().load('assets/textures/face.png');
        const skinMat = new THREE.MeshLambertMaterial({ map: faceTex, transparent: true });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), mat);
        body.position.y = 0.8;
        group.add(body);
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
        head.position.y = 1.55;
        group.add(head);
        
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), skinMat);
        face.position.y = 1.55;
        face.position.z = 0.3;
        group.add(face);
        
        const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const legGeo = new THREE.BoxGeometry(0.25, 0.4, 0.25);
        
        const armL = new THREE.Mesh(armGeo, mat);
        armL.position.set(-0.4, 0.9, 0);
        group.add(armL);
        
        const armR = new THREE.Mesh(armGeo, mat);
        armR.position.set(0.4, 0.9, 0);
        group.add(armR);
        
        const legL = new THREE.Mesh(legGeo, mat);
        legL.position.set(-0.2, 0.2, 0);
        group.add(legL);
        
        const legR = new THREE.Mesh(legGeo, mat);
        legR.position.set(0.2, 0.2, 0);
        group.add(legR);
        
        this.scene.add(group);
        
        let spawnX, spawnZ;
        let attempts = 0;
        do {
            spawnX = (Math.random() - 0.5) * 80;
            spawnZ = (Math.random() - 0.5) * 80;
            const dist = Math.sqrt(Math.pow(spawnX - playerPos.x, 2) + Math.pow(spawnZ - playerPos.z, 2));
            if (dist > 10) break;
            attempts++;
        } while (attempts < 10);

        group.position.set(spawnX, 30, spawnZ);

        const bar = document.createElement('div');
        bar.className = 'world-health-bar';
        bar.innerHTML = '<div class="world-health-fill" style="background-color: #00ff00;"></div>';
        document.getElementById('world-labels').appendChild(bar);

        const targetType = (Math.random() < 0.5 && this.campfire.health > 0) ? 'campfire' : 'player';

        this.monkeys.push({
            mesh: group,
            health: 5,
            maxHealth: 5,
            barElement: bar,
            state: 'chase',
            targetEntity: targetType,
            timer: 0,
            target: new THREE.Vector3(),
            vel: new THREE.Vector3(),
            animTimer: Math.random() * 100,
            limbs: { armL, armR, legL, legR },
            aggro: true,
            attackCooldown: 0,
            breakTimer: 0,
            breakingBlock: null
        });
    }

    updateMonkeys(dt, playerPos, gameTime, camera, onPlayerDamage) {
        const isNight = (gameTime > DAY_DURATION * 0.75 || gameTime < DAY_DURATION * 0.25);
        const spawnRate = isNight ? 2.0 : 10.0;

        this.monkeySpawnTimer += dt;
        if (this.allowContinuousSpawning && this.monkeySpawnTimer >= spawnRate) {
            this.monkeySpawnTimer = 0;
            this.spawnMonkey(playerPos);
        }

        for (let i = this.monkeys.length - 1; i >= 0; i--) {
            const m = this.monkeys[i];
            
            if (m.health <= 0) {
                this.createDroppedItem(BLOCKS.WATERMELON, m.mesh.position.clone());
                this.scene.remove(m.mesh);
                if (m.barElement) m.barElement.remove();
                this.monkeys.splice(i, 1);
                continue;
            }
            
            m.timer -= dt;
            m.animTimer += dt * 5;
            m.attackCooldown -= dt;

            const distToPlayer = m.mesh.position.distanceTo(playerPos);
            
            if (m.targetEntity === 'campfire' && this.campfire.mesh) {
                if (this.campfire.health <= 0) m.targetEntity = 'player';
            }

            if (m.state === 'break') {
                m.breakTimer += dt;
                m.limbs.armR.rotation.x = -Math.sin(m.animTimer * 2) * 1.5;
                
                if (m.breakTimer >= 30.0) {
                    if (m.breakingBlock) {
                        this.worldEngine.setWorldBlock(
                            m.breakingBlock.x,
                            m.breakingBlock.y,
                            m.breakingBlock.z,
                            BLOCKS.AIR,
                            (dropId, pos) => this.createDroppedItem(dropId, pos)
                        );
                        this.spawnParticles(
                            new THREE.Vector3(m.breakingBlock.x + 0.5, m.breakingBlock.y + 0.5, m.breakingBlock.z + 0.5),
                            '#555'
                        );
                        this.worldEngine.updateChunks();
                    }
                    m.state = 'chase';
                    m.breakTimer = 0;
                    m.breakingBlock = null;
                }
                
                m.vel.y -= GRAVITY * dt;
                m.mesh.position.y += m.vel.y * dt;
                const bIy = Math.floor(m.mesh.position.y);
                if (this.worldEngine.getWorldBlock(Math.floor(m.mesh.position.x), bIy, Math.floor(m.mesh.position.z)) !== BLOCKS.AIR) {
                    m.mesh.position.y = bIy + 1.001;
                    m.vel.y = 0;
                }
                
                if (m.health < m.maxHealth) {
                    m.barElement.style.display = 'block';
                    this.worldEngine.updateEntityLabel(
                        m.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
                        m.barElement,
                        camera
                    );
                    m.barElement.querySelector('.world-health-fill').style.width = (m.health / m.maxHealth * 100) + '%';
                } else {
                    m.barElement.style.display = 'none';
                }
                
                continue;
            }

            if (m.state === 'chase') {
                if (m.targetEntity === 'campfire' && this.campfire.mesh) {
                    m.target.copy(this.campfire.mesh.position);
                    const distToFire = m.mesh.position.distanceTo(this.campfire.mesh.position);
                    if (distToFire < 3.0 && m.attackCooldown <= 0) {
                        this.campfire.health -= 2;
                        m.attackCooldown = 1.5;
                        this.spawnParticles(this.campfire.mesh.position, 0xFF4500);
                    }
                } else {
                    m.target.copy(playerPos);
                    if (distToPlayer < 3.0 && m.attackCooldown <= 0) {
                        if (onPlayerDamage) onPlayerDamage(m);
                        m.attackCooldown = 1.5;
                    }
                }
                if (distToPlayer > 60 && m.targetEntity === 'player') {
                    m.aggro = false;
                    m.state = 'idle';
                }
            } else if (m.state === 'idle' && m.timer <= 0) {
                const r = Math.random();
                if (r < 0.6) {
                    m.state = 'move';
                    m.target.set(
                        m.mesh.position.x + (Math.random() - 0.5) * 10,
                        m.mesh.position.y,
                        m.mesh.position.z + (Math.random() - 0.5) * 10
                    );
                    m.timer = 2 + Math.random() * 2;
                }
            }

            if (m.state === 'move' || m.state === 'chase') {
                const dx = m.target.x - m.mesh.position.x;
                const dz = m.target.z - m.mesh.position.z;
                const d = Math.sqrt(dx * dx + dz * dz);
                
                if (d > 0.5) {
                    const speed = m.state === 'chase' ? 4.5 : 2;
                    const nextX = m.mesh.position.x + (dx / d) * speed * dt;
                    const nextZ = m.mesh.position.z + (dz / d) * speed * dt;
                    
                    const currY = Math.floor(m.mesh.position.y);
                    const checkX = Math.floor(nextX);
                    const checkZ = Math.floor(nextZ);
                    
                    const blockAtFeet = this.worldEngine.getWorldBlock(checkX, currY, checkZ);
                    const blockHead = this.worldEngine.getWorldBlock(checkX, currY + 1, checkZ);

                    let canMove = true;
                    
                    if (blockAtFeet !== BLOCKS.AIR && blockAtFeet !== BLOCKS.SAPLING) {
                        if (blockHead !== BLOCKS.AIR && blockHead !== BLOCKS.SAPLING) {
                            canMove = false;
                            m.state = 'break';
                            m.breakTimer = 0;
                            m.breakingBlock = { x: checkX, y: currY + 1, z: checkZ };
                        }
                    } else if (blockHead !== BLOCKS.AIR && blockHead !== BLOCKS.SAPLING) {
                        canMove = false;
                        m.state = 'break';
                        m.breakTimer = 0;
                        m.breakingBlock = { x: checkX, y: currY + 1, z: checkZ };
                    }

                    if (canMove) {
                        m.mesh.position.x = nextX;
                        m.mesh.position.z = nextZ;
                        m.mesh.lookAt(m.target.x, m.mesh.position.y, m.target.z);
                        m.limbs.armL.rotation.x = Math.sin(m.animTimer) * 0.8;
                        m.limbs.armR.rotation.x = -Math.sin(m.animTimer) * 0.8;
                        m.limbs.legL.rotation.x = -Math.sin(m.animTimer) * 0.8;
                        m.limbs.legR.rotation.x = Math.sin(m.animTimer) * 0.8;
                    }
                } else {
                    if (m.state !== 'chase') m.state = 'idle';
                }
            } else {
                m.limbs.armL.rotation.x = 0;
                m.limbs.armR.rotation.x = 0;
                m.limbs.legL.rotation.x = 0;
                m.limbs.legR.rotation.x = 0;
            }

            m.vel.y -= GRAVITY * dt;
            m.mesh.position.y += m.vel.y * dt;
            
            const ix = Math.floor(m.mesh.position.x);
            const iz = Math.floor(m.mesh.position.z);
            const iy = Math.floor(m.mesh.position.y);
            
            if (this.worldEngine.getWorldBlock(ix, iy, iz) !== BLOCKS.AIR && 
                this.worldEngine.getWorldBlock(ix, iy, iz) !== BLOCKS.SAPLING) {
                if (this.worldEngine.getWorldBlock(ix, iy + 1, iz) === BLOCKS.AIR || 
                    this.worldEngine.getWorldBlock(ix, iy + 1, iz) === BLOCKS.SAPLING) {
                    m.mesh.position.y = iy + 1.001;
                    m.vel.y = 0;
                } else {
                    m.mesh.position.y = iy + 1.001;
                    m.vel.y = 0;
                }
            }

            if (m.health < m.maxHealth) {
                m.barElement.style.display = 'block';
                this.worldEngine.updateEntityLabel(
                    m.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0)),
                    m.barElement,
                    camera
                );
                m.barElement.querySelector('.world-health-fill').style.width = (m.health / m.maxHealth * 100) + '%';
            } else {
                m.barElement.style.display = 'none';
            }
        }
    }

    hitMonkey(raycaster) {
        for (let m of this.monkeys) {
            const hits = raycaster.intersectObject(m.mesh, true);
            if (hits.length > 0 && hits[0].distance < 4) {
                m.health--;
                m.aggro = true;
                m.state = 'chase';
                m.breakTimer = 0;
                m.breakingBlock = null;
                
                m.mesh.scale.set(1.1, 1.1, 1.1);
                setTimeout(() => m.mesh.scale.set(1, 1, 1), 100);
                this.spawnParticles(m.mesh.position, 0xFF0000);
                return true;
            }
        }
        return false;
    }

    createDroppedItem(blockId, pos) {
        const itemColor = BLOCK_COLORS[blockId] || '#FF00FF';
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            this.worldEngine.createMaterial(itemColor)
        );
        mesh.position.copy(pos);
        
        const item = {
            id: Math.random().toString(36).substring(2),
            blockId: blockId,
            mesh: mesh,
            vel: new THREE.Vector3((Math.random() - 0.5) * 3, 5, (Math.random() - 0.5) * 3),
            time: 0,
            baseY: null
        };
        
        this.scene.add(mesh);
        this.droppedItems.push(item);
    }

    updateDroppedItems(dt) {
        for (let i = this.droppedItems.length - 1; i >= 0; i--) {
            const item = this.droppedItems[i];
            item.time += dt * 3;
            item.mesh.rotation.y += dt;
            
            if (item.baseY === null) {
                item.vel.y -= GRAVITY * dt;
                item.mesh.position.addScaledVector(item.vel, dt);

                const ix = Math.floor(item.mesh.position.x);
                const iz = Math.floor(item.mesh.position.z);
                const iy = Math.floor(item.mesh.position.y - 0.3);

                if (this.worldEngine.getWorldBlock(ix, iy, iz) !== BLOCKS.AIR && 
                    this.worldEngine.getWorldBlock(ix, iy, iz) !== BLOCKS.SAPLING) {
                    item.baseY = iy + 1.5;
                    item.vel.set(0, 0, 0);
                }
            } else {
                item.mesh.position.y = item.baseY + Math.sin(item.time) * 0.1;
                const ix = Math.floor(item.mesh.position.x);
                const iz = Math.floor(item.mesh.position.z);
                const iy = Math.floor(item.baseY - 1.5);
                if (this.worldEngine.getWorldBlock(ix, iy, iz) === BLOCKS.AIR) {
                    item.baseY = null;
                }
            }
        }
    }

    removeDroppedItem(item) {
        this.scene.remove(item.mesh);
        const idx = this.droppedItems.findIndex(i => i.id === item.id);
        if (idx !== -1) this.droppedItems.splice(idx, 1);
    }

    spawnParticles(pos, colorHex, size = 0.15, life = 1.0, isSmoke = false) {
        const count = isSmoke ? 1 : 8;
        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8 });
        
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.position.x += (Math.random() - 0.5) * 0.5;
            p.position.y += (Math.random() - 0.5) * 0.5;
            p.position.z += (Math.random() - 0.5) * 0.5;
            
            if (isSmoke) {
                p.userData.vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 1,
                    (Math.random()) * 2 + 1,
                    (Math.random() - 0.5) * 1
                );
                p.userData.isSmoke = true;
            } else {
                p.userData.vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 4,
                    (Math.random()) * 4,
                    (Math.random() - 0.5) * 4
                );
            }
            
            p.userData.life = life;
            p.userData.maxLife = life;
            this.scene.add(p);
            this.particles.push(p);
        }
    }

    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.userData.life -= dt;
            
            if (p.userData.isSmoke) {
                p.userData.vel.x += (Math.random() - 0.5) * dt;
                p.userData.vel.z += (Math.random() - 0.5) * dt;
                p.material.opacity = (p.userData.life / p.userData.maxLife) * 0.6;
                p.scale.addScalar(dt * 0.5);
            } else {
                p.userData.vel.y -= GRAVITY * dt;
            }
            
            p.position.addScaledVector(p.userData.vel, dt);
            
            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            } else if (!p.userData.isSmoke) {
                p.scale.setScalar(p.userData.life);
            }
        }
    }
}
