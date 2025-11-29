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
     * @param {number} side1 - First adjacent block
     * @param {number} side2 - Second adjacent block  
     * @param {number} corner - Diagonal corner block
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
     */
    getFaceAO(x, y, z, face) {
        let corners;

        switch(face) {
            case '+y': // Top face (Correct in original)
                corners = [
                    // Top-left corner
                    this.vertexAO(
                        this.isSolid(x-1, y+1, z),   // left
                        this.isSolid(x, y+1, z+1),   // back
                        this.isSolid(x-1, y+1, z+1)  // diagonal
                    ),
                    // Top-right corner
                    this.vertexAO(
                        this.isSolid(x+1, y+1, z),   // right
                        this.isSolid(x, y+1, z+1),   // back
                        this.isSolid(x+1, y+1, z+1)  // diagonal
                    ),
                    // Bottom-right corner
                    this.vertexAO(
                        this.isSolid(x+1, y+1, z),   // right
                        this.isSolid(x, y+1, z-1),   // front
                        this.isSolid(x+1, y+1, z-1)  // diagonal
                    ),
                    // Bottom-left corner
                    this.vertexAO(
                        this.isSolid(x-1, y+1, z),   // left
                        this.isSolid(x, y+1, z-1),   // front
                        this.isSolid(x-1, y+1, z-1)  // diagonal
                    )
                ];
                break;

            case '-y': // Bottom face (Correct in original)
                corners = [
                    this.vertexAO(
                        this.isSolid(x-1, y-1, z),
                        this.isSolid(x, y-1, z-1),
                        this.isSolid(x-1, y-1, z-1)
                    ),
                    this.vertexAO(
                        this.isSolid(x+1, y-1, z),
                        this.isSolid(x, y-1, z-1),
                        this.isSolid(x+1, y-1, z-1)
                    ),
                    this.vertexAO(
                        this.isSolid(x+1, y-1, z),
                        this.isSolid(x, y-1, z+1),
                        this.isSolid(x+1, y-1, z+1)
                    ),
                    this.vertexAO(
                        this.isSolid(x-1, y-1, z),
                        this.isSolid(x, y-1, z+1),
                        this.isSolid(x-1, y-1, z+1)
                    )
                ];
                break;

            case '+x': // Right face (Corrected)
                corners = [
                    this.vertexAO(
                        this.isSolid(x, y+1, z), // adjacent top
                        this.isSolid(x, y, z+1), // adjacent front
                        this.isSolid(x, y+1, z+1) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y+1, z), // adjacent top
                        this.isSolid(x, y, z-1), // adjacent back
                        this.isSolid(x, y+1, z-1) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y-1, z), // adjacent bottom
                        this.isSolid(x, y, z-1), // adjacent back
                        this.isSolid(x, y-1, z-1) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y-1, z), // adjacent bottom
                        this.isSolid(x, y, z+1), // adjacent front
                        this.isSolid(x, y-1, z+1) // diagonal
                    )
                ];
                break;

            case '-x': // Left face (Corrected)
                corners = [
                    this.vertexAO(
                        this.isSolid(x, y+1, z), // adjacent top
                        this.isSolid(x, y, z-1), // adjacent back
                        this.isSolid(x, y+1, z-1) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y+1, z), // adjacent top
                        this.isSolid(x, y, z+1), // adjacent front
                        this.isSolid(x, y+1, z+1) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y-1, z), // adjacent bottom
                        this.isSolid(x, y, z+1), // adjacent front
                        this.isSolid(x, y-1, z+1) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y-1, z), // adjacent bottom
                        this.isSolid(x, y, z-1), // adjacent back
                        this.isSolid(x, y-1, z-1) // diagonal
                    )
                ];
                break;

            case '+z': // Front face (Corrected)
                                corners = [
                    this.vertexAO(
                        this.isSolid(x, y+1, z), // adjacent top
                        this.isSolid(x-1, y, z), // adjacent left
                        this.isSolid(x-1, y+1, z) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y+1, z), // adjacent top
                        this.isSolid(x+1, y, z), // adjacent right
                        this.isSolid(x+1, y+1, z) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y-1, z), // adjacent bottom
                        this.isSolid(x+1, y, z), // adjacent right
                        this.isSolid(x+1, y-1, z) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y-1, z), // adjacent bottom
                        this.isSolid(x-1, y, z), // adjacent left
                        this.isSolid(x-1, y-1, z) // diagonal
                    )
                ];
                break;

            case '-z': // Back face (Corrected)
                corners = [
                    this.vertexAO(
                        this.isSolid(x, y+1, z), // adjacent top
                        this.isSolid(x+1, y, z), // adjacent right
                        this.isSolid(x+1, y+1, z) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y+1, z), // adjacent top
                        this.isSolid(x-1, y, z), // adjacent left
                        this.isSolid(x-1, y+1, z) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y-1, z), // adjacent bottom
                        this.isSolid(x-1, y, z), // adjacent left
                        this.isSolid(x-1, y-1, z) // diagonal
                    ),
                    this.vertexAO(
                        this.isSolid(x, y-1, z), // adjacent bottom
                        this.isSolid(x+1, y, z), // adjacent right
                        this.isSolid(x+1, y-1, z) // diagonal
                    )
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
        return 0.4 + (ao / 3) * 0.6;
    }
}