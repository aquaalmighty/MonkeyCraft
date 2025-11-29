// SimpleMesher.js - Simple face culling with ambient occlusion (no greedy meshing)

import { CHUNK_SIZE, WORLD_HEIGHT, BLOCKS, CUBE_FACES } from './GameConstants.js';

export class SimpleMesher {
    constructor(worldEngine) {
        this.worldEngine = worldEngine;
    }

    getBlock(x, y, z) {
        if (y < 0 || y >= WORLD_HEIGHT) return BLOCKS.AIR;
        return this.worldEngine.getWorldBlock(x, y, z);
    }

    isTransparent(blockType) {
        return blockType === BLOCKS.AIR || blockType === BLOCKS.SAPLING;
    }

    isOpaque(blockType) {
        return !this.isTransparent(blockType) && blockType !== BLOCKS.LEAVES;
    }

    // Calculate AO for a vertex given its 3 neighbors
    calculateAO(side1, side2, corner) {
        if (side1 && side2) {
            return 0; // Darkest - two sides block
        }
        return 3 - (side1 + side2 + corner); // 0-3 scale
    }

    // Get AO for each vertex of a face
    getAOForFace(x, y, z, faceKey) {
        const offsets = {
            '+x': { normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
            '-x': { normal: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
            '+y': { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
            '-y': { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
            '+z': { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
            '-z': { normal: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] }
        };

        const { normal, u, v } = offsets[faceKey];
        const [nx, ny, nz] = normal;
        const [ux, uy, uz] = u;
        const [vx, vy, vz] = v;

        // Position on the face
        const fx = x + nx;
        const fy = y + ny;
        const fz = z + nz;

        // Get 8 surrounding blocks
        const getOcclusion = (ou, ov) => {
            const bx = fx + ux * ou + vx * ov;
            const by = fy + uy * ou + vy * ov;
            const bz = fz + uz * ou + vz * ov;
            return this.isOpaque(this.getBlock(bx, by, bz)) ? 1 : 0;
        };

        // Corners: -u-v, +u-v, +u+v, -u+v
        const s00 = getOcclusion(-1, -1);
        const s01 = getOcclusion(0, -1);
        const s02 = getOcclusion(1, -1);
        const s10 = getOcclusion(-1, 0);
        const s12 = getOcclusion(1, 0);
        const s20 = getOcclusion(-1, 1);
        const s21 = getOcclusion(0, 1);
        const s22 = getOcclusion(1, 1);

        return [
            this.calculateAO(s10, s01, s00), // bottom-left
            this.calculateAO(s12, s01, s02), // bottom-right
            this.calculateAO(s12, s21, s22), // top-right
            this.calculateAO(s10, s21, s20)  // top-left
        ];
    }

    generateMesh(chunk) {
        const { cx, cz, data } = chunk;
        const startX = cx * CHUNK_SIZE;
        const startZ = cz * CHUNK_SIZE;

        const faces = [];

        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const idx = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
                    const type = data[idx];
                    
                    if (type === BLOCKS.AIR || type === BLOCKS.SAPLING) continue;

                    const wx = startX + x;
                    const wz = startZ + z;

                    // Check each face
                    const faces_to_check = [
                        { key: '+x', check: [wx + 1, y, wz] },
                        { key: '-x', check: [wx - 1, y, wz] },
                        { key: '+y', check: [wx, y + 1, wz] },
                        { key: '-y', check: [wx, y - 1, wz] },
                        { key: '+z', check: [wx, y, wz + 1] },
                        { key: '-z', check: [wx, y, wz - 1] }
                    ];

                    for (const face of faces_to_check) {
                        const neighbor = this.getBlock(...face.check);
                        if (this.isTransparent(neighbor)) {
                            const ao = this.getAOForFace(wx, y, wz, face.key);
                            faces.push({
                                blockType: type,
                                x: wx,
                                y: y,
                                z: wz,
                                faceKey: face.key,
                                ao
                            });
                        }
                    }
                }
            }
        }

        return faces;
    }

    facesToGeometry(faces, matMap) {
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

        for (const face of faces) {
            const { blockType, x, y, z, faceKey, ao } = face;
            const matIdx = matMap[blockType];

            if (matIdx === undefined) continue;

            const verts = matVerts[matIdx];
            const uvs = matUVs[matIdx];
            const colors = matColors[matIdx];
            const inds = matIndices[matIdx];
            const count = matCounts[matIdx];

            // Get face vertices from CUBE_FACES
            const faceVerts = CUBE_FACES[faceKey];

            // Add vertices with offset
            for (let i = 0; i < faceVerts.length; i += 3) {
                verts.push(x + faceVerts[i], y + faceVerts[i + 1], z + faceVerts[i + 2]);
            }

            // Add UVs - always 0-1 for single block faces
            uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

            // Calculate face shading
            let faceShade = 1.0;
            if (faceKey === '+y') faceShade = 1.0;
            else if (faceKey === '-y') faceShade = 0.5;
            else if (faceKey === '+x' || faceKey === '-x') faceShade = 0.8;
            else faceShade = 0.7;

            // Apply AO with increased intensity (0.1-1.0 range for dramatic shadows)
            const aoShading = ao.map(v => (0.1 + (v / 3) * 0.9) * faceShade);

            // Add colors (one per vertex)
            for (let i = 0; i < 4; i++) {
                colors.push(aoShading[i], aoShading[i], aoShading[i]);
            }

            // Add indices with AO-based winding
            const ao0 = ao[0] + ao[2];
            const ao1 = ao[1] + ao[3];

            if (ao0 > ao1) {
                inds.push(count, count + 1, count + 2, count + 2, count + 1, count + 3);
            } else {
                inds.push(count, count + 2, count + 3, count + 3, count + 1, count);
            }

            matCounts[matIdx] += 4;
        }

        return { matVerts, matUVs, matColors, matIndices, matCounts };
    }
}