// LightingEngine.js - Optimized lighting with toggles

import { CHUNK_SIZE, WORLD_HEIGHT, BLOCKS } from './GameConstants.js';

export class LightingEngine {
    constructor(worldEngine) {
        this.worldEngine = worldEngine;
        this.enabled = false; // Toggle for lighting
        
        this.lightData = new Map();
        
        // Word-level parallelism masks
        this.COMPONENT_MASK = 0x0f0f0f0f;
        this.BORROW_GUARD = 0x20202020;
        this.CARRY_MASK = 0x10101010;
        
        // Light propagation queue
        this.lightQueue = [];
        this.removalQueue = [];
        
        // Performance optimization - MUCH stricter limits
        this.maxIterationsPerFrame = 100; // Reduced from 500
        this.updateThrottle = 0;
        this.throttleDelay = 0.1; // Only update lighting every 100ms
        
        // Sun tracking
        this.sunAngle = 0;
        this.sunColor = { r: 1, g: 1, b: 1 };
        
        // Cache for frequently accessed light values
        this.lightCache = new Map();
        this.cacheSize = 1000;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        
        if (!enabled) {
            // Clear queues when disabled
            this.lightQueue = [];
            this.removalQueue = [];
        }
    }

    getChunkLightData(cx, cz) {
        if (!this.enabled) return null;
        
        const key = `${cx},${cz}`;
        if (!this.lightData.has(key)) {
            const size = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;
            this.lightData.set(key, new Uint32Array(size));
        }
        return this.lightData.get(key);
    }

    getLightAt(x, y, z) {
        if (!this.enabled) return 0;
        if (y < 0 || y >= WORLD_HEIGHT) return 0;
        
        // Check cache first
        const cacheKey = `${x},${y},${z}`;
        if (this.lightCache.has(cacheKey)) {
            return this.lightCache.get(cacheKey);
        }
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const lightData = this.getChunkLightData(cx, cz);
        if (!lightData) return 0;
        
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
        
        const value = lightData[idx];
        
        // Add to cache
        this.lightCache.set(cacheKey, value);
        if (this.lightCache.size > this.cacheSize) {
            // Remove oldest entry
            const firstKey = this.lightCache.keys().next().value;
            this.lightCache.delete(firstKey);
        }
        
        return value;
    }

    setLightAt(x, y, z, value) {
        if (!this.enabled) return;
        if (y < 0 || y >= WORLD_HEIGHT) return;
        
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const lightData = this.getChunkLightData(cx, cz);
        if (!lightData) return;
        
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
        
        lightData[idx] = value;
        
        // Invalidate cache
        const cacheKey = `${x},${y},${z}`;
        this.lightCache.delete(cacheKey);
    }

    // Word-level parallelism operations
    wlpHalfLT(a, b) {
        const d = (((a & this.COMPONENT_MASK) | this.BORROW_GUARD) - 
                   (b & this.COMPONENT_MASK)) & this.CARRY_MASK;
        return (d >>> 1) | (d >>> 2) | (d >>> 3) | (d >>> 4);
    }

    wlpLT(a, b) {
        return this.wlpHalfLT(a, b) | (this.wlpHalfLT(a >>> 4, b >>> 4) << 4);
    }

    wlpMax(a, b) {
        return a ^ ((a ^ b) & this.wlpLT(a, b));
    }

    wlpDecHalf(x) {
        const d = ((x & 0x0f0f0f0f) | 0x20202020) - 0x01010101;
        const b = d & 0x10101010;
        return (d + (b >>> 4)) & 0x0f0f0f0f;
    }

    wlpDec(x) {
        return this.wlpDecHalf(x) | (this.wlpDecHalf(x >>> 4) << 4);
    }

    packLight(r, g, b, skyY, skyNX, skyPX, skyD1, skyD2) {
        return (r & 0xF) | 
               ((g & 0xF) << 4) | 
               ((b & 0xF) << 8) |
               ((skyY & 0xF) << 12) |
               ((skyNX & 0xF) << 16) |
               ((skyPX & 0xF) << 20) |
               ((skyD1 & 0xF) << 24) |
               ((skyD2 & 0xF) << 28);
    }

    unpackLight(light) {
        return {
            r: light & 0xF,
            g: (light >>> 4) & 0xF,
            b: (light >>> 8) & 0xF,
            skyY: (light >>> 12) & 0xF,
            skyNX: (light >>> 16) & 0xF,
            skyPX: (light >>> 20) & 0xF,
            skyD1: (light >>> 24) & 0xF,
            skyD2: (light >>> 28) & 0xF
        };
    }

    isOpaque(x, y, z) {
        const block = this.worldEngine.getWorldBlock(x, y, z);
        return block !== BLOCKS.AIR && block !== BLOCKS.SAPLING && block !== BLOCKS.LEAVES;
    }

