// PlayerController.js - Handles player movement, input, mining, and placing



import { BLOCKS, BLOCK_COLORS, GRAVITY, SPEED, SPRINT_SPEED, JUMP_FORCE } from './GameConstants.js';



export class PlayerController {

    constructor(camera, controls, worldEngine, entityManager, uiManager, soundManager) {

        this.camera = camera;

        this.controls = controls;

        this.worldEngine = worldEngine;

        this.entityManager = entityManager;

        this.uiManager = uiManager;

        this.soundManager = soundManager;



        this.playerVelocity = new THREE.Vector3();

        this.canJump = false;

        this.moveState = { f: 0, b: 0, l: 0, r: 0, sprint: false };



        this.isMining = false;

        this.miningTimer = null;

        this.miningAnimationTimer = 0; // Local timer for mining animation

        this.currentMiningBlock = null;

        this.miningIndicator = null;



        this.isSwinging = false;

        this.swingTimer = 0;



        this.playerHand = null;

        this.offHandGroup = null;

        this.playerLight = null;



        // Sway animation tracking

        this.wasMoving = false;

        this.wasSprinting = false;

        this.swayResetProgress = 0;

        this.baseHandPos = new THREE.Vector3(0.6, -0.5, -0.8);

        this.baseOffhandPos = new THREE.Vector3(-0.6, -0.5, -0.8);



        // Camera lag tracking

        this.prevCameraQuat = new THREE.Quaternion();

        this.handLagOffset = new THREE.Vector3();

        this.offhandLagOffset = new THREE.Vector3();

        this.maxLagDistance = 2; // Maximum lag distance - DRASTICALLY INCREASED

        this.lagSmoothness = 0.75; // How quickly to recover from lag



        // Sway tweening back to base

        this.handSwayOffset = new THREE.Vector3();

        this.offhandSwayOffset = new THREE.Vector3();

        this.tweenProgress = 0;

        this.isTweening = false;

        this.handRotationTween = 0;

        this.offhandRotationTween = 0;

        

        // Sprint transition tweening

        this.isSprintTransitioning = false;

        this.sprintTransitionProgress = 0;

        this.previousHandSwayOffset = new THREE.Vector3();

        this.previousOffhandSwayOffset = new THREE.Vector3();

        
        // Walking sound tracking
        this.lastWalkSoundTime = 0;
        this.walkSoundInterval = 600; // ms between walk sounds

        // Pickaxe tween after mining

        this.isPickaxeTweening = false;

        this.pickaxeTweenProgress = 0;

        this.pickaxeIdleRotX = 0;

        this.pickaxeIdleRotY = 0;

        this.pickaxeIdleRotZ = 0;

        this.pickaxeStartRotX = 0;

        this.pickaxeStartRotY = 0;

        this.pickaxeStartRotZ = 0;



        this.setupPlayerHand();

        this.setupMiningIndicator();

    }



