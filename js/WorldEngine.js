// WorldEngine.js - Chunk generation, block management, and mesh generation with Ambient Occlusion

import { CHUNK_SIZE, WORLD_HEIGHT, WORLD_SIZE_CHUNKS, TEXTURE_SIZE, BLOCKS, BLOCK_COLORS, CUBE_FACES } from './GameConstants.js';
import { AmbientOcclusion } from './AmbientOcclusion.js';
//import { LightingEngine } from './LightingEngine.js';
import { ShadowBaker } from './ShadowBaker.js';

export class WorldEngine {
        constructor(scene, dayNightCycle = null) {
    this.scene = scene;
    this.chunks = {};
    this.materials = [];
    this.matMap = {};
    this.saplingObjects = [];
    this.saplingModel = null;
    this.ao = new AmbientOcclusion(this);
    this.shadowBaker = new ShadowBaker(this, dayNightCycle);
    this.shadowBaker.setEnabled(true);
    
    // NEW: Track dynamic light IDs
    this.playerTorchLightId = null;
    this.campfireLightId = null;
    
    // Track last shadow update
    this.lastShadowUpdateAngle = 0;
    this.shadowUpdateTimer = 0;
    this.shadowUpdateInterval = 5.0;
    
    this.initMaterials();
}

// NEW: Update player torch light position
updatePlayerTorchLight(position, isHoldingTorch) {
    if (!this.shadowBaker || !this.shadowBaker.enabled) return;
    
    if (isHoldingTorch) {
        if (this.playerTorchLightId === null) {
            // Add torch light (intensity 12, radius 10 blocks)
            this.playerTorchLightId = this.shadowBaker.addDynamicLight(position, 12, 10);
        } else {
            // Update existing torch position
            this.shadowBaker.updateDynamicLight(this.playerTorchLightId, position);
        }
    } else {
        // Remove torch light if not holding
        if (this.playerTorchLightId !== null) {
            this.shadowBaker.removeDynamicLight(this.playerTorchLightId);
            this.playerTorchLightId = null;
        }
    }
}

// NEW: Set campfire light position (call this once when campfire is created)
setCampfireLight(position) {
    if (!this.shadowBaker || !this.shadowBaker.enabled) return;
    
    if (this.campfireLightId === null) {
        // Add campfire light (intensity 15, radius 15 blocks)
        this.campfireLightId = this.shadowBaker.addDynamicLight(position, 15, 15);
    }
}

