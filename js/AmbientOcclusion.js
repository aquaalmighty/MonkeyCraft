// AmbientOcclusion.js - Calculates ambient occlusion for block vertices

export class AmbientOcclusion {
    constructor(worldEngine) {
        this.worldEngine = worldEngine;
    }

    /**
     * Check if a block is solid (not transparent)
     */
    isSolid(x, y, z) {
        const block = this.worldEngine.getWorldBlock(x, y, z);
        // AIR and SAPLING are transparent
        return block !== 0 && block !== 11; // 0 = AIR, 11 = SAPLING
    }

    /**
     * Calculate vertex AO for a corner of a face
     * @param {number} side1 - First adjacent block (true if solid)
     * @param {number} side2 - Second adjacent block (true if solid)
     * @param {number} corner - Diagonal corner block (true if solid)
     * @returns {number} AO value from 0 (darkest) to 3 (brightest)
     */
    vertexAO(side1, side2, corner) {
        if (side1 && side2) {
            return 0; // Darkest - both sides blocked
        }
        return 3 - (side1 + side2 + corner); // 3=brightest, 0=darkest
    }

    /**
     * Get AO values for all 4 corners of a block face
     * Returns [topLeft, topRight, bottomRight, bottomLeft] AO values
     *
     * This logic is now a direct translation of the C++ example's
     * face_normal and ao_offset arrays.
     */
    getFaceAO(x, y, z, face) {
        let corners;
        let s = (x, y, z) => this.isSolid(x, y, z);

        switch(face) {
            case '+y': // Top face
                corners = [
                    // Top-left (v3 in C++)
                    this.vertexAO(s(x, y+1, z+1), s(x-1, y+1, z), s(x-1, y+1, z+1)),
                    // Top-right (v2 in C++)
                    this.vertexAO(s(x+1, y+1, z), s(x, y+1, z+1), s(x+1, y+1, z+1)),
                    // Bottom-right (v1 in C++)
                    this.vertexAO(s(x, y+1, z-1), s(x+1, y+1, z), s(x+1, y+1, z-1)),
                    // Bottom-left (v0 in C++)
                    this.vertexAO(s(x-1, y+1, z), s(x, y+1, z-1), s(x-1, y+1, z-1))
                ];
                break;

            case '-y': // Bottom face
                corners = [
                    // Top-left (v3 in C++)
                    this.vertexAO(s(x-1, y-1, z), s(x, y-1, z+1), s(x-1, y-1, z+1)),
                    // Top-right (v2 in C++)
                    this.vertexAO(s(x, y-1, z+1), s(x+1, y-1, z), s(x+1, y-1, z+1)),
                    // Bottom-right (v1 in C++)
                    this.vertexAO(s(x+1, y-1, z), s(x, y-1, z-1), s(x+1, y-1, z-1)),
                    // Bottom-left (v0 in C++)
                    this.vertexAO(s(x, y-1, z-1), s(x-1, y-1, z), s(x-1, y-1, z-1))
                ];
                break;

            case '+x': // Right face
                corners = [
                    // Top-left (v3 in C++)
                    this.vertexAO(s(x+1, y+1, z), s(x+1, y, z-1), s(x+1, y+1, z-1)),
                    // Top-right (v2 in C++)
                    this.vertexAO(s(x+1, y, z+1), s(x+1, y+1, z), s(x+1, y+1, z+1)),
                    // Bottom-right (v1 in C++)
                    this.vertexAO(s(x+1, y-1, z), s(x+1, y, z+1), s(x+1, y-1, z+1)),
                    // Bottom-left (v0 in C++)
                    this.vertexAO(s(x+1, y, z-1), s(x+1, y-1, z), s(x+1, y-1, z-1))
                ];
                break;

            case '-x': // Left face
                corners = [
                    // Top-left (v3 in C++)
                    this.vertexAO(s(x-1, y+1, z), s(x-1, y, z+1), s(x-1, y+1, z+1)),
                    // Top-right (v2 in C++)
                    this.vertexAO(s(x-1, y, z-1), s(x-1, y+1, z), s(x-1, y+1, z-1)),
                    // Bottom-right (v1 in C++)
                    this.vertexAO(s(x-1, y-1, z), s(x-1, y, z-1), s(x-1, y-1, z-1)),
                    // Bottom-left (v0 in C++)
                    this.vertexAO(s(x-1, y, z+1), s(x-1, y-1, z), s(x-1, y-1, z+1))
                ];
                break;

            case '+z': // Front face (C++ Back Face)
                corners = [
                    // Top-left (v3 in C++)
                    this.vertexAO(s(x, y+1, z+1), s(x+1, y, z+1), s(x+1, y+1, z+1)),
                    // Top-right (v2 in C++)
                    this.vertexAO(s(x-1, y, z+1), s(x, y+1, z+1), s(x-1, y+1, z+1)),
                    // Bottom-right (v1 in C++)
                    this.vertexAO(s(x, y-1, z+1), s(x-1, y, z+1), s(x-1, y-1, z+1)),
                    // Bottom-left (v0 in C++)
                    this.vertexAO(s(x+1, y, z+1), s(x, y-1, z+1), s(x+1, y-1, z+1))
                ];
                break;

            case '-z': // Back face (C++ Front Face)
                corners = [
                    // Top-left (v3 in C++)
                    this.vertexAO(s(x, y+1, z-1), s(x-1, y, z-1), s(x-1, y+1, z-1)),
                    // Top-right (v2 in C++)
                    this.vertexAO(s(x+1, y, z-1), s(x, y+1, z-1), s(x+1, y+1, z-1)),
                    // Bottom-right (v1 in C++)
                    this.vertexAO(s(x, y-1, z-1), s(x+1, y, z-1), s(x+1, y-1, z-1)),
                    // Bottom-left (v0 in C++)
                    this.vertexAO(s(x-1, y, z-1), s(x, y-1, z-1), s(x-1, y-1, z-1))
                ];
                break;
        }

        return corners;
    }

    /**
     * Convert AO value to brightness multiplier
     * @param {number} ao - AO value from 0-3
     * @returns {number} Brightness from 0.4 to 1.0
     */
    aoToBrightness(ao) {
        // Map AO values: 0=0.4, 1=0.6, 2=0.8, 3=1.0
        // The C++ shader's get_ao function does the same, mapping 0-3 to 1.0-0.35
        return 0.4 + (ao / 3) * 0.6;
    }
}