    setupPlayerHand() {

        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

        const torchMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });



        const createToolGroup = () => {

            const group = new THREE.Group();



            // Sword from loaded model
            const swordGroup = new THREE.Group();

            if (this.worldEngine.swordModel) {

                const swordClone = this.worldEngine.swordModel.clone();

                swordGroup.add(swordClone);

            }

            swordGroup.name = 'sword';

            group.add(swordGroup);



            // Pickaxe from loaded model

            const pickGroup = new THREE.Group();

            if (this.worldEngine.pickaxeModel) {

                const pickaxeClone = this.worldEngine.pickaxeModel.clone();

                pickGroup.add(pickaxeClone);

            }

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

                new THREE.BoxGeometry(0.3, 0.3, 0.5),

                new THREE.MeshLambertMaterial({ color: 0xF0C0A0 })

            );

            handMesh.name = 'hand';

            handMesh.position.z = -0.15;

            group.add(handMesh);



            // Create a generic block mesh for holding blocks

            const blockMesh = new THREE.Mesh(

                new THREE.BoxGeometry(0.25, 0.25, 0.25),

                new THREE.MeshLambertMaterial({ color: 0xFFFFFF })

            );

            blockMesh.name = 'block';

            blockMesh.visible = false;

            group.add(blockMesh);



            return group;

        };



        this.playerHand = new THREE.Group();

        const mainTools = createToolGroup();

        this.playerHand.add(mainTools);

        this.playerHand.position.set(0.6, -0.5, -0.8);

        this.playerHand.rotation.x = -Math.PI / 12;

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

        

        // Store initial pickaxe rotation for tween reference
        const mainPickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');

        if (mainPickGroup) {

            this.pickaxeIdleRotX = mainPickGroup.rotation.x;

            this.pickaxeIdleRotY = mainPickGroup.rotation.y;

            this.pickaxeIdleRotZ = mainPickGroup.rotation.z;

        }

    }

    updateToolModels() {
        // Update sword and pickaxe models after they're loaded
        if (this.worldEngine.swordModel && this.worldEngine.pickaxeModel) {
            // Get both tool groups (main hand and off hand)
            const mainTools = this.playerHand.children[0];
            const offTools = this.offHandGroup.children[0];

            // Update main hand sword
            const mainSwordGroup = mainTools.getObjectByName('sword');
            if (mainSwordGroup && mainSwordGroup.children.length === 0) {
                const swordClone = this.worldEngine.swordModel.clone();
                mainSwordGroup.add(swordClone);
            }

            // Update main hand pickaxe
            const mainPickGroup = mainTools.getObjectByName('pickaxe');
            if (mainPickGroup && mainPickGroup.children.length === 0) {
                const pickaxeClone = this.worldEngine.pickaxeModel.clone();
                mainPickGroup.add(pickaxeClone);
            }

            // Update off hand sword
            const offSwordGroup = offTools.getObjectByName('sword');
            if (offSwordGroup && offSwordGroup.children.length === 0) {
                const swordClone = this.worldEngine.swordModel.clone();
                offSwordGroup.add(swordClone);
            }

            // Update off hand pickaxe
            const offPickGroup = offTools.getObjectByName('pickaxe');
            if (offPickGroup && offPickGroup.children.length === 0) {
                const pickaxeClone = this.worldEngine.pickaxeModel.clone();
                offPickGroup.add(pickaxeClone);
            }
        }
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
    
    // Debug toggles
    if (e.code === 'KeyL' && down) {
        // Toggle lighting
        this.worldEngine.lighting.setEnabled(!this.worldEngine.lighting.enabled);
        console.log('Lighting:', this.worldEngine.lighting.enabled ? 'ON' : 'OFF');
        this.worldEngine.updateChunks();
    }
    if (e.code === 'KeyO' && down) {
        // Toggle AO
        this.worldEngine.ao.setEnabled(!this.worldEngine.ao.enabled);
        console.log('Ambient Occlusion:', this.worldEngine.ao.enabled ? 'ON' : 'OFF');
        this.worldEngine.updateChunks();
    }
    if (e.code === 'KeyP' && down) {
        // Toggle shadows
        this.worldEngine.shadowBaker.setEnabled(!this.worldEngine.shadowBaker.enabled);
        console.log('Baked Shadows:', this.worldEngine.shadowBaker.enabled ? 'ON' : 'OFF');
        if (this.worldEngine.shadowBaker.enabled) {
            this.worldEngine.shadowBaker.bakeAllChunks();
        }
        this.worldEngine.updateChunks();
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

            console.log('[LEFT CLICK]');

            if (isSword && !this.isSwinging) {
                this.soundManager.playSwingSwordSound();
            }

            this.handleLeftClick(ray, isSword, isPickaxe);

        } else if (e.button === 2) {

            console.log('[RIGHT CLICK] selectedBlockId:', selectedBlockId, 'isWood:', isWood, 'isSword:', isSword, 'isPickaxe:', isPickaxe, 'isTorch:', isTorch);

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
        
        // Also include sapling hitboxes for raycasting
        const saplingHitboxes = this.worldEngine.saplingObjects.map(s => s.hitbox);
        const allMeshes = [...meshes, ...saplingHitboxes];

        const hits = ray.intersectObjects(allMeshes);



        if (hits.length > 0) {

            const hit = hits[0];

            const p = hit.point;

            const n = hit.face.normal;



            const tx = Math.floor(p.x - n.x * 0.1);

            const ty = Math.floor(p.y - n.y * 0.1);

            const tz = Math.floor(p.z - n.z * 0.1);

            // Check if hit a sapling hitbox directly
            const hitSapling = this.worldEngine.saplingObjects.find(s => s.hitbox === hit.object);
            const b = hitSapling ? BLOCKS.SAPLING : this.worldEngine.getWorldBlock(tx, ty, tz);



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

        

        // Reset mining animation timer to start fresh
        this.miningAnimationTimer = 0;

        

        // Capture and reset pickaxe to idle rotation at start of mining
        const pickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');
        if (pickGroup) {
            this.pickaxeIdleRotX = pickGroup.rotation.x;
            this.pickaxeIdleRotY = pickGroup.rotation.y;
            this.pickaxeIdleRotZ = pickGroup.rotation.z;
            // Reset pickaxe to idle rotation to ensure consistent animation start
            pickGroup.rotation.set(this.pickaxeIdleRotX, this.pickaxeIdleRotY, this.pickaxeIdleRotZ);
        }
        
        // Stop any ongoing tween when mining starts
        this.isPickaxeTweening = false;
        this.pickaxeTweenProgress = 0;



        const startTime = performance.now();

        const updateMining = () => {

            if (!this.isMining ||

                this.currentMiningBlock.x !== tx ||

                this.currentMiningBlock.y !== ty ||

                this.currentMiningBlock.z !== tz) {

                this.isMining = false;

                this.miningIndicator.material.opacity = 0;

                

                // Start pickaxe tween when mining is cancelled
                const pickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');
                if (pickGroup && pickGroup.children.length > 0) {
                    this.isPickaxeTweening = true;
                    this.pickaxeTweenProgress = 0;
                    this.pickaxeStartRotX = pickGroup.rotation.x;
                    this.pickaxeStartRotY = pickGroup.rotation.y;
                    this.pickaxeStartRotZ = pickGroup.rotation.z;
                }

                return;

            }

            
            // Check if block still exists (for both regular blocks and saplings)
            const currentBlock = this.worldEngine.getWorldBlock(tx, ty, tz);
            const saplingStillExists = this.worldEngine.saplingObjects.some(s => 
                Math.floor(s.pos.x) === tx + 0.5 && 
                Math.floor(s.pos.y) === ty && 
                Math.floor(s.pos.z) === tz + 0.5
            );
            
            if (currentBlock === BLOCKS.AIR && !saplingStillExists) {

                this.isMining = false;

                this.miningIndicator.material.opacity = 0;

                this.playerHand.rotation.x = -Math.PI / 6;

                return;

            }



            const elapsed = performance.now() - startTime;

            this.miningIndicator.material.opacity = (elapsed / breakTime) * 0.7;



            if (elapsed >= breakTime) {

                // Play mining sound at block location
                this.soundManager.playMineSound(new THREE.Vector3(tx + 0.5, ty + 0.5, tz + 0.5));

                this.worldEngine.setWorldBlock(

                    tx, ty, tz,

                    BLOCKS.AIR,

                    (dropId, pos) => this.entityManager.createDroppedItem(dropId, pos)

                );

                // Updated to include all parameters: pos, colorHex, size, life, isSmoke

                this.entityManager.spawnParticles(

                    new THREE.Vector3(tx + 0.5, ty + 0.5, tz + 0.5),

                    BLOCK_COLORS[blockType],

                    0.15,  // size (default)

                    1.0,   // life (default)

                    false  // isSmoke

                );

                this.worldEngine.updateChunks();

                this.isMining = false;

                this.miningIndicator.material.opacity = 0;

                

                // Start pickaxe tween animation
                const pickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');
                if (pickGroup && pickGroup.children.length > 0) {
                    this.isPickaxeTweening = true;
                    this.pickaxeTweenProgress = 0;
                    this.pickaxeStartRotX = pickGroup.rotation.x;
                    this.pickaxeStartRotY = pickGroup.rotation.y;
                    this.pickaxeStartRotZ = pickGroup.rotation.z;
                }

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

                if (isWood && this.uiManager.getItemCount(selectedBlockId) > 0) {

                    this.uiManager.decrementItem(selectedBlockId);

                    this.entityManager.refuelCampfire(10);

                    this.uiManager.cleanInventory();

                    this.uiManager.updateUI();

                    return;

                }



                const offhandItemId = this.uiManager.offhandSlot.itemId;

                const isOffWood = offhandItemId === BLOCKS.WOOD || offhandItemId === BLOCKS.PLANKS;

                if (isOffWood && this.uiManager.getItemCount(offhandItemId) > 0) {

                    this.uiManager.decrementItem(offhandItemId);

                    this.entityManager.refuelCampfire(10);

                    this.uiManager.cleanInventory();

                    this.uiManager.updateUI();

                    return;

                }

            }

        }



        // Eat watermelon

        if (selectedBlockId === BLOCKS.WATERMELON) {

            if (this.uiManager.getItemCount(BLOCKS.WATERMELON) > 0 && this.uiManager.playerHunger < 10) {

                this.uiManager.decrementItem(BLOCKS.WATERMELON);

                this.uiManager.playerHunger = Math.min(10, this.uiManager.playerHunger + 3);

                this.uiManager.cleanInventory();

                this.uiManager.updateUI();

            }

            return;

        }



        // Place block

        const itemCount = this.uiManager.getItemCount(selectedBlockId);

        console.log('[PLACE BLOCK CHECK] itemCount:', itemCount, 'isSword:', isSword, 'isPickaxe:', isPickaxe, 'isTorch:', isTorch);

        if (itemCount > 0 && !isSword && !isPickaxe && !isTorch) {

            console.log('[PLACE BLOCK] Attempting to place block');

            // Create a fresh raycaster for block placement to avoid stale state

            const blockRay = new THREE.Raycaster();



            // Get the camera's world position and direction

            const cameraPos = this.camera.getWorldPosition(new THREE.Vector3());

            const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));



            console.log('[RAYCASTER SETUP] cameraPos:', cameraPos, 'cameraDir:', cameraDir);

            blockRay.set(cameraPos, cameraDir);

            blockRay.far = 6;



            const meshes = Object.values(this.worldEngine.chunks).map(c => c.mesh).filter(Boolean);

            console.log('[RAYCASTER] meshes found:', meshes.length);

            const hits = blockRay.intersectObjects(meshes);

            console.log('[RAYCASTER] hits found:', hits.length);



            if (hits.length > 0) {

                const hit = hits[0];

                const p = hit.point;

                let n = hit.face.normal.clone();



                // IMPORTANT: Transform face normal from local to world space

                // The face normal is in geometry/local space, we need world space normal

                n.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));

                n.normalize();



                console.log('[HIT] point:', p, 'face normal (local):', hit.face.normal, 'face normal (world):', n, 'distance:', hit.distance);



                const tx = Math.floor(p.x + n.x * 0.1);

                const ty = Math.floor(p.y + n.y * 0.1);

                const tz = Math.floor(p.z + n.z * 0.1);

                console.log('[PLACEMENT] calculated coords: tx=' + tx + ', ty=' + ty + ', tz=' + tz);



                const pp = this.controls.getObject().position;



                const blockAtPos = this.worldEngine.getWorldBlock(tx, ty, tz);

                console.log('[BLOCK CHECK] Block at placement pos:', blockAtPos, 'is AIR?', blockAtPos === BLOCKS.AIR);

                if (blockAtPos === BLOCKS.AIR) {

                    // Check if placement block is inside player's collision radius

                    const playerRadius = 0.3; // Half-width of player collision box

                    const playerHeight = 1.8; // Player height

                    const playerHeadY = pp.y + 0.2; // Top of player head

                    const playerFeetY = pp.y - 1.7; // Bottom of player feet



                    // Check if the placement block overlaps with player collision box

                    const blockOverlapsX = Math.abs(tx + 0.5 - pp.x) < playerRadius + 0.5;

                    const blockOverlapsZ = Math.abs(tz + 0.5 - pp.z) < playerRadius + 0.5;

                    const blockOverlapsY = (ty + 1) > (playerFeetY + 0.2) && ty < (playerHeadY - 0.1);



                    const blockInPlayer = blockOverlapsX && blockOverlapsZ && blockOverlapsY;

                    console.log('[PLACEMENT COLLISION] playerRadius:', playerRadius, 'blockCenter: (' + (tx + 0.5) + ', ' + ty + ', ' + (tz + 0.5) + ')');

                    console.log('[PLACEMENT COLLISION] blockOverlapsX:', blockOverlapsX, 'blockOverlapsZ:', blockOverlapsZ, 'blockOverlapsY:', blockOverlapsY, 'result:', blockInPlayer);



                    if (blockInPlayer) {

                        console.log('[BLOCKED] Placement block overlaps with player - cannot place');

                        return;

                    }



                    const isCampfire = Math.abs(tx) < 2 && Math.abs(tz) < 2 &&

                        ty === Math.floor(this.entityManager.campfire.mesh?.position.y || 0);

                    console.log('[CAMPFIRE CHECK] Is campfire location?', isCampfire);

                    if (isCampfire) {

                        console.log('[BLOCKED] Campfire location - cannot place');

                        return;

                    }



                    console.log('[SUCCESS] Placing block', selectedBlockId, 'at', tx, ty, tz);

                    // Play place block sound at placement location
                    this.soundManager.playPlaceBlockSound(new THREE.Vector3(tx + 0.5, ty + 0.5, tz + 0.5));

                    this.worldEngine.setWorldBlock(tx, ty, tz, selectedBlockId);

                    this.uiManager.decrementItem(selectedBlockId);

                    this.worldEngine.updateChunks();

                    this.uiManager.cleanInventory();

                    this.uiManager.updateUI();

                } else {

                    console.log('[BLOCKED] Block already exists at position');

                }

            } else {

                console.log('[BLOCKED] No world mesh hits detected');

            }

        } else {

            console.log('[BLOCKED] Not a placeable item or no inventory');

        }

    }



    onMouseUp(e) {

        if (e.button === 0) {

            if (this.isMining) {

                clearTimeout(this.miningTimer);

                this.miningTimer = null;

                this.isMining = false;

                this.miningIndicator.material.opacity = 0;

                

                // Start pickaxe tween when mining is cancelled
                const pickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');
                if (pickGroup && pickGroup.children.length > 0) {
                    this.isPickaxeTweening = true;
                    this.pickaxeTweenProgress = 0;
                    this.pickaxeStartRotX = pickGroup.rotation.x;
                    this.pickaxeStartRotY = pickGroup.rotation.y;
                    this.pickaxeStartRotZ = pickGroup.rotation.z;
                }

            }

        }

    }



    updateHandVisuals(group, itemId, isOffhand = false) {

        const isTool = itemId === BLOCKS.SWORD || itemId === BLOCKS.PICKAXE || itemId === BLOCKS.TORCH;

        const isAir = itemId === BLOCKS.AIR;



        group.getObjectByName('sword').visible = (itemId === BLOCKS.SWORD);

        group.getObjectByName('pickaxe').visible = (itemId === BLOCKS.PICKAXE);

        group.getObjectByName('torch').visible = (itemId === BLOCKS.TORCH);

        // Only show hand mesh for main hand when empty, never for offhand

        group.getObjectByName('hand').visible = isAir && !isOffhand;



        const blockMesh = group.getObjectByName('block');

        if (blockMesh) {

            blockMesh.visible = !isTool && !isAir;

            if (blockMesh.visible && BLOCK_COLORS[itemId]) {

                blockMesh.material.color.setHex(parseInt(BLOCK_COLORS[itemId].replace('#', ''), 16));

            }

        }

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

                    if (block !== BLOCKS.AIR) return true;

                }

            }

        }

        return false;

    }



    checkAutoLoot(playerPos) {

        const pickupRadius = 1.0; // Horizontal radius (1 block around player)

        const pickupRadiusSq = pickupRadius * pickupRadius;

        const playerCenterPos = new THREE.Vector3(playerPos.x, playerPos.y - 0.75, playerPos.z); // Center of player (2 blocks high)

        const verticalRange = 1.5; // Check 1.5 blocks above and below player center



        for (let i = this.entityManager.droppedItems.length - 1; i >= 0; i--) {

            const item = this.entityManager.droppedItems[i];

            const itemPos = item.mesh.position;



            // Check horizontal distance (X and Z)

            const horizontalDistSq = (itemPos.x - playerCenterPos.x) ** 2 + (itemPos.z - playerCenterPos.z) ** 2;



            // Check vertical distance (Y)

            const verticalDist = Math.abs(itemPos.y - playerCenterPos.y);



            if (horizontalDistSq < pickupRadiusSq && verticalDist < verticalRange) {

                this.soundManager.playPickupItemSound();

                this.uiManager.addItem(item.blockId, 1);

                this.entityManager.removeDroppedItem(item);

                this.uiManager.updateUI();

            }

        }

    }



    update(dt) {

        // Update mining animation timer
        if (this.isMining) {
            this.miningAnimationTimer += dt;
        }

        // Constrain camera to prevent looking directly up or down
        const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        const maxPitch = Math.PI / 2 - 0.01; // Prevent looking exactly up/down with 0.01 rad margin
        euler.x = Math.max(-maxPitch, Math.min(maxPitch, euler.x));
        this.camera.quaternion.setFromEuler(euler);

        const playerPos = this.controls.getObject().position;

        this.checkAutoLoot(playerPos);



        // Hand animations

        const baseRotX = -Math.PI / 6;

        const baseHandPosY = -0.5;

        const baseOffhandPosY = -0.5;

        const now = performance.now();



        // Calculate movement speed for sway

        const isMoving = this.moveState.f || this.moveState.b || this.moveState.l || this.moveState.r;



        // Reset animation timer when movement state changes

        if (isMoving !== this.wasMoving) {

            if (isMoving) {

                // Starting movement - reset sway to beginning

                this.swayResetProgress = 0;

                this.movementStartTime = now;

                this.isTweening = false;

                this.tweenProgress = 0;

            } else {

                // Stopping movement - start smooth tween back to base

                this.swayResetProgress = 0;

                this.resetStartTime = now;

                this.isTweening = true;

                this.tweenProgress = 0;

                this.handRotationTween = 0;

                this.offhandRotationTween = 0;

            }

            this.wasMoving = isMoving;

        }

        // Reset animation timer when sprint state changes (while still moving)

        if (isMoving && this.moveState.sprint !== this.wasSprinting) {

            // Save current sway offset before resetting

            this.previousHandSwayOffset.copy(this.handSwayOffset);

            this.previousOffhandSwayOffset.copy(this.offhandSwayOffset);

            

            // Start sprint transition tween

            this.isSprintTransitioning = true;

            this.sprintTransitionProgress = 0;

            

            this.movementStartTime = now;

            this.currentCycleDuration = this.moveState.sprint ? 800 : 1200;

        }

        this.wasSprinting = this.moveState.sprint;



        // Handle camera lag effect

        const currentCameraQuat = this.camera.quaternion;

        const quatDiff = new THREE.Quaternion().copy(this.prevCameraQuat).invert().multiply(currentCameraQuat);



        // Convert quaternion diff to a position offset (larger multiplier for more noticeable lag)

        const lagForce = new THREE.Vector3(

            Math.sin(quatDiff.y) * 0.4,

            Math.sin(quatDiff.x) * 0.4,

            0

        );



        // Update lag offsets with damping (less damping = more lag accumulation)

        this.handLagOffset.add(lagForce);

        this.offhandLagOffset.add(lagForce);



        // Clamp lag distance to maximum

        const handLagDist = this.handLagOffset.length();

        if (handLagDist > this.maxLagDistance) {

            this.handLagOffset.multiplyScalar(this.maxLagDistance / handLagDist);

        }

        const offhandLagDist = this.offhandLagOffset.length();

        if (offhandLagDist > this.maxLagDistance) {

            this.offhandLagOffset.multiplyScalar(this.maxLagDistance / offhandLagDist);

        }



        // Smooth recovery towards zero lag (slower recovery = more noticeable lag)

        this.handLagOffset.multiplyScalar(this.lagSmoothness);

        this.offhandLagOffset.multiplyScalar(this.lagSmoothness);



        this.prevCameraQuat.copy(currentCameraQuat);



        // Handle sway tweening

        if (this.isTweening) {

            this.tweenProgress = Math.min(1, this.tweenProgress + dt / 0.3); // 300ms tween

            const easeProgress = this.tweenProgress * this.tweenProgress * (3 - 2 * this.tweenProgress); // Smoothstep



            this.handSwayOffset.multiplyScalar(1 - easeProgress);

            this.offhandSwayOffset.multiplyScalar(1 - easeProgress);

            this.handRotationTween = easeProgress;

            this.offhandRotationTween = easeProgress;



            if (this.tweenProgress >= 1) {

                this.isTweening = false;

                this.handSwayOffset.set(0, 0, 0);

                this.offhandSwayOffset.set(0, 0, 0);

                this.handRotationTween = 1;

                this.offhandRotationTween = 1;

            }

        }



        if (isMoving) {

            // Stop tweening if we start moving

            this.isTweening = false;

            this.tweenProgress = 0;



            // Calculate sway based on time since movement started - FIGURE 8 PATTERN
            // Adjust animation speed based on sprint state
            const baseCycleDuration = 1200; // Reduced from 1500ms for slightly faster animation
            const sprintCycleDuration = 400; // Even faster when sprinting
            const targetCycleDuration = this.moveState.sprint ? sprintCycleDuration : baseCycleDuration;
            
            // Initialize cycle duration on first movement
            if (!this.currentCycleDuration) {
                this.currentCycleDuration = targetCycleDuration;
            }

            const timeSinceStart = (now - this.movementStartTime) % Math.max(1, this.currentCycleDuration); // Loop based on current duration

            const t = (timeSinceStart / Math.max(1, this.currentCycleDuration)) * Math.PI * 2; // Normalized time 0 to 2π



            // Figure-8 pattern using Lissajous curve - REDUCED INTENSITY

            const swayAmount = Math.sin(t) * 0.03; // Horizontal sway (reduced from 0.05)

            const bobAmount = Math.sin(t * 2) * 0.015; // Vertical bob (reduced from 0.03)



            this.handSwayOffset.set(swayAmount, bobAmount, 0);

            this.offhandSwayOffset.set(-swayAmount, bobAmount, 0);

            

            // Blend with previous sway offset during sprint transition

            if (this.isSprintTransitioning) {

                this.sprintTransitionProgress = Math.min(1, this.sprintTransitionProgress + dt / 0.15); // 150ms tween

                const easeProgress = this.sprintTransitionProgress * this.sprintTransitionProgress * (3 - 2 * this.sprintTransitionProgress); // Smoothstep

                

                this.handSwayOffset.lerp(this.previousHandSwayOffset, 1 - easeProgress);

                this.offhandSwayOffset.lerp(this.previousOffhandSwayOffset, 1 - easeProgress);

                

                if (this.sprintTransitionProgress >= 1) {

                    this.isSprintTransitioning = false;

                }

            }



            if (this.isSwinging) {

                this.swingTimer -= dt;

                this.playerHand.rotation.x = baseRotX - Math.sin(this.swingTimer * Math.PI * 4) * 1.0;

                this.playerHand.position.copy(this.baseHandPos).add(this.handLagOffset).add(this.handSwayOffset);

                this.playerHand.position.y = baseHandPosY;

                if (this.swingTimer <= 0) {

                    this.isSwinging = false;

                    this.playerHand.rotation.x = baseRotX;

                    this.isTweening = true;

                    this.tweenProgress = 0;

                }

            } else if (this.isMining) {

                this.playerHand.rotation.x = baseRotX - Math.abs(Math.sin(this.miningAnimationTimer * 10)) * 0.8;

                this.playerHand.position.copy(this.baseHandPos).add(this.handLagOffset).add(this.handSwayOffset);

                this.playerHand.position.y = baseHandPosY;

                

                // Animate pickaxe rotation during mining

                const miningPickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');

                if (miningPickGroup) {

                    miningPickGroup.rotation.x = -Math.abs(Math.sin(this.miningAnimationTimer * 10)) * 0.5;

                }

            } else {

                this.playerHand.rotation.x = baseRotX;

                this.playerHand.position.copy(this.baseHandPos).add(this.handLagOffset).add(this.handSwayOffset);

                this.playerHand.position.y = baseHandPosY + this.handSwayOffset.y;

            }



            if (this.offHandGroup) {

                this.offHandGroup.rotation.x = baseRotX;

                this.offHandGroup.position.copy(this.baseOffhandPos).add(this.offhandLagOffset).add(this.offhandSwayOffset);

                this.offHandGroup.position.y = baseOffhandPosY + this.offhandSwayOffset.y;

            }

        } else {

            // Handle animations when not moving

            if (this.isSwinging) {

                this.swingTimer -= dt;

                this.playerHand.rotation.x = baseRotX - Math.sin(this.swingTimer * Math.PI * 4) * 1.0;

                this.playerHand.position.copy(this.baseHandPos).add(this.handLagOffset).add(this.handSwayOffset);

                this.playerHand.position.y = baseHandPosY;

                if (this.swingTimer <= 0) {

                    this.isSwinging = false;

                    this.playerHand.rotation.x = baseRotX;

                    this.isTweening = true;

                    this.tweenProgress = 0;

                }

            } else if (this.isMining) {

                this.playerHand.rotation.x = baseRotX - Math.abs(Math.sin(this.miningAnimationTimer * 10)) * 0.8;

                this.playerHand.position.copy(this.baseHandPos).add(this.handLagOffset).add(this.handSwayOffset);

                this.playerHand.position.y = baseHandPosY;

                

                // Animate pickaxe rotation during mining

                const idlePickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');

                if (idlePickGroup) {

                    idlePickGroup.rotation.x = -Math.abs(Math.sin(this.miningAnimationTimer * 10)) * 0.5;

                }

            } else {

                // Smoothly reset to base position when not moving and not animating

                // Apply rotation tween

                this.playerHand.rotation.x = baseRotX + (this.playerHand.rotation.x - baseRotX) * (1 - this.handRotationTween);



                // Interpolate position back to base (including lag offset and sway tween)

                this.playerHand.position.copy(this.baseHandPos).add(this.handLagOffset).add(this.handSwayOffset);

                this.playerHand.position.y = baseHandPosY;



                if (this.offHandGroup) {

                    this.offHandGroup.rotation.x = baseRotX + (this.offHandGroup.rotation.x - baseRotX) * (1 - this.offhandRotationTween);



                    this.offHandGroup.position.copy(this.baseOffhandPos).add(this.offhandLagOffset).add(this.offhandSwayOffset);

                    this.offHandGroup.position.y = baseOffhandPosY;

                }

            }

        }



        // Update pickaxe tween animation (global, runs regardless of movement)

        if (this.isPickaxeTweening) {

            this.pickaxeTweenProgress = Math.min(1, this.pickaxeTweenProgress + dt / 0.4); // 400ms tween

            const easeProgress = this.pickaxeTweenProgress * this.pickaxeTweenProgress * (3 - 2 * this.pickaxeTweenProgress); // Smoothstep



            const pickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');

            if (pickGroup) {

                // Tween back to idle rotation

                pickGroup.rotation.x = this.pickaxeStartRotX + (this.pickaxeIdleRotX - this.pickaxeStartRotX) * easeProgress;

                pickGroup.rotation.y = this.pickaxeStartRotY + (this.pickaxeIdleRotY - this.pickaxeStartRotY) * easeProgress;

                pickGroup.rotation.z = this.pickaxeStartRotZ + (this.pickaxeIdleRotZ - this.pickaxeStartRotZ) * easeProgress;

            }



            if (this.pickaxeTweenProgress >= 1) {

                this.isPickaxeTweening = false;

                const pickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');

                if (pickGroup) {

                    pickGroup.rotation.set(this.pickaxeIdleRotX, this.pickaxeIdleRotY, this.pickaxeIdleRotZ);

                }

            }

        } else if (!this.isMining) {

            // When not tweening and not mining, ensure pickaxe stays at idle rotation

            const pickGroup = this.playerHand.children[0]?.getObjectByName('pickaxe');

            if (pickGroup && (pickGroup.rotation.x !== this.pickaxeIdleRotX || pickGroup.rotation.y !== this.pickaxeIdleRotY || pickGroup.rotation.z !== this.pickaxeIdleRotZ)) {

                pickGroup.rotation.set(this.pickaxeIdleRotX, this.pickaxeIdleRotY, this.pickaxeIdleRotZ);

            }

        }



        // Update hand visuals

        const selectedBlockId = this.uiManager.getSelectedBlockId();

        this.updateHandVisuals(this.playerHand.children[0], selectedBlockId, false);

        this.updateHandVisuals(this.offHandGroup.children[0], this.uiManager.offhandSlot.itemId, true);



        // Torch light

        // Torch light (existing code)
    if (this.playerLight) {
        const hasMainTorch = selectedBlockId === BLOCKS.TORCH;
        const hasOffTorch = this.uiManager.offhandSlot.itemId === BLOCKS.TORCH;
        this.playerLight.intensity = (hasMainTorch || hasOffTorch) ? 1.0 : 0.0;
        
        // NEW: Update shadow baker with torch position
        const isHoldingTorch = hasMainTorch || hasOffTorch;
        this.worldEngine.updatePlayerTorchLight(
            this.controls.getObject().position.clone(),
            isHoldingTorch
        );
    }



        // Movement

        const spd = this.moveState.sprint ? SPRINT_SPEED : SPEED;

        // Get forward and right directions from camera matrix (more stable than quaternion)
        const fwd = new THREE.Vector3();
        this.camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();

        const rgt = new THREE.Vector3();
        this.camera.getWorldDirection(rgt);
        rgt.applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        rgt.y = 0;
        rgt.normalize();

        const mi = (this.moveState.f - this.moveState.b);
        const ml = (this.moveState.r - this.moveState.l);
        this.playerVelocity.x = (fwd.x * mi + rgt.x * ml) * spd;
        this.playerVelocity.z = (fwd.z * mi + rgt.z * ml) * spd;

        // Play walking sounds at intervals when moving
        const isMovingHorizontally = Math.abs(this.playerVelocity.x) > 0.1 || Math.abs(this.playerVelocity.z) > 0.1;
        if (isMovingHorizontally && this.canJump) {
            const currentTime = performance.now();
            const soundInterval = this.moveState.sprint ? 400 : 600; // Faster sounds when sprinting
            
            if (currentTime - this.lastWalkSoundTime >= soundInterval) {
                this.soundManager.playWalkSound();
                this.lastWalkSoundTime = currentTime;
            }
        }

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