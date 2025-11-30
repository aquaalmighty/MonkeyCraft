// AmbientOcclusion.js - Calculates ambient occlusion for block vertices

export class AmbientOcclusion {
    constructor(worldEngine) {
        this.worldEngine = worldEngine;
        this.enabled = true; // Toggle for AO
    }

    setEnabled(enabled) {
        this.enabled = enabled;
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
     */
    vertexAO(side1, side2, corner) {
        if (!this.enabled) return 3; // No AO when disabled, return brightest
        
        if (side1 && side2) {
            return 0; // Darkest - both sides blocked
        }
        return 3 - (side1 + side2 + corner); // 3=brightest, 0=darkest
    }

    /**
     * Get AO values for all 4 corners of a block face
     */
    getFaceAO(x, y, z, face) {
        if (!this.enabled) return [3, 3, 3, 3]; // No AO when disabled
        
        let corners;
        let s = (x, y, z) => this.isSolid(x, y, z);

        switch(face) {
            case '+y': // Top face
                corners = [
                    this.vertexAO(s(x, y+1, z+1), s(x-1, y+1, z), s(x-1, y+1, z+1)),
                    this.vertexAO(s(x+1, y+1, z), s(x, y+1, z+1), s(x+1, y+1, z+1)),
                    this.vertexAO(s(x, y+1, z-1), s(x+1, y+1, z), s(x+1, y+1, z-1)),
                    this.vertexAO(s(x-1, y+1, z), s(x, y+1, z-1), s(x-1, y+1, z-1))
                ];
                break;

            case '-y': // Bottom face
                corners = [
                    this.vertexAO(s(x-1, y-1, z), s(x, y-1, z+1), s(x-1, y-1, z+1)),
                    this.vertexAO(s(x, y-1, z+1), s(x+1, y-1, z), s(x+1, y-1, z+1)),
                    this.vertexAO(s(x+1, y-1, z), s(x, y-1, z-1), s(x+1, y-1, z-1)),
                    this.vertexAO(s(x, y-1, z-1), s(x-1, y-1, z), s(x-1, y-1, z-1))
                ];
                break;

            case '+x': // Right face
                corners = [
                    this.vertexAO(s(x+1, y+1, z), s(x+1, y, z-1), s(x+1, y+1, z-1)),
                    this.vertexAO(s(x+1, y, z+1), s(x+1, y+1, z), s(x+1, y+1, z+1)),
                    this.vertexAO(s(x+1, y-1, z), s(x+1, y, z+1), s(x+1, y-1, z+1)),
                    this.vertexAO(s(x+1, y, z-1), s(x+1, y-1, z), s(x+1, y-1, z-1))
                ];
                break;

            case '-x': // Left face
                corners = [
                    this.vertexAO(s(x-1, y+1, z), s(x-1, y, z+1), s(x-1, y+1, z+1)),
                    this.vertexAO(s(x-1, y, z-1), s(x-1, y+1, z), s(x-1, y+1, z-1)),
                    this.vertexAO(s(x-1, y-1, z), s(x-1, y, z-1), s(x-1, y-1, z-1)),
                    this.vertexAO(s(x-1, y, z+1), s(x-1, y-1, z), s(x-1, y-1, z+1))
                ];
                break;

            case '+z': // Front face
                corners = [
                    this.vertexAO(s(x, y+1, z+1), s(x+1, y, z+1), s(x+1, y+1, z+1)),
                    this.vertexAO(s(x-1, y, z+1), s(x, y+1, z+1), s(x-1, y+1, z+1)),
                    this.vertexAO(s(x, y-1, z+1), s(x-1, y, z+1), s(x-1, y-1, z+1)),
                    this.vertexAO(s(x+1, y, z+1), s(x, y-1, z+1), s(x+1, y-1, z+1))
                ];
                break;

            case '-z': // Back face
                corners = [
                    this.vertexAO(s(x, y+1, z-1), s(x-1, y, z-1), s(x-1, y+1, z-1)),
                    this.vertexAO(s(x+1, y, z-1), s(x, y+1, z-1), s(x+1, y+1, z-1)),
                    this.vertexAO(s(x, y-1, z-1), s(x+1, y, z-1), s(x+1, y-1, z-1)),
                    this.vertexAO(s(x-1, y, z-1), s(x, y-1, z-1), s(x-1, y-1, z-1))
                ];
                break;
        }

        return corners;
    }

    /**
     * Convert AO value to brightness multiplier
     */
    aoToBrightness(ao) {
        if (!this.enabled) return 1.0;
        return 0.2 + (ao / 3) * 0.8; // darker shadows
    }

}