    createMaterial(color) {
        const canvas = document.createElement('canvas');
        canvas.width = TEXTURE_SIZE;
        canvas.height = TEXTURE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(0, 0, 2, 2);
        ctx.fillRect(4, 4, 2, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(2, 8, 2, 2);
        ctx.fillRect(6, 12, 2, 2);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        const isLeaves = color === BLOCK_COLORS[BLOCKS.LEAVES];
        return new THREE.MeshLambertMaterial({
            map: tex,
            side: isLeaves ? THREE.DoubleSide : THREE.FrontSide,
            transparent: isLeaves,
            opacity: isLeaves ? 0.8 : 1,
            vertexColors: true // Enable vertex colors for AO
        });
    }

    createDroppedItemMaterial(color) {
        const canvas = document.createElement('canvas');
        canvas.width = TEXTURE_SIZE;
        canvas.height = TEXTURE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(0, 0, 2, 2);
        ctx.fillRect(4, 4, 2, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(2, 8, 2, 2);
        ctx.fillRect(6, 12, 2, 2);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        return new THREE.MeshStandardMaterial({
            map: tex,
            side: THREE.FrontSide,
            roughness: 0.8,
            metalness: 0.0
        });
    }

    initMaterials() {
        let i = 0;
        for (let id in BLOCKS) {
            const val = BLOCKS[id];
            if (val === BLOCKS.AIR || val === BLOCKS.SWORD || val === BLOCKS.PICKAXE || val === BLOCKS.TORCH || val === BLOCKS.SAPLING) continue;
            this.materials.push(this.createMaterial(BLOCK_COLORS[val]));
            this.matMap[val] = i;
            i++;
        }
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    getWorldBlock(x, y, z) {
        if (y < 0 || y >= WORLD_HEIGHT) return BLOCKS.AIR;
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunk = this.chunks[this.getChunkKey(cx, cz)];
        if (!chunk || !chunk.data) return BLOCKS.AIR;
        
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.data[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE];
    }

   setWorldBlock(x, y, z, type, onDrop) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    
    const key = this.getChunkKey(cx, cz);
    let chunk = this.chunks[key];
    if (!chunk) {
        chunk = this.createChunkData(cx, cz);
        this.chunks[key] = chunk;
    }

    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    
    const currentType = chunk.data[idx];
    chunk.data[idx] = type;
    chunk.dirty = true;
    
    // COMMENT OUT OR DELETE THIS ENTIRE SECTION:
    /*
    // Handle lighting updates (OPTIMIZED - minimal immediate work)
    if (this.lighting && this.lighting.enabled) {
        if (type === BLOCKS.TORCH) {
            this.lighting.addTorchLight(x, y, z);
        } else if (type === BLOCKS.AIR && currentType !== BLOCKS.AIR) {
            this.lighting.removeLight(x, y, z);
        } else if (type !== BLOCKS.AIR) {
            this.lighting.removeLight(x, y, z);
        }
    }
    */
    
    // In setWorldBlock, replace the shadow update section with:
    // Update shadows for affected column only (very fast)
    if (this.shadowBaker && this.shadowBaker.enabled) {
        this.shadowBaker.updateBlockColumn(x, z);
    }
    
    // Handle drops
    if (type === BLOCKS.AIR && currentType !== BLOCKS.AIR && currentType !== BLOCKS.BEDROCK) {
        let dropId = currentType;
        if (currentType === BLOCKS.GRASS) dropId = BLOCKS.DIRT;
        if (currentType === BLOCKS.LEAVES) {
            if (Math.random() < 0.2) dropId = BLOCKS.SAPLING;
            else dropId = null;
        }
        if (currentType === BLOCKS.SAPLING) dropId = BLOCKS.SAPLING;

        if (dropId && onDrop) {
            onDrop(dropId, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
        }
        
        if (currentType === BLOCKS.SAPLING) {
            const sIdx = this.saplingObjects.findIndex(s => 
                Math.floor(s.pos.x) === x && 
                Math.floor(s.pos.y) === y && 
                Math.floor(s.pos.z) === z
            );
            if (sIdx !== -1) {
                this.scene.remove(this.saplingObjects[sIdx].mesh);
                this.saplingObjects[sIdx].bar.remove();
                this.saplingObjects.splice(sIdx, 1);
            }
        }
    }
    
    if (type === BLOCKS.SAPLING && this.saplingModel) {
        const sm = this.saplingModel.clone();
        sm.position.set(x + 0.5, y, z + 0.5);
        this.scene.add(sm);
        
        const bar = document.createElement('div');
        bar.className = 'world-health-bar';
        bar.style.width = '40px';
        bar.style.height = '6px';
        bar.style.background = '#555';
        bar.innerHTML = '<div class="world-health-fill" style="background-color: #aaa; width: 0%;"></div>';
        document.getElementById('world-labels').appendChild(bar);
        
        this.saplingObjects.push({
            mesh: sm,
            pos: new THREE.Vector3(x + 0.5, y, z + 0.5),
            timer: 0,
            bar: bar,
            fill: bar.querySelector('.world-health-fill')
        });
    }

    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);
}

    markChunkDirty(cx, cz) {
        const c = this.chunks[this.getChunkKey(cx, cz)];
        if (c) c.dirty = true;
    }

    createChunkData(cx, cz) {
        const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = cx * CHUNK_SIZE + x;
                const wz = cz * CHUNK_SIZE + z;
                
                const freq = 0.1;
                let h = Math.floor(Math.sin(wx * freq) * 3 + Math.cos(wz * freq) * 3) + 12;
                
                if (Math.abs(wx) < 3 && Math.abs(wz) < 3) h = 12;

                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    let type = BLOCKS.AIR;
                    if (y === 0) type = BLOCKS.BEDROCK;
                    else if (y < h - 3) type = BLOCKS.STONE;
                    else if (y < h) type = BLOCKS.DIRT;
                    else if (y === h) type = BLOCKS.GRASS;
                    data[x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] = type;
                }
            }
        }
        
