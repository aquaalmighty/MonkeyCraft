// ShadowBaker.js - Efficient top-down raycast shadow system

import { CHUNK_SIZE, WORLD_HEIGHT, BLOCKS } from './GameConstants.js';

export class ShadowBaker {
    constructor(worldEngine, dayNightCycle) {
        this.worldEngine = worldEngine;
        this.dayNightCycle = dayNightCycle;
        this.enabled = true;
        
        // Store shadow values per chunk
        this.chunkShadowmaps = new Map();
        
        // Shadow configuration
        this.maxSkyLight = 15; // Maximum light level from sky
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.chunkShadowmaps.clear();
        }
    }

    // Check if a block is opaque (blocks light)
    isOpaque(x, y, z) {
        const block = this.worldEngine.getWorldBlock(x, y, z);
        return block !== BLOCKS.AIR && block !== BLOCKS.SAPLING;
    }

    // Cast a single ray straight down from sky to calculate light for entire column
    calculateShadowColumn(x, z) {
        const lightValues = new Array(WORLD_HEIGHT).fill(0);
        
        // Start from top and cast ray downward
        let currentLight = this.maxSkyLight; // Start with max sky light
        
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            const block = this.worldEngine.getWorldBlock(x, y, z);
            
            if (block === BLOCKS.AIR || block === BLOCKS.SAPLING) {
                // Air blocks receive the current light level
                lightValues[y] = currentLight;
            } else if (block === BLOCKS.LEAVES) {
                // Leaves reduce light but don't block it completely
                lightValues[y] = currentLight; // Top of leaves gets current light
                currentLight = Math.max(0, currentLight - 2); // Reduce light by 2 levels
            } else {
                // Solid block - this is the last block that gets light
                lightValues[y] = currentLight;
                currentLight = 0; // Everything below is dark
            }
        }
        
        return lightValues;
    }

    // Convert light level (0-15) to brightness (0.0-1.0)
    lightToBrightness(lightLevel) {
        // INCREASED minimum brightness from 0.05 to 0.25 so it's never pitch black
        if (lightLevel <= 0) return 0.25; // Minimum ambient light (never pitch black)
        if (lightLevel >= this.maxSkyLight) return 1.0; // Full brightness
        
        // Non-linear brightness curve (similar to Minecraft)
        // This makes shadows more dramatic at low light levels
        const normalized = lightLevel / this.maxSkyLight;
        return 0.25 + (Math.pow(normalized, 1.5) * 0.75);
    }

    // Bake shadows for a specific chunk
    bakeChunkShadows(cx, cz) {
        if (!this.enabled) return null;
        
        const chunkKey = `${cx},${cz}`;
        const shadowmapSize = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
        const shadowmap = new Uint8Array(shadowmapSize); // Use Uint8Array for efficiency
        
        const startX = cx * CHUNK_SIZE;
        const startZ = cz * CHUNK_SIZE;
        
        // Calculate shadows column by column
        for (let z = 0; z < CHUNK_SIZE; z++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const wx = startX + x;
                const wz = startZ + z;
                
                const columnLights = this.calculateShadowColumn(wx, wz);
                
                // Store in shadowmap
                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    const idx = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
                    shadowmap[idx] = columnLights[y];
                }
            }
        }
        
        this.chunkShadowmaps.set(chunkKey, shadowmap);
        return shadowmap;
    }

    // Get shadow brightness at a specific world position
    getShadowBrightness(x, y, z) {
        if (!this.enabled) return 1.0;
        if (y < 0 || y >= WORLD_HEIGHT) return 0.05;
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunkKey = `${cx},${cz}`;
        
        const shadowmap = this.chunkShadowmaps.get(chunkKey);
        if (!shadowmap) return 0.5;
        
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
        
        const lightLevel = shadowmap[idx];
        return this.lightToBrightness(lightLevel);
    }

    // Bake all chunks in the world
    bakeAllChunks() {
        if (!this.enabled) return;
        
        console.log('Baking shadows for all chunks...');
        const startTime = performance.now();
        
        for (const chunkKey in this.worldEngine.chunks) {
            const chunk = this.worldEngine.chunks[chunkKey];
            this.bakeChunkShadows(chunk.cx, chunk.cz);
        }
        
        const endTime = performance.now();
        console.log(`Shadow baking complete in ${(endTime - startTime).toFixed(2)}ms`);
    }

    // Update a column and its 8 neighbors when a block changes
    updateBlockColumn(x, z) {
        if (!this.enabled) return;
        
        // Update the center column
        this.updateSingleColumn(x, z);
        
        // Update the 8 neighboring columns to propagate light changes
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dz === 0) continue; // Skip center (already updated)
                this.updateSingleColumn(x + dx, z + dz);
            }
        }
    }

    // Update a single column's shadowmap
    updateSingleColumn(x, z) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunkKey = `${cx},${cz}`;
        
        const shadowmap = this.chunkShadowmaps.get(chunkKey);
        if (!shadowmap) {
            // If chunk doesn't have a shadowmap, bake it
            this.bakeChunkShadows(cx, cz);
            return;
        }
        
        // Recalculate just this column
        const columnLights = this.calculateShadowColumn(x, z);
        
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        
        // Update shadowmap for this column
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
            shadowmap[idx] = columnLights[y];
        }
    }

    // Update shadows based on time of day (not needed for top-down)
    updateShadows() {
        // Not needed for vertical raycast approach
    }

    // Check if shadows need updating (not needed for top-down)
    shouldUpdateShadows(lastSunAngle) {
        return false;
    }

    // Clear all shadow data
    clear() {
        this.chunkShadowmaps.clear();
    }
}