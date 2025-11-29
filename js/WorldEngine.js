// WorldEngine.js - Chunk generation, block management, and mesh generation with Ambient Occlusion

import { CHUNK_SIZE, WORLD_HEIGHT, WORLD_SIZE_CHUNKS, TEXTURE_SIZE, BLOCKS, BLOCK_COLORS, CUBE_FACES } from './GameConstants.js';
import { AmbientOcclusion } from './AmbientOcclusion.js';

export class WorldEngine {
    constructor(scene) {
        this.scene = scene;
        this.chunks = {};
        this.materials = [];
        this.matMap = {};
        this.saplingObjects = [];
        this.saplingModel = null;
        this.ao = new AmbientOcclusion(this);
        
        this.initMaterials();
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
            
            // Remove visual sapling
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
        
        // Add visual sapling
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


        const pushFace = (matIdx, wx, y, wz, faceKey) => {
            const verts = matVerts[matIdx];
            const uvs = matUVs[matIdx];
            const colors = matColors[matIdx];
            const inds = matIndices[matIdx];
            const currentCount = matCounts[matIdx];
            const face = CUBE_FACES[faceKey];
            
            // Get AO values for this face
            const aoValues = this.ao.getFaceAO(wx, y, wz, faceKey);
            
            // Convert AO to brightness
            const brightness = aoValues.map(ao => this.ao.aoToBrightness(ao));
            
            // Add vertices
            for (let i = 0; i < face.length; i += 3) {
                verts.push(wx + face[i], y + face[i + 1], wz + face[i + 2]);
            }
            
            // Add UVs
            uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
            
            // Map AO values to actual vertex positions
            // AO returns corners in order based on face's local coordinate system
            const ao0 = brightness[0];
            const ao1 = brightness[1];
            const ao2 = brightness[2];
            const ao3 = brightness[3];


            // Map AO to vertices based on how getFaceAO samples each face
            if (faceKey === '+y') {
                // Top face - keep as is
                colors.push(ao0, ao0, ao0, ao1, ao1, ao1, ao3, ao3, ao3, ao2, ao2, ao2);
            } else if (faceKey === '-y') {
                // Bottom face - keep as is
                colors.push(ao3, ao3, ao3, ao2, ao2, ao2, ao0, ao0, ao0, ao1, ao1, ao1);
            } else if (faceKey === '+x') {
                // Right face: CUBE_FACES = [1,0,1, 1,0,0, 1,1,1, 1,1,0]
                // getFaceAO samples: [(+y,-z), (+y,+z), (-y,+z), (-y,-z)]
                // That's: [TL, TR, BR, BL] where:
                //   TL = top-back (y+1, z-1)  = ao0
                //   TR = top-front (y+1, z+1) = ao1
                //   BR = bottom-front (y-1, z+1) = ao2
                //   BL = bottom-back (y-1, z-1) = ao3
                // Vertices in CUBE_FACES order:
                //   v0 = (1,0,1) = bottom-front = ao2
                //   v1 = (1,0,0) = bottom-back = ao3
                //   v2 = (1,1,1) = top-front = ao1
                //   v3 = (1,1,0) = top-back = ao0
                colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
                
            } else if (faceKey === '-x') {
                // Left face: CUBE_FACES = [0,0,0, 0,0,1, 0,1,0, 0,1,1]
                // getFaceAO samples: [(+y,+z), (+y,-z), (-y,-z), (-y,+z)]
                // That's: [TL, TR, BR, BL] where:
                //   TL = top-front (y+1, z+1) = ao0
                //   TR = top-back (y+1, z-1) = ao1
                //   BR = bottom-back (y-1, z-1) = ao2
                //   BL = bottom-front (y-1, z+1) = ao3
                // Vertices in CUBE_FACES order:
                //   v0 = (0,0,0) = bottom-back = ao2
                //   v1 = (0,0,1) = bottom-front = ao3
                //   v2 = (0,1,0) = top-back = ao1
                //   v3 = (0,1,1) = top-front = ao0
                colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
                
            } else if (faceKey === '+z') {
                // Front face: CUBE_FACES = [0,0,1, 1,0,1, 0,1,1, 1,1,1]
                // getFaceAO samples: [(+y,+x), (+y,-x), (-y,-x), (-y,+x)]
                // That's: [TL, TR, BR, BL] where:
                //   TL = top-right (y+1, x+1) = ao0
                //   TR = top-left (y+1, x-1) = ao1
                //   BR = bottom-left (y-1, x-1) = ao2
                //   BL = bottom-right (y-1, x+1) = ao3
                // Vertices in CUBE_FACES order:
                //   v0 = (0,0,1) = bottom-left = ao2
                //   v1 = (1,0,1) = bottom-right = ao3
                //   v2 = (0,1,1) = top-left = ao1
                //   v3 = (1,1,1) = top-right = ao0
                colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
                
            } else if (faceKey === '-z') {
                // Back face: CUBE_FACES = [1,0,0, 0,0,0, 1,1,0, 0,1,0]
                // getFaceAO samples: [(+y,-x), (+y,+x), (-y,+x), (-y,-x)]
                // That's: [TL, TR, BR, BL] where:
                //   TL = top-left (y+1, x-1) = ao0
                //   TR = top-right (y+1, x+1) = ao1
                //   BR = bottom-right (y-1, x+1) = ao2
                //   BL = bottom-left (y-1, x-1) = ao3
                // Vertices in CUBE_FACES order:
                //   v0 = (1,0,0) = bottom-right = ao2
                //   v1 = (0,0,0) = bottom-left = ao3
                //   v2 = (1,1,0) = top-right = ao1
                //   v3 = (0,1,0) = top-left = ao0
                colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
            }

            /**

            // Map AO to vertices based on how getFaceAO samples each face
            if (faceKey === '+y') {
                colors.push(ao0, ao0, ao0, ao1, ao1, ao1, ao3, ao3, ao3, ao2, ao2, ao2);
            } else if (faceKey === '-y') {
                colors.push(ao3, ao3, ao3, ao2, ao2, ao2, ao0, ao0, ao0, ao1, ao1, ao1);
            } else if (faceKey === '+x') {
                colors.push(ao3, ao3, ao3, ao2, ao2, ao2, ao1, ao1, ao1, ao0, ao0, ao0);
            } else if (faceKey === '-x') {
                colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao1, ao1, ao1, ao0, ao0, ao0);
            } else if (faceKey === '+z') {
                colors.push(ao3, ao3, ao3, ao2, ao2, ao2, ao1, ao1, ao1, ao0, ao0, ao0);
            } else if (faceKey === '-z') {
                colors.push(ao2, ao2, ao2, ao3, ao3, ao3, ao0, ao0, ao0, ao1, ao1, ao1);
            }

            **/
            
            // CRITICAL: Choose quad subdivision based on AO values to avoid anisotropy
            // From the paper: if(ao0 + ao2 > ao1 + ao3) flip the quad
            // This ensures we subdivide along the diagonal with less AO variation
            if (aoValues[0] + aoValues[2] > aoValues[1] + aoValues[3]) {
                // Use diagonal v1-v2 (flipped quad)
                inds.push(
                    currentCount, currentCount + 1, currentCount + 2,
                    currentCount + 2, currentCount + 1, currentCount + 3
                );
            } else {
                // Use diagonal v0-v3 (normal quad)
                inds.push(
                    currentCount, currentCount + 1, currentCount + 3,
                    currentCount, currentCount + 3, currentCount + 2
                );
            }
            
            matCounts[matIdx] += 4;
        };


        /** 

        const pushFace = (matIdx, wx, y, wz, faceKey) => {
            const verts = matVerts[matIdx];
            const uvs = matUVs[matIdx];
            const colors = matColors[matIdx];
            const inds = matIndices[matIdx];
            const currentCount = matCounts[matIdx];
            const face = CUBE_FACES[faceKey];
            
            // Get AO values for this face
            const aoValues = this.ao.getFaceAO(wx, y, wz, faceKey);
            
            // Convert AO to brightness
            const brightness = aoValues.map(ao => this.ao.aoToBrightness(ao));
            
            // Add vertices
            for (let i = 0; i < face.length; i += 3) {
                verts.push(wx + face[i], y + face[i + 1], wz + face[i + 2]);
            }
            
            // Add UVs
            uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
            
            // Add vertex colors for AO (RGB all same for grayscale)
            // AO returns [corner0, corner1, corner2, corner3] based on the face's sampling pattern
            const ao0 = brightness[0];
            const ao1 = brightness[1];
            const ao2 = brightness[2];
            const ao3 = brightness[3];

            // Map AO corners to CUBE_FACES vertices by matching the sampling positions
            if (faceKey === '+y') {
                // getFaceAO samples: [(-x,+z), (+x,+z), (+x,-z), (-x,-z)]
                // CUBE_FACES: [(0,1,1), (1,1,1), (0,1,0), (1,1,0)]
                // v0=(0,z=1)=ao0, v1=(1,z=1)=ao1, v2=(0,z=0)=ao3, v3=(1,z=0)=ao2
                colors.push(ao0, ao0, ao0); // v0
                colors.push(ao1, ao1, ao1); // v1
                colors.push(ao3, ao3, ao3); // v2
                colors.push(ao2, ao2, ao2); // v3
            } else if (faceKey === '-y') {
                // getFaceAO samples: [(-x,+z), (+x,+z), (+x,-z), (-x,-z)]
                // CUBE_FACES: [(0,0,0), (1,0,0), (0,0,1), (1,0,1)]
                // v0=(0,z=0)=ao3, v1=(1,z=0)=ao2, v2=(0,z=1)=ao0, v3=(1,z=1)=ao1
                colors.push(ao3, ao3, ao3); // v0
                colors.push(ao2, ao2, ao2); // v1
                colors.push(ao0, ao0, ao0); // v2
                colors.push(ao1, ao1, ao1); // v3
            } else if (faceKey === '+x') {
                // getFaceAO samples: [(+y,-z), (+y,+z), (-y,+z), (-y,-z)]
                // CUBE_FACES: [(1,0,1), (1,0,0), (1,1,1), (1,1,0)]
                // v0=(y=0,z=1)=ao3, v1=(y=0,z=0)=ao2, v2=(y=1,z=1)=ao1, v3=(y=1,z=0)=ao0
                colors.push(ao3, ao3, ao3); // v0
                colors.push(ao2, ao2, ao2); // v1
                colors.push(ao1, ao1, ao1); // v2
                colors.push(ao0, ao0, ao0); // v3
            } else if (faceKey === '-x') {
                // getFaceAO samples: [(+y,+z), (+y,-z), (-y,-z), (-y,+z)]
                // CUBE_FACES: [(0,0,0), (0,0,1), (0,1,0), (0,1,1)]
                // v0=(y=0,z=0)=ao2, v1=(y=0,z=1)=ao3, v2=(y=1,z=0)=ao1, v3=(y=1,z=1)=ao0
                colors.push(ao2, ao2, ao2); // v0
                colors.push(ao3, ao3, ao3); // v1
                colors.push(ao1, ao1, ao1); // v2
                colors.push(ao0, ao0, ao0); // v3
            } else if (faceKey === '+z') {
                // getFaceAO samples: [(+y,+x), (+y,-x), (-y,-x), (-y,+x)]
                // CUBE_FACES: [(0,0,1), (1,0,1), (0,1,1), (1,1,1)]
                // v0=(x=0,y=0)=ao3, v1=(x=1,y=0)=ao2, v2=(x=0,y=1)=ao1, v3=(x=1,y=1)=ao0
                colors.push(ao3, ao3, ao3); // v0
                colors.push(ao2, ao2, ao2); // v1
                colors.push(ao1, ao1, ao1); // v2
                colors.push(ao0, ao0, ao0); // v3
            } else if (faceKey === '-z') {
                // getFaceAO samples: [(+y,-x), (+y,+x), (-y,+x), (-y,-x)]
                // CUBE_FACES: [(1,0,0), (0,0,0), (1,1,0), (0,1,0)]
                // v0=(x=1,y=0)=ao2, v1=(x=0,y=0)=ao3, v2=(x=1,y=1)=ao0, v3=(x=0,y=1)=ao1
                colors.push(ao2, ao2, ao2); // v0
                colors.push(ao3, ao3, ao3); // v1
                colors.push(ao0, ao0, ao0); // v2
                colors.push(ao1, ao1, ao1); // v3
            }

            **/

            /** 
            // FIX: Assign colors based on each specific face direction
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else if (faceKey === '+x') {
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '-x') {
                colors.push(b_bl, b_bl, b_bl); // v0 - SAME as +x
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '+z') {
                colors.push(b_br, b_br, b_br); // v0 - FLIPPED
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            } else if (faceKey === '-z') {
                colors.push(b_bl, b_bl, b_bl); // v0 - same as +x/-x
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            }

            **/

            /**

            // FIX: Assign colors based on each specific face direction
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else if (faceKey === '+x') {
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '-x') {
                colors.push(b_bl, b_bl, b_bl); // v0 - SAME as +x (not opposite)
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '+z') {
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '-z') {
                colors.push(b_br, b_br, b_br); // v0 - opposite of +z
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            }

            **/

            /**

            // FIX: Assign colors based on each specific face direction
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else if (faceKey === '+x') {
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '-x') {
                colors.push(b_br, b_br, b_br); // v0 - opposite of +x
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            } else if (faceKey === '+z') {
                colors.push(b_bl, b_bl, b_bl); // v0 - CHANGED to match +x pattern
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '-z') {
                colors.push(b_br, b_br, b_br); // v0 - opposite of +z
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            }

            **/

            /** 

            // FIX: Assign colors based on each specific face direction
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else if (faceKey === '+x') {
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '-x') {
                colors.push(b_bl, b_bl, b_bl); // v0 - SWAPPED to match +x
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '+z') {
                colors.push(b_br, b_br, b_br); // v0
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            } else if (faceKey === '-z') {
                colors.push(b_br, b_br, b_br); // v0 - SWAPPED to match +z
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            }

            **/

            /**

            // FIX: Assign colors based on each specific face direction
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else if (faceKey === '+x') {
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else if (faceKey === '-x') {
                colors.push(b_br, b_br, b_br); // v0
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            } else if (faceKey === '+z') {
                colors.push(b_br, b_br, b_br); // v0
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            } else if (faceKey === '-z') {
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            }

            **/


            /**

            // FIX: Assign colors based on actual face vertex layout
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else if (faceKey === '+x' || faceKey === '-x') {
                // X-axis Faces: Swapped vertical order
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else {
                // Z-axis Faces: Swapped both vertical AND horizontal
                colors.push(b_br, b_br, b_br); // v0
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2
                colors.push(b_tl, b_tl, b_tl); // v3
            }

            **/

            /**
            // FIX: Assign colors based on actual face vertex layout
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else {
                // All Side Faces (X and Z): Same swapped order
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            }
            **/

            /**

            // FIX: Assign colors based on actual face vertex layout
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else if (faceKey === '+x' || faceKey === '-x') {
                // X-axis Faces: Different winding
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            } else {
                // Z-axis Faces (+z/-z): Need mirrored horizontal order
                colors.push(b_br, b_br, b_br); // v0 - swap BR/BL
                colors.push(b_bl, b_bl, b_bl); // v1
                colors.push(b_tr, b_tr, b_tr); // v2 - swap TR/TL
                colors.push(b_tl, b_tl, b_tl); // v3
            }
            **/

            /** 
            // FIX: Check face direction to apply colors to the correct vertices
            if (faceKey === '+y' || faceKey === '-y') {
                // Top & Bottom Faces: Standard Order (TL, TR, BL, BR)
                colors.push(b_tl, b_tl, b_tl); // v0
                colors.push(b_tr, b_tr, b_tr); // v1
                colors.push(b_bl, b_bl, b_bl); // v2
                colors.push(b_br, b_br, b_br); // v3
            } else {
                // Side Faces: Swapped Order (BL, BR, TL, TR)
                // This aligns the top brightness values with the top vertices
                colors.push(b_bl, b_bl, b_bl); // v0
                colors.push(b_br, b_br, b_br); // v1
                colors.push(b_tl, b_tl, b_tl); // v2
                colors.push(b_tr, b_tr, b_tr); // v3
            }
            **/
            
            /** 

            // NEW, CORRECTED CODE
            // Add indices - check if we need to flip quad to avoid artifacts
            if (aoValues[0] + aoValues[2] > aoValues[1] + aoValues[3]) {
                // Diagonal TL-BR is darker. Use the *other* diagonal (TR-BL).
                // (v0, v1, v2) and (v2, v1, v3)
                inds.push(currentCount, currentCount + 1, currentCount + 2, currentCount + 2, currentCount + 1, currentCount + 3);
            } else {
                // Diagonal TR-BL is darker. Use the *other* diagonal (TL-BR).
                // (v0, v1, v3) and (v0, v3, v2)
                // This is the line that fixes the Z-fighting:
                inds.push(currentCount, currentCount + 1, currentCount + 3, currentCount, currentCount + 3, currentCount + 2);
            }
            
            matCounts[matIdx] += 4;
        };

        **/

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
                    
                    if (isTransparent(wx + 1, y, wz)) pushFace(matIdx, wx, y, wz, '+x');
                    if (isTransparent(wx - 1, y, wz)) pushFace(matIdx, wx, y, wz, '-x');
                    if (isTransparent(wx, y + 1, wz)) pushFace(matIdx, wx, y, wz, '+y');
                    if (isTransparent(wx, y - 1, wz)) pushFace(matIdx, wx, y, wz, '-y');
                    if (isTransparent(wx, y, wz + 1)) pushFace(matIdx, wx, y, wz, '+z');
                    if (isTransparent(wx, y, wz - 1)) pushFace(matIdx, wx, y, wz, '-z');
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

    generateWorld() {
        for (let x = -WORLD_SIZE_CHUNKS / 2; x < WORLD_SIZE_CHUNKS / 2; x++) {
            for (let z = -WORLD_SIZE_CHUNKS / 2; z < WORLD_SIZE_CHUNKS / 2; z++) {
                const c = this.createChunkData(x, z);
                this.chunks[this.getChunkKey(x, z)] = c;
            }
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
}