        // Generate trees
        const treeCount = Math.floor(Math.random() * 3);
        for (let t = 0; t < treeCount; t++) {
            const tx = Math.floor(Math.random() * (CHUNK_SIZE - 4)) + 2;
            const tz = Math.floor(Math.random() * (CHUNK_SIZE - 4)) + 2;
            
            const wx = cx * CHUNK_SIZE + tx;
            const wz = cz * CHUNK_SIZE + tz;
            if (Math.abs(wx) < 5 && Math.abs(wz) < 5) continue;

            let ty = 0;
            for (let y = WORLD_HEIGHT - 1; y > 0; y--) {
                if (data[tx + tz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] === BLOCKS.GRASS) {
                    ty = y;
                    break;
                }
            }
            
            if (ty > 0 && ty < WORLD_HEIGHT - 7) {
                this.generateTreeData(data, tx, ty, tz);
            }
        }

        return { cx, cz, data, mesh: null, dirty: true };
    }

    generateTreeData(data, tx, ty, tz) {
        for (let i = 1; i <= 4; i++) {
            data[tx + tz * CHUNK_SIZE + (ty + i) * CHUNK_SIZE * CHUNK_SIZE] = BLOCKS.WOOD;
        }
        
        for (let ly = ty + 3; ly <= ty + 5; ly++) {
            let radius = (ly === ty + 5) ? 1 : 2;
            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                    if (tx + lx < 0 || tx + lx >= CHUNK_SIZE || tz + lz < 0 || tz + lz >= CHUNK_SIZE) continue;
                    
                    const idx = (tx + lx) + (tz + lz) * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE;
                    if (data[idx] === BLOCKS.AIR) data[idx] = BLOCKS.LEAVES;
                }
            }
        }
        data[tx + tz * CHUNK_SIZE + (ty + 6) * CHUNK_SIZE * CHUNK_SIZE] = BLOCKS.LEAVES;
    }

    growTreeAt(wx, wy, wz) {
        // Check height
        for (let i = 1; i <= 5; i++) {
            if (this.getWorldBlock(wx, wy + i, wz) !== BLOCKS.AIR) return false;
        }
        
        // Place Wood
        for (let i = 0; i < 4; i++) {
            this.setWorldBlock(wx, wy + i, wz, BLOCKS.WOOD);
        }
        
        // Place Leaves
        for (let ly = wy + 3; ly <= wy + 5; ly++) {
            let radius = (ly === wy + 5) ? 1 : 2;
            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    if (radius === 2 && Math.abs(lx) === 2 && Math.abs(lz) === 2) continue;
                    if (this.getWorldBlock(wx + lx, ly, wz + lz) === BLOCKS.AIR) {
                        this.setWorldBlock(wx + lx, ly, wz + lz, BLOCKS.LEAVES);
                    }
                }
            }
        }
        this.setWorldBlock(wx, wy + 6, wz, BLOCKS.LEAVES);
        this.updateChunks();
        return true;
    }

    updateChunks() {
        for (let key in this.chunks) {
            const chunk = this.chunks[key];
            if (chunk.dirty) {
                this.generateChunkMesh(chunk);
                chunk.dirty = false;
            }
        }
    }

    generateChunkMesh(chunk) {
        if (chunk.mesh) this.scene.remove(chunk.mesh);

        const matVerts = {};
        const matUVs = {};
        const matIndices = {};
        const matColors = {};
        const matCounts = {};
        
        for (let m = 0; m < this.materials.length; m++) {
            matVerts[m] = [];
            matUVs[m] = [];
            matIndices[m] = [];
            matColors[m] = [];
            matCounts[m] = 0;
        }

        const { cx, cz, data } = chunk;
        const startX = cx * CHUNK_SIZE;
        const startZ = cz * CHUNK_SIZE;

        const isTransparent = (x, y, z) => {
            const t = this.getWorldBlock(x, y, z);
            return t === BLOCKS.AIR || t === BLOCKS.SAPLING;
        };

        const shouldRenderFace = (blockType, adjacentX, adjacentY, adjacentZ) => {
            const adjacent = this.getWorldBlock(adjacentX, adjacentY, adjacentZ);
            
            // Always render if adjacent is air or sapling
            if (adjacent === BLOCKS.AIR || adjacent === BLOCKS.SAPLING) return true;
            
            // For leaves, render faces even when adjacent to other leaves
            if (blockType === BLOCKS.LEAVES) {
                return adjacent !== BLOCKS.LEAVES; // Only skip if both are leaves
            }
            
            // For other blocks, don't render if adjacent block is solid
            return false;
        };

        const pushFace = (matIdx, wx, y, wz, faceKey) => {
        const verts = matVerts[matIdx];
        const uvs = matUVs[matIdx];
        const colors = matColors[matIdx];
        const inds = matIndices[matIdx];
        const currentCount = matCounts[matIdx];
        const face = CUBE_FACES[faceKey];
        
       // Get AO values for this face (YOUR PERFECTED AO)
        const aoValues = this.ao.getFaceAO(wx, y, wz, faceKey);

        // Convert AO to brightness (YOUR PERFECTED AO)
        const aoBrightness = aoValues.map(ao => this.ao.aoToBrightness(ao));

        // Get shadow brightness at block center
        let shadowBrightness = 1.0; // Default to full brightness if shadows disabled
        if (this.shadowBaker && this.shadowBaker.enabled) {
            shadowBrightness = this.shadowBaker.getShadowBrightness(wx, y, wz);
        }

        // Combine AO with shadows
        // AO modulates the shadow brightness
        const finalBrightness = aoBrightness.map(ao => {
            return ao * shadowBrightness;
        });
        
        // Add vertices
        for (let i = 0; i < face.length; i += 3) {
            verts.push(wx + face[i], y + face[i + 1], wz + face[i + 2]);
        }
        
        // Add UVs
        uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
        
        const ao0 = finalBrightness[0];
        const ao1 = finalBrightness[1];
        const ao2 = finalBrightness[2];
        const ao3 = finalBrightness[3];

        // YOUR PERFECTED AO VERTEX MAPPING (unchanged)
        if (faceKey === '+y') {
            colors.push(ao0, ao0, ao0, ao1, ao1, ao1, ao3, ao3, ao3, ao2, ao2, ao2);
        } else if (faceKey === '-y') {
            colors.push(ao3, ao3, ao3, ao2, ao2, ao2, ao0, ao0, ao0, ao1, ao1, ao1);
        } else if (faceKey === '+x') {
            colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
        } else if (faceKey === '-x') {
            colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
        } else if (faceKey === '+z') {
            colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
        } else if (faceKey === '-z') {
            colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
        }
        
        // YOUR PERFECTED AO QUAD FLIPPING (unchanged)
        if (aoValues[0] + aoValues[2] > aoValues[1] + aoValues[3]) {
            inds.push(
                currentCount, currentCount + 1, currentCount + 2,
                currentCount + 2, currentCount + 1, currentCount + 3
            );
        } else {
            inds.push(
                currentCount, currentCount + 1, currentCount + 3,
                currentCount, currentCount + 3, currentCount + 2
            );
        }
        
        matCounts[matIdx] += 4;
    };
        
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const idx = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
                    const type = data[idx];
                    if (type === BLOCKS.AIR || type === BLOCKS.SAPLING) continue;
                    
                    const matIdx = this.matMap[type];
                    if (matIdx === undefined) continue;

                    const wx = startX + x;
                    const wz = startZ + z;

                    if (shouldRenderFace(type, wx + 1, y, wz)) pushFace(matIdx, wx, y, wz, '+x');
                    if (shouldRenderFace(type, wx - 1, y, wz)) pushFace(matIdx, wx, y, wz, '-x');
                    if (shouldRenderFace(type, wx, y + 1, wz)) pushFace(matIdx, wx, y, wz, '+y');
                    if (shouldRenderFace(type, wx, y - 1, wz)) pushFace(matIdx, wx, y, wz, '-y');
                    if (shouldRenderFace(type, wx, y, wz + 1)) pushFace(matIdx, wx, y, wz, '+z');
                    if (shouldRenderFace(type, wx, y, wz - 1)) pushFace(matIdx, wx, y, wz, '-z');
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        const allVerts = [];
        const allUVs = [];
        const allColors = [];
        const allIndices = [];
        let vertOffset = 0;
        
        for (let m = 0; m < this.materials.length; m++) {
            const count = matIndices[m].length;
            if (count === 0) continue;

            geometry.addGroup(allIndices.length, count, m);
            allVerts.push(...matVerts[m]);
            allUVs.push(...matUVs[m]);
            allColors.push(...matColors[m]);
            
            const offset = vertOffset / 3;
            for (let i = 0; i < matIndices[m].length; i++) {
                allIndices.push(matIndices[m][i] + offset);
            }
            vertOffset += matVerts[m].length;
        }
        
        if (allVerts.length === 0) return;
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(allUVs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));
        geometry.setIndex(allIndices);
        geometry.computeVertexNormals();

        chunk.mesh = new THREE.Mesh(geometry, this.materials);
        this.scene.add(chunk.mesh);
    }

    // Add to generateWorld() method at the end:
    generateWorld() {
        for (let x = -WORLD_SIZE_CHUNKS / 2; x < WORLD_SIZE_CHUNKS / 2; x++) {
            for (let z = -WORLD_SIZE_CHUNKS / 2; z < WORLD_SIZE_CHUNKS / 2; z++) {
                const c = this.createChunkData(x, z);
                this.chunks[this.getChunkKey(x, z)] = c;
            }
        }
        // Lighting engine initialization disabled by default
        // this.lighting.initializeLighting();
        
        // Bake shadows for all chunks
        if (this.shadowBaker && this.shadowBaker.enabled) {
            this.shadowBaker.bakeAllChunks();
        }
        
        this.updateChunks();
    }

    loadSaplingModel() {
        const loader = new THREE.GLTFLoader();
        loader.load('assets/models/sapling.glb', (gltf) => {
            this.saplingModel = gltf.scene;
            this.applyShaderFix(this.saplingModel);
            this.saplingModel.scale.set(0.5, 0.5, 0.5);
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

    updateSaplings(dt, camera) {
        for (let i = this.saplingObjects.length - 1; i >= 0; i--) {
            const s = this.saplingObjects[i];
            s.timer += dt;
            
            s.bar.style.display = 'block';
            this.updateEntityLabel(s.pos.clone().add(new THREE.Vector3(0, 1.0, 0)), s.bar, camera);
            
            const percent = Math.min(100, (s.timer / 120) * 100);
            s.fill.style.width = percent + '%';
            
            if (s.timer >= 120) {
                const wx = Math.floor(s.pos.x);
                const wy = Math.floor(s.pos.y);
                const wz = Math.floor(s.pos.z);
                
                if (this.growTreeAt(wx, wy, wz)) {
                    this.scene.remove(s.mesh);
                    s.bar.remove();
                    this.saplingObjects.splice(i, 1);
                }
            }
        }
    }

    updateEntityLabel(position, element, camera) {
        const tempV = position.clone();
        tempV.project(camera);
        const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(tempV.y * 0.5) + 0.5) * window.innerHeight;

        if (tempV.z < 1.0) {
            element.style.transform = `translate(-50%, -100%)`;
            element.style.left = `${x}px`;
            element.style.top = `${y}px`;
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    }

    // Update shadows based on time of day
    updateShadows(dt) {
        if (!this.shadowBaker || !this.shadowBaker.enabled) return;
        
        this.shadowUpdateTimer += dt;
        
        // Check if enough time has passed and sun has moved significantly
        if (this.shadowUpdateTimer >= this.shadowUpdateInterval) {
            const currentAngle = this.shadowBaker.dayNightCycle ? 
                this.shadowBaker.dayNightCycle.getSunAngle() : 0;
            
            if (this.shadowBaker.shouldUpdateShadows(this.lastShadowUpdateAngle)) {
                console.log('Updating shadows due to sun movement...');
                this.shadowBaker.updateShadows();
                this.lastShadowUpdateAngle = currentAngle;
                this.updateChunks();
            }
            
            this.shadowUpdateTimer = 0;
        }
    }
}