    initializeLighting() {
        if (!this.enabled) return;
        
        console.log('Initializing lighting (this may take a moment)...');
        
        // Only trace sky columns, don't propagate yet
        for (let [key, chunk] of Object.entries(this.worldEngine.chunks)) {
            const { cx, cz } = chunk;
            
            for (let x = 0; x < CHUNK_SIZE; x++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const wx = cx * CHUNK_SIZE + x;
                    const wz = cz * CHUNK_SIZE + z;
                    
                    this.traceSkyColumnSimple(wx, wz);
                }
            }
        }
        
        console.log('Lighting initialization complete (propagation will happen gradually)');
    }

    // Simplified sky tracing - just set to max light, no propagation
    traceSkyColumnSimple(wx, wz) {
        const maxLight = 15;
        
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            if (this.isOpaque(wx, y, wz)) {
                break;
            }
            
            const light = this.packLight(0, 0, 0, maxLight, maxLight, maxLight, maxLight, maxLight);
            this.setLightAt(wx, y, wz, light);
        }
    }

    // Update lighting system (throttled, called each frame)
    updateLighting(dt) {
        if (!this.enabled) return;
        
        this.updateThrottle += dt;
        if (this.updateThrottle < this.throttleDelay) {
            return; // Skip this frame
        }
        this.updateThrottle = 0;
        
        if (this.lightQueue.length === 0 && this.removalQueue.length === 0) {
            return;
        }
        
        const directions = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1]
        ];
        
        let iterations = 0;
        
        // Process removal queue first
        while (this.removalQueue.length > 0 && iterations < this.maxIterationsPerFrame) {
            iterations++;
            const node = this.removalQueue.shift();
            const { x, y, z, light } = node;
            
            for (const [dx, dy, dz] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                const nz = z + dz;
                
                if (ny < 0 || ny >= WORLD_HEIGHT) continue;
                
                const neighborLight = this.getLightAt(nx, ny, nz);
                if (neighborLight === 0) continue;
                
                if (this.wlpLT(neighborLight, light) !== 0) {
                    this.setLightAt(nx, ny, nz, 0);
                    this.removalQueue.push({ x: nx, y: ny, z: nz, light: neighborLight });
                } else if (neighborLight !== 0) {
                    this.lightQueue.push({ x: nx, y: ny, z: nz, light: neighborLight });
                }
            }
        }
        
        // Process light queue
        while (this.lightQueue.length > 0 && iterations < this.maxIterationsPerFrame) {
            iterations++;
            const node = this.lightQueue.shift();
            const { x, y, z, light } = node;
            
            for (const [dx, dy, dz] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                const nz = z + dz;
                
                if (ny < 0 || ny >= WORLD_HEIGHT) continue;
                if (this.isOpaque(nx, ny, nz)) continue;
                
                const neighborLight = this.getLightAt(nx, ny, nz);
                const decremented = this.wlpDec(light);
                const newLight = this.wlpMax(neighborLight, decremented);
                
                if (newLight !== neighborLight) {
                    this.setLightAt(nx, ny, nz, newLight);
                    this.lightQueue.push({ x: nx, y: ny, z: nz, light: newLight });
                }
            }
        }
    }

    // Simplified torch light - just set locally
    addTorchLight(x, y, z) {
        if (!this.enabled) return;
        
        const torchLight = this.packLight(15, 15, 12, 0, 0, 0, 0, 0);
        this.setLightAt(x, y, z, torchLight);
        
        // Don't propagate immediately, let updateLighting handle it gradually
        this.lightQueue.push({ x, y, z, light: torchLight });
    }

    // Simplified light removal
    removeLight(x, y, z) {
        if (!this.enabled) return;
        
        const light = this.getLightAt(x, y, z);
        if (light === 0) return;
        
        this.setLightAt(x, y, z, 0);
        
        // Just retrace the column, don't queue removal
        this.traceSkyColumnSimple(x, z);
    }

    getBrightnessAt(x, y, z) {
        if (!this.enabled) return 0.15; // Default brightness when disabled - very dark
        
        const light = this.getLightAt(x, y, z);
        if (light === 0) return 0.15; // Unlit areas are very dark
        
        const unpacked = this.unpackLight(light);
        
        const sunY = Math.sin(this.sunAngle);
        const sunX = Math.cos(this.sunAngle);
        
        let skyContribution = unpacked.skyY * Math.max(0, sunY) * 0.7;
        skyContribution += unpacked.skyPX * Math.max(0, sunX) * 0.55;
        skyContribution += unpacked.skyNX * Math.max(0, -sunX) * 0.55;
        
        const d1Weight = Math.max(0, (sunX + sunY) * 0.707) * 0.4;
        const d2Weight = Math.max(0, (sunX - sunY) * 0.707) * 0.4;
        skyContribution += unpacked.skyD1 * d1Weight;
        skyContribution += unpacked.skyD2 * d2Weight;
        
        const blockLight = Math.max(unpacked.r, unpacked.g, unpacked.b) / 15;
        
        // Much darker shadows (min 0.1), much brighter highlights (max 1.0)
        return Math.max(0.1, Math.min(1.0, blockLight * 2.0 + skyContribution / 8));
    }

    // Clear all lighting data (for memory management)
    clear() {
        this.lightData.clear();
        this.lightCache.clear();
        this.lightQueue = [];
        this.removalQueue = [];
    }
}