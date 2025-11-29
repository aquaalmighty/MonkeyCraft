// GreedyMesher.js - Fixed greedy meshing with proper texture tiling and AO

import { CHUNK_SIZE, WORLD_HEIGHT, BLOCKS } from './GameConstants.js';

export class GreedyMesher {
    constructor(worldEngine) {
        this.worldEngine = worldEngine;
    }

    // Get block with bounds checking
    getBlock(x, y, z) {
        if (y < 0 || y >= WORLD_HEIGHT) return BLOCKS.AIR;
        return this.worldEngine.getWorldBlock(x, y, z);
    }

    // Check if block is transparent/air
    isTransparent(blockType) {
        return blockType === BLOCKS.AIR || blockType === BLOCKS.SAPLING;
    }

    // Check if block is opaque
    isOpaque(blockType) {
        return !this.isTransparent(blockType) && blockType !== BLOCKS.LEAVES;
    }

    // Calculate ambient occlusion for a vertex
    calculateAO(side1, side2, corner) {
        if (side1 && side2) {
            return 0; // Darkest
        }
        return 3 - (side1 + side2 + corner); // 0-3 scale
    }

    // Get AO values for a single block face vertex
    getAOForBlockFace(x, y, z, d, side) {
        // d is the axis: 0=X, 1=Y, 2=Z
        // side is -1 or 1
        
        let u, v;
        if (d === 0) { // X axis (East/West)
            u = [0, 1, 0]; v = [0, 0, 1];
        } else if (d === 1) { // Y axis (Top/Bottom)
            u = [1, 0, 0]; v = [0, 0, 1];
        } else { // Z axis (North/South)
            u = [1, 0, 0]; v = [0, 1, 0];
        }

        const nx = x + (d === 0 ? side : 0);
        const ny = y + (d === 1 ? side : 0);
        const nz = z + (d === 2 ? side : 0);

        // Get the 8 surrounding blocks
        const s00 = this.isOpaque(this.getBlock(nx - u[0] - v[0], ny - u[1] - v[1], nz - u[2] - v[2])) ? 1 : 0;
        const s01 = this.isOpaque(this.getBlock(nx - u[0], ny - u[1], nz - u[2])) ? 1 : 0;
        const s02 = this.isOpaque(this.getBlock(nx - u[0] + v[0], ny - u[1] + v[1], nz - u[2] + v[2])) ? 1 : 0;
        const s10 = this.isOpaque(this.getBlock(nx - v[0], ny - v[1], nz - v[2])) ? 1 : 0;
        const s12 = this.isOpaque(this.getBlock(nx + v[0], ny + v[1], nz + v[2])) ? 1 : 0;
        const s20 = this.isOpaque(this.getBlock(nx + u[0] - v[0], ny + u[1] - v[1], nz + u[2] - v[2])) ? 1 : 0;
        const s21 = this.isOpaque(this.getBlock(nx + u[0], ny + u[1], nz + u[2])) ? 1 : 0;
        const s22 = this.isOpaque(this.getBlock(nx + u[0] + v[0], ny + u[1] + v[1], nz + u[2] + v[2])) ? 1 : 0;

        // Calculate AO for each corner
        return [
            this.calculateAO(s01, s10, s00), // 00
            this.calculateAO(s01, s12, s02), // 01
            this.calculateAO(s21, s12, s22), // 11
            this.calculateAO(s21, s10, s20)  // 10
        ];
    }

    // Generate mesh using greedy meshing algorithm
    generateMesh(chunk) {
        const { cx, cz, data } = chunk;
        const quads = [];

        // Helper to get local block
        const getLocalBlock = (x, y, z) => {
            if (y < 0 || y >= WORLD_HEIGHT) return BLOCKS.AIR;
            if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
                const wx = cx * CHUNK_SIZE + x;
                const wz = cz * CHUNK_SIZE + z;
                return this.getBlock(wx, y, wz);
            }
            return data[x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE];
        };

