// ShadowBaker.js - Baked shadow system using lightmaps

import { CHUNK_SIZE, WORLD_HEIGHT, BLOCKS } from './GameConstants.js';

export class ShadowBaker {
    constructor(worldEngine, dayNightCycle) {
        this.worldEngine = worldEngine;
        this.dayNightCycle = dayNightCycle;
        this.enabled = true;
        
        // Store lightmaps per chunk
        this.chunkLightmaps = new Map();
        
        // Shadow configuration
        this.shadowResolution = 32; // Resolution of shadow rays per chunk
        this.shadowSoftness = 0.2; // How soft/blurred shadows are
        this.minShadowBrightness = 0.2; // Minimum brightness in full shadow
        this.maxShadowBrightness = 1.0; // Maximum brightness in full light
        
        // Cache for shadow calculations
        this.shadowCache = new Map();
        this.maxCacheSize = 5000;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.chunkLightmaps.clear();
            this.shadowCache.clear();
        }
    }

    // Get the sun direction based on time of day
    getSunDirection() {
        if (!this.dayNightCycle) {
            return new THREE.Vector3(0.5, 1, 0.5).normalize();
        }
        
        const sunAngle = this.dayNightCycle.getSunAngle();
        const sunY = Math.sin(sunAngle);
        const sunX = Math.cos(sunAngle);
        
        return new THREE.Vector3(sunX, sunY, 0).normalize();
    }

    // Check if a block is opaque (blocks light)
    isOpaque(x, y, z) {
        const block = this.worldEngine.getWorldBlock(x, y, z);
        return block !== BLOCKS.AIR && 
               block !== BLOCKS.SAPLING && 
               block !== BLOCKS.LEAVES; // Leaves are semi-transparent
    }

    // Cast a ray from a position towards the sun to check for shadows
    castShadowRay(x, y, z, sunDir) {
        if (!this.enabled) return 1.0;
        
        // Check cache first
        const cacheKey = `${x},${y},${z},${Math.floor(sunDir.x * 100)},${Math.floor(sunDir.y * 100)}`;
        if (this.shadowCache.has(cacheKey)) {
            return this.shadowCache.get(cacheKey);
        }
        
        // Don't cast shadows if sun is below horizon
        if (sunDir.y <= 0) {
            this.addToCache(cacheKey, 0.3);
            return 0.3;
        }
        
        const maxDistance = 50; // Maximum distance to trace
        const stepSize = 0.5; // Step size for ray marching
        
        let currentPos = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
        let distance = 0;
        let shadowStrength = 1.0;
        
        // Ray march towards the sun
        while (distance < maxDistance) {
            currentPos.addScaledVector(sunDir, stepSize);
            distance += stepSize;
            
            // Check if we're out of world bounds
            const checkY = Math.floor(currentPos.y);
            if (checkY >= WORLD_HEIGHT || checkY < 0) {
                break;
            }
            
            const checkX = Math.floor(currentPos.x);
            const checkZ = Math.floor(currentPos.z);
            
            // If we hit an opaque block, we're in shadow
            if (this.isOpaque(checkX, checkY, checkZ)) {
                // Calculate shadow strength based on distance
                const distanceFactor = Math.min(1, distance / 10);
                shadowStrength = this.shadowSoftness + (1 - this.shadowSoftness) * distanceFactor;
                break;
            }
            
            // Check for leaves (partial shadow)
            const block = this.worldEngine.getWorldBlock(checkX, checkY, checkZ);
            if (block === BLOCKS.LEAVES) {
                shadowStrength *= 0.7; // Leaves reduce light by 30%
            }
        }
        
        // Cache the result
        this.addToCache(cacheKey, shadowStrength);
        
        return shadowStrength;
    }

    // Add to cache with size limit
    addToCache(key, value) {
        if (this.shadowCache.size >= this.maxCacheSize) {
            const firstKey = this.shadowCache.keys().next().value;
            this.shadowCache.delete(firstKey);
        }
        this.shadowCache.set(key, value);
    }

    // Bake shadows for a specific chunk
    bakeChunkShadows(cx, cz) {
        if (!this.enabled) return null;
        
        const sunDir = this.getSunDirection();
        const chunkKey = `${cx},${cz}`;
        
        // Create lightmap data for the chunk
        const lightmapSize = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
        const lightmap = new Float32Array(lightmapSize);
        
        const startX = cx * CHUNK_SIZE;
        const startZ = cz * CHUNK_SIZE;
        
        // Bake shadows for each block in the chunk
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    const wx = startX + x;
                    const wz = startZ + z;
                    
                    const block = this.worldEngine.getWorldBlock(wx, y, wz);
                    
                    // Only calculate shadows for non-air blocks
                    if (block !== BLOCKS.AIR && block !== BLOCKS.SAPLING) {
                        const shadowValue = this.castShadowRay(wx, y, wz, sunDir);
                        const idx = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
                        lightmap[idx] = shadowValue;
                    } else {
                        const idx = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
                        lightmap[idx] = 1.0; // Air blocks are fully lit
                    }
                }
            }
        }
        
        this.chunkLightmaps.set(chunkKey, lightmap);
        return lightmap;
    }

    // Bake shadows for a chunk and its neighbors
    bakeChunkWithNeighbors(cx, cz) {
        if (!this.enabled) return;
        
        // Bake the main chunk
        this.bakeChunkShadows(cx, cz);
        
        // Bake neighboring chunks that might be affected
        const neighbors = [
            [cx - 1, cz], [cx + 1, cz],
            [cx, cz - 1], [cx, cz + 1],
            [cx - 1, cz - 1], [cx - 1, cz + 1],
            [cx + 1, cz - 1], [cx + 1, cz + 1]
        ];
        
        for (const [nx, nz] of neighbors) {
            const neighborChunk = this.worldEngine.chunks[`${nx},${nz}`];
            if (neighborChunk) {
                this.bakeChunkShadows(nx, nz);
            }
        }
    }

    // Get shadow brightness at a specific world position
    getShadowBrightness(x, y, z) {
        if (!this.enabled) return 1.0;
        if (y < 0 || y >= WORLD_HEIGHT) return 1.0;
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const chunkKey = `${cx},${cz}`;
        
        const lightmap = this.chunkLightmaps.get(chunkKey);
        if (!lightmap) return 0.8; // Default brightness if no lightmap
        
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
        
        const shadowValue = lightmap[idx];
        
        // Map shadow value to brightness range
        return this.minShadowBrightness + 
               (shadowValue * (this.maxShadowBrightness - this.minShadowBrightness));
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

    // Update shadows based on time of day (can be called periodically)
    updateShadows() {
        if (!this.enabled) return;
        
        // Clear cache when sun position changes significantly
        this.shadowCache.clear();
        
        // Re-bake all chunks with new sun position
        this.bakeAllChunks();
    }

    // Check if shadows need updating based on sun position
    shouldUpdateShadows(lastSunAngle) {
        if (!this.dayNightCycle) return false;
        
        const currentSunAngle = this.dayNightCycle.getSunAngle();
        const angleDiff = Math.abs(currentSunAngle - lastSunAngle);
        
        // Update if sun has moved more than ~5 degrees (0.087 radians)
        return angleDiff > 0.087;
    }

    // Clear all shadow data
    clear() {
        this.chunkLightmaps.clear();
        this.shadowCache.clear();
    }
}