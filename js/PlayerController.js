// PlayerController.js - Handles player movement, input, mining, and placing

import { BLOCKS, BLOCK_COLORS, GRAVITY, SPEED, SPRINT_SPEED, JUMP_FORCE } from './GameConstants.js';

export class PlayerController {
    constructor(camera, controls, worldEngine, entityManager, uiManager) {
        this.camera = camera;
        this.controls = controls;
        this.worldEngine = worldEngine;
        this.entityManager = entityManager;
        this.uiManager = uiManager;
        
        this.playerVelocity = new THREE.Vector3();
        this.canJump = false;
        this.moveState = { f: 0, b: 0, l: 0, r: 0, sprint: false };
        
        this.isMining = false;
        this.miningTimer = null;
        this.currentMiningBlock = null;
        this.miningIndicator = null;
        
        this.isSwinging = false;
        this.swingTimer = 0;
        
        this.playerHand = null;
        this.offHandGroup = null;
        this.playerLight = null;
        
        this.setupPlayerHand();
        this.setupMiningIndicator();
    }

    setupPlayerHand() {
        const swordMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCKS.SWORD] });
        const pickMat = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[BLOCKS.PICKAXE] });
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const torchMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });

        const createToolGroup = () => {
            const group = new THREE.Group();
            
            const swordGroup = new THREE.Group();
            const sHilt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.08), woodMat);
            sHilt.rotation.z = Math.PI / 2;
            const sBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.8), swordMat);
            sBlade.position.z = 0.5;
            sBlade.rotation.z = Math.PI / 2;
            swordGroup.add(sHilt, sBlade);
            swordGroup.name = 'sword';
            group.add(swordGroup);
            
            const pickGroup = new THREE.Group();
            const pHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), woodMat);
            pHandle.position.z = 0.3;
            const pHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), pickMat);
            pHead.position.z = 0.6;
            pickGroup.add(pHandle, pHead);
            pickGroup.rotation.z = Math.PI / 2;
            pickGroup.rotation.x = -Math.PI / 8;
            pickGroup.name = 'pickaxe';
            group.add(pickGroup);
            
            const torchGroup = new THREE.Group();
            const tHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), woodMat);
            const tHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), torchMat);
            tHead.position.y = 0.22;
            torchGroup.add(tHandle, tHead);
            torchGroup.rotation.x = -Math.PI / 4;
            torchGroup.name = 'torch';
            group.add(torchGroup);
            
            const handMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.2, 0.2),
                new THREE.MeshLambertMaterial({ color: 0xF0C0A0 })
            );
            handMesh.name = 'hand';
            group.add(handMesh);
            
            return group;
        };

        this.playerHand = new THREE.Group();
        const mainTools = createToolGroup();
        this.playerHand.add(mainTools);
        this.playerHand.position.set(0.6, -0.5, -0.8);
        this.playerHand.rotation.x = -Math.PI / 6;
        this.playerHand.rotation.y = -Math.PI / 8;
        this.camera.add(this.playerHand);

        this.offHandGroup = new THREE.Group();
        const offTools = createToolGroup();
        this.offHandGroup.add(offTools);
        this.offHandGroup.position.set(-0.6, -0.5, -0.8);
        this.offHandGroup.rotation.x = -Math.PI / 6;
        this.offHandGroup.rotation.y = Math.PI / 8;
        this.camera.add(this.offHandGroup);

        this.playerLight = new THREE.PointLight(0xFFA500, 0, 15);
        this.playerLight.position.set(0, 0, 0);
        this.camera.add(this.playerLight);
    }

    setupMiningIndicator() {
        const indGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
        const indMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0 });
        this.miningIndicator = new THREE.Mesh(indGeo, indMat);
        this.worldEngine.scene.add(this.miningIndicator);
    }

    onKeyEvent(e) {
        const down = e.type === 'keydown';
        if (e.code === 'KeyW') this.moveState.f = down ? 1 : 0;
        if (e.code === 'KeyS') this.moveState.b = down ? 1 : 0;
        if (e.code === 'KeyA') this.moveState.l = down ? 1 : 0;
        if (e.code === 'KeyD') this.moveState.r = down ? 1 : 0;
        if (e.code === 'ShiftLeft') this.moveState.sprint = down;
        if (e.code === 'Space' && down && this.canJump) {
            this.playerVelocity.y = JUMP_FORCE;
            this.canJump = false;
        }
        if (e.code === 'KeyE' && down) {
            this.uiManager.toggleInventory();
        }
        if (down && e.key >= '1' && e.key <= '5') {
            this.uiManager.selectHotbarSlot(parseInt(e.key) - 1);
        }
    }

    onMouseDown(e) {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        ray.far = 6;
        
        const selectedBlockId = this.uiManager.getSelectedBlockId();
        const isSword = selectedBlockId === BLOCKS.SWORD;
        const isPickaxe = selectedBlockId === BLOCKS.PICKAXE;
        const isTorch = selectedBlockId === BLOCKS.TORCH;
        const isWood = selectedBlockId === BLOCKS.WOOD || selectedBlockId === BLOCKS.PLANKS;

        if (e.button === 0) {
            this.handleLeftClick(ray, isSword, isPickaxe);
        } else if (e.button === 2) {
            this.handleRightClick(ray, selectedBlockId, isWood, isSword, isPickaxe, isTorch);
        }
    }

    handleLeftClick(ray, isSword, isPickaxe) {
        if (isSword) {
            if (!this.isSwinging) {
                this.isSwinging = true;
                this.swingTimer = 0.25;
            }
            if (this.entityManager.hitMonkey(ray)) return;
            return;
        }
        
        if (this.isMining) return;
        
        const meshes = Object.values(this.worldEngine.chunks).map(c => c.mesh).filter(Boolean);
        const hits = ray.intersectObjects(meshes);
        
        if (hits.length > 0) {
            const hit = hits[0];
            const p = hit.point;
            const n = hit.face.normal;
            
            const tx = Math.floor(p.x - n.x * 0.1);
            const ty = Math.floor(p.y - n.y * 0.1);
            const tz = Math.floor(p.z - n.z * 0.1);
            const b = this.worldEngine.getWorldBlock(tx, ty, tz);
            
            if (b === BLOCKS.BEDROCK || b === BLOCKS.AIR) return;
            
            let breakTime = 1000;
            if (isPickaxe && b === BLOCKS.STONE) breakTime = 400;
            else if (b === BLOCKS.LEAVES) breakTime = 100;
            else if (b === BLOCKS.SAPLING) breakTime = 10;
            else if (isPickaxe) breakTime = 600;
            else breakTime = (b === BLOCKS.STONE) ? 3000 : 800;
            
            this.startMining(tx, ty, tz, b, breakTime);
        }
    }

    startMining(tx, ty, tz, blockType, breakTime) {
        this.isMining = true;
        this.currentMiningBlock = { x: tx, y: ty, z: tz };
        this.miningIndicator.position.set(tx + 0.5, ty + 0.5, tz + 0.5);
        
        const startTime = performance.now();

        const updateMining = () => {
            if (!this.isMining || 
                this.currentMiningBlock.x !== tx || 
                this.currentMiningBlock.y !== ty || 
                this.currentMiningBlock.z !== tz ||
                this.worldEngine.getWorldBlock(tx, ty, tz) === BLOCKS.AIR) {
                this.isMining = false;
                this.miningIndicator.material.opacity = 0;
                this.playerHand.rotation.x = -Math.PI / 6;
                return;
            }
            
            const elapsed = performance.now() - startTime;
            this.miningIndicator.material.opacity = (elapsed / breakTime) * 0.7;
            
            if (elapsed >= breakTime) {
                this.worldEngine.setWorldBlock(
                    tx, ty, tz, 
                    BLOCKS.AIR,
                    (dropId, pos) => this.entityManager.createDroppedItem(dropId, pos)
                );
                this.entityManager.spawnParticles(
                    new THREE.Vector3(tx + 0.5, ty + 0.5, tz + 0.5),
                    BLOCK_COLORS[blockType]
                );
                this.worldEngine.updateChunks();
                this.isMining = false;
                this.miningIndicator.material.opacity = 0;
                this.playerHand.rotation.x = -Math.PI / 6;
                this.uiManager.cleanInventory();
                this.uiManager.updateUI();
            } else {
                this.miningTimer = setTimeout(updateMining, 50);
            }
        };
        
        updateMining();
    }

    handleRightClick(ray, selectedBlockId, isWood, isSword, isPickaxe, isTorch) {
        // Refuel campfire
        if (this.entityManager.campfire.mesh) {
            const hits = ray.intersectObject(this.entityManager.campfire.mesh, true);
            if (hits.length > 0 && hits[0].distance < 4) {
                if (isWood && this.uiManager.inventory[selectedBlockId] > 0) {
                    this.uiManager.inventory[selectedBlockId]--;
                    this.entityManager.refuelCampfire(10);
                    this.uiManager.cleanInventory();
                    this.uiManager.updateUI();
                    return;
                }
                
                const offhandItem = this.uiManager.offhandItem;
                const isOffWood = offhandItem === BLOCKS.WOOD || offhandItem === BLOCKS.PLANKS;
                if (isOffWood && this.uiManager.inventory[offhandItem] > 0) {
                    this.uiManager.inventory[offhandItem]--;
                    this.entityManager.refuelCampfire(10);
                    this.uiManager.cleanInventory();
                    this.uiManager.updateUI();
                    return;
                }
            }
        }

        // Eat watermelon
        if (selectedBlockId === BLOCKS.WATERMELON) {
            if (this.uiManager.inventory[BLOCKS.WATERMELON] > 0 && this.uiManager.playerHunger < 10) {
                this.uiManager.inventory[BLOCKS.WATERMELON]--;
                this.uiManager.playerHunger = Math.min(10, this.uiManager.playerHunger + 3);
                this.uiManager.cleanInventory();
                this.uiManager.updateUI();
            }
            return;
        }
        
        // Place block
        if (this.uiManager.inventory[selectedBlockId] > 0 && !isSword && !isPickaxe && !isTorch) {
            const meshes = Object.values(this.worldEngine.chunks).map(c => c.mesh).filter(Boolean);
            const hits = ray.intersectObjects(meshes);

            if (hits.length > 0) {
                const hit = hits[0];
                const p = hit.point;
                const n = hit.face.normal;
                
                const tx = Math.floor(p.x + n.x * 0.1);
                const ty = Math.floor(p.y + n.y * 0.1);
                const tz = Math.floor(p.z + n.z * 0.1);
                
                const pp = this.controls.getObject().position;
                if (Math.abs(tx - pp.x) < 0.8 && ty >= (pp.y - 1.8) && ty <= (pp.y + 0.2)) return;
                
                if (this.worldEngine.getWorldBlock(tx, ty, tz) === BLOCKS.AIR) {
                    if (Math.abs(tx) < 2 && Math.abs(tz) < 2 && 
                        ty === Math.floor(this.entityManager.campfire.mesh?.position.y || 0)) return;

                    this.worldEngine.setWorldBlock(tx, ty, tz, selectedBlockId);
                    this.uiManager.inventory[selectedBlockId]--;
                    this.worldEngine.updateChunks();
                    this.uiManager.cleanInventory();
                    this.uiManager.updateUI();
                }
            }
        }
    }

    onMouseUp(e) {
        if (e.button === 0) {
            if (this.isMining) {
                clearTimeout(this.miningTimer);
                this.miningTimer = null;
                this.isMining = false;
                this.miningIndicator.material.opacity = 0;
                this.playerHand.rotation.x = -Math.PI / 6;
            }
        }
    }

    updateHandVisuals(group, itemId) {
        group.getObjectByName('sword').visible = (itemId === BLOCKS.SWORD);
        group.getObjectByName('pickaxe').visible = (itemId === BLOCKS.PICKAXE);
        group.getObjectByName('torch').visible = (itemId === BLOCKS.TORCH);
        group.getObjectByName('hand').visible = (itemId !== BLOCKS.SWORD && itemId !== BLOCKS.PICKAXE && itemId !== BLOCKS.TORCH);
    }

    checkCollision(pos) {
        const r = 0.3;
        const x = pos.x;
        const y = pos.y - 1.5;
        const z = pos.z;
        
        for (let ix = Math.floor(x - r); ix <= Math.floor(x + r); ix++) {
            for (let iz = Math.floor(z - r); iz <= Math.floor(z + r); iz++) {
                for (let iy = Math.floor(y); iy <= Math.floor(y + 1.8); iy++) {
                    const block = this.worldEngine.getWorldBlock(ix, iy, iz);
                    if (block !== BLOCKS.AIR && block !== BLOCKS.SAPLING) return true;
                }
            }
        }
        return false;
    }

    checkAutoLoot(playerPos) {
        const pickupRadiusSq = 2.0 * 2.0;
        const playerFeetPos = new THREE.Vector3(playerPos.x, playerPos.y - 1.5, playerPos.z);
        
        for (let i = this.entityManager.droppedItems.length - 1; i >= 0; i--) {
            const item = this.entityManager.droppedItems[i];
            if (playerFeetPos.distanceToSquared(item.mesh.position) < pickupRadiusSq) {
                this.uiManager.inventory[item.blockId] = (this.uiManager.inventory[item.blockId] || 0) + 1;
                this.entityManager.removeDroppedItem(item);
                this.uiManager.updateUI();
            }
        }
    }

    update(dt) {
        const playerPos = this.controls.getObject().position;
        this.checkAutoLoot(playerPos);

        // Hand animations
        const baseRotX = -Math.PI / 6;
        const now = performance.now();
        
        if (this.isSwinging) {
            this.swingTimer -= dt;
            this.playerHand.rotation.x = baseRotX - Math.sin(this.swingTimer * Math.PI * 4) * 1.0;
            if (this.swingTimer <= 0) {
                this.isSwinging = false;
                this.playerHand.rotation.x = baseRotX;
            }
        } else if (this.isMining) {
            this.playerHand.rotation.x = baseRotX - Math.abs(Math.sin(now / 100)) * 0.8;
        } else {
            this.playerHand.rotation.x = baseRotX;
        }
        
        if (this.offHandGroup) {
            this.offHandGroup.rotation.x = baseRotX + Math.sin(now / 1000) * 0.05;
        }

        // Update hand visuals
        const selectedBlockId = this.uiManager.getSelectedBlockId();
        this.updateHandVisuals(this.playerHand.children[0], selectedBlockId);
        this.updateHandVisuals(this.offHandGroup.children[0], this.uiManager.offhandItem);

        // Torch light
        if (this.playerLight) {
            this.playerLight.intensity = (selectedBlockId === BLOCKS.TORCH) ? 1.0 : 0.0;
        }

        // Movement
        const spd = this.moveState.sprint ? SPRINT_SPEED : SPEED;
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        fwd.y = 0;
        fwd.normalize();
        const rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        rgt.y = 0;
        rgt.normalize();
        
        const mi = (this.moveState.f - this.moveState.b);
        const ml = (this.moveState.r - this.moveState.l);
        this.playerVelocity.x = (fwd.x * mi + rgt.x * ml) * spd;
        this.playerVelocity.z = (fwd.z * mi + rgt.z * ml) * spd;
        this.playerVelocity.y -= GRAVITY * dt;

        const p = this.controls.getObject().position;
        const old = p.clone();

        p.x += this.playerVelocity.x * dt;
        if (this.checkCollision(p)) p.x = old.x;
        
        p.z += this.playerVelocity.z * dt;
        if (this.checkCollision(p)) p.z = old.z;
        
        p.y += this.playerVelocity.y * dt;
        if (this.checkCollision(p)) {
            if (this.playerVelocity.y < 0) {
                this.canJump = true;
                p.y = Math.ceil(p.y - 1.5) + 1.501;
            } else {
                p.y = old.y;
            }
            this.playerVelocity.y = 0;
        }
        
        if (p.y < -10) {
            p.set(0, 30, 0);
            this.playerVelocity.set(0, 0, 0);
        }
    }

    takeDamage(damageAmount, knockbackDirection) {
        this.uiManager.playerHealth--;
        this.uiManager.updateUI();
        
        const overlay = document.getElementById('damage-overlay');
        overlay.style.opacity = '0.5';
        setTimeout(() => { overlay.style.opacity = '0'; }, 300);
        
        this.playerVelocity.addScaledVector(knockbackDirection, 10);
    }
}