        // Sweep over each axis
        for (let d = 0; d < 3; d++) {
            const u = (d + 1) % 3;
            const v = (d + 2) % 3;

            const x = [0, 0, 0];
            const q = [0, 0, 0];

            const dims = [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE];
            const mask = new Array(dims[u] * dims[v]);

            q[d] = 1;

            // Check both sides of each slice
            for (x[d] = -1; x[d] < dims[d];) {
                // Compute mask
                let n = 0;

                for (x[v] = 0; x[v] < dims[v]; x[v]++) {
                    for (x[u] = 0; x[u] < dims[u]; x[u]++) {
                        const blockA = (x[d] >= 0) ? getLocalBlock(x[0], x[1], x[2]) : BLOCKS.AIR;
                        const blockB = (x[d] < dims[d] - 1) ? getLocalBlock(x[0] + q[0], x[1] + q[1], x[2] + q[2]) : BLOCKS.AIR;

                        const opaqueA = !this.isTransparent(blockA);
                        const opaqueB = !this.isTransparent(blockB);

                        if (opaqueA === opaqueB) {
                            mask[n++] = null;
                        } else if (opaqueA) {
                            mask[n++] = { type: blockA, side: 1 };
                        } else {
                            mask[n++] = { type: blockB, side: -1 };
                        }
                    }
                }

                x[d]++;

                // Generate mesh from mask
                n = 0;
                for (let j = 0; j < dims[v]; j++) {
                    for (let i = 0; i < dims[u];) {
                        if (mask[n] !== null) {
                            const current = mask[n];

                            // Compute width
                            let w;
                            for (w = 1; i + w < dims[u] && mask[n + w] !== null &&
                                mask[n + w].type === current.type &&
                                mask[n + w].side === current.side; w++) {}

                            // Compute height
                            let h;
                            let done = false;
                            for (h = 1; j + h < dims[v]; h++) {
                                for (let k = 0; k < w; k++) {
                                    const idx = n + k + h * dims[u];
                                    if (mask[idx] === null ||
                                        mask[idx].type !== current.type ||
                                        mask[idx].side !== current.side) {
                                        done = true;
                                        break;
                                    }
                                }
                                if (done) break;
                            }

                            // Add quad
                            x[u] = i;
                            x[v] = j;

                            const du = [0, 0, 0];
                            du[u] = w;
                            const dv = [0, 0, 0];
                            dv[v] = h;

                            const worldX = cx * CHUNK_SIZE + x[0];
                            const worldY = x[1];
                            const worldZ = cz * CHUNK_SIZE + x[2];

                            quads.push({
                                blockType: current.type,
                                x: [worldX, worldY, worldZ],
                                du,
                                dv,
                                d,
                                side: current.side,
                                width: w,
                                height: h
                            });

                            // Zero out mask
                            for (let l = 0; l < h; l++) {
                                for (let k = 0; k < w; k++) {
                                    mask[n + k + l * dims[u]] = null;
                                }
                            }

                            i += w;
                            n += w;
                        } else {
                            i++;
                            n++;
                        }
                    }
                }
            }
        }

        return quads;
    }

    // Convert quads to Three.js geometry data with proper texture tiling
    quadsToGeometry(quads, matMap) {
        const matVerts = {};
        const matUVs = {};
        const matColors = {};
        const matIndices = {};
        const matCounts = {};

        const numMaterials = Object.keys(matMap).length;
        for (let m = 0; m < numMaterials; m++) {
            matVerts[m] = [];
            matUVs[m] = [];
            matColors[m] = [];
            matIndices[m] = [];
            matCounts[m] = 0;
        }

        for (const quad of quads) {
            const { blockType, x, du, dv, d, side, width, height } = quad;
            const matIdx = matMap[blockType];

            if (matIdx === undefined) continue;

            const verts = matVerts[matIdx];
            const uvs = matUVs[matIdx];
            const colors = matColors[matIdx];
            const inds = matIndices[matIdx];
            const count = matCounts[matIdx];

            // Calculate face shading based on axis and side
            let faceShade = 1.0;
            if (d === 1) { // Y axis
                faceShade = side > 0 ? 1.0 : 0.5; // Top bright, bottom dark
            } else if (d === 0) { // X axis
                faceShade = 0.8;
            } else { // Z axis
                faceShade = 0.7;
            }

            // Create vertices for the entire quad
            const v0 = [x[0], x[1], x[2]];
            const v1 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
            const v2 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
            const v3 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];

            // Calculate AO for each corner of the greedy quad
            // We need to sample AO at each unit block position within the quad
            const aoGrid = [];
            for (let row = 0; row <= height; row++) {
                aoGrid[row] = [];
                for (let col = 0; col <= width; col++) {
                    const blockX = x[0] + (d === 0 ? 0 : col * (du[0] ? 1 : 0) + row * (dv[0] ? 1 : 0));
                    const blockY = x[1] + (d === 1 ? 0 : col * (du[1] ? 1 : 0) + row * (dv[1] ? 1 : 0));
                    const blockZ = x[2] + (d === 2 ? 0 : col * (du[2] ? 1 : 0) + row * (dv[2] ? 1 : 0));
                    
                    const ao = this.getAOForBlockFace(blockX, blockY, blockZ, d, side);
                    // Store the average AO for this corner
                    aoGrid[row][col] = (ao[0] + ao[1] + ao[2] + ao[3]) / 4;
                }
            }

            // Average the corners for smooth AO across the quad
            const ao0 = aoGrid[0][0];
            const ao1 = aoGrid[0][width];
            const ao2 = aoGrid[height][width];
            const ao3 = aoGrid[height][0];

            const aoShading = [ao0, ao1, ao2, ao3].map(v => (0.4 + (v / 3) * 0.6) * faceShade);

            // Correct winding order based on side
            if (side > 0) {
                verts.push(...v0, ...v1, ...v2, ...v3);
                colors.push(
                    aoShading[0], aoShading[0], aoShading[0],
                    aoShading[1], aoShading[1], aoShading[1],
                    aoShading[2], aoShading[2], aoShading[2],
                    aoShading[3], aoShading[3], aoShading[3]
                );
            } else {
                verts.push(...v0, ...v3, ...v2, ...v1);
                colors.push(
                    aoShading[0], aoShading[0], aoShading[0],
                    aoShading[3], aoShading[3], aoShading[3],
                    aoShading[2], aoShading[2], aoShading[2],
                    aoShading[1], aoShading[1], aoShading[1]
                );
            }

            // CRITICAL FIX: Tile UVs based on quad dimensions AND axis
            // For side faces (X/Z axis), we need to consider the actual world dimensions
            let uvWidth = width;
            let uvHeight = height;
            
            // Adjust UV tiling based on which axis this face is on
            if (d === 0) { // X axis (East/West faces)
                // Width goes along Z, height goes along Y
                uvWidth = width;  // This is actually Z distance
                uvHeight = height; // This is actually Y distance
            } else if (d === 1) { // Y axis (Top/Bottom faces)
                // Width goes along X, height goes along Z
                uvWidth = width;  // This is actually X distance
                uvHeight = height; // This is actually Z distance
            } else { // d === 2, Z axis (North/South faces)
                // Width goes along X, height goes along Y
                uvWidth = width;  // This is actually X distance
                uvHeight = height; // This is actually Y distance
            }

            uvs.push(
                0, 0,
                uvWidth, 0,
                uvWidth, uvHeight,
                0, uvHeight
            );

            // Add indices with proper winding for AO
            const ao_sum0 = aoShading[0] + aoShading[2];
            const ao_sum1 = aoShading[1] + aoShading[3];

            if (ao_sum0 > ao_sum1) {
                inds.push(count, count + 1, count + 2, count + 2, count + 3, count);
            } else {
                inds.push(count, count + 1, count + 3, count + 3, count + 1, count + 2);
            }

            matCounts[matIdx] += 4;
        }

        return { matVerts, matUVs, matColors, matIndices, matCounts };
    }
}