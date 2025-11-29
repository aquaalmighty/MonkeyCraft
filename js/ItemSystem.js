// ItemSystem.js - Manages dropped items in the world

import { BLOCKS, BLOCK_COLORS, GRAVITY } from './GameConstants.js';

export class ItemSystem {
    constructor(scene, worldEngine) {
        this.scene = scene;
        this.worldEngine = worldEngine;
        this.droppedItems = [];
    }

    createDroppedItem(blockId, pos) {
        const itemColor = BLOCK_COLORS[blockId] || '#FF00FF';
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            this.worldEngine.createDroppedItemMaterial(itemColor)
        );
        
        const spawnPos = pos.clone().add(new THREE.Vector3(0, 0.35, 0));
        mesh.position.copy(spawnPos);
        
        const item = {
            id: Math.random().toString(36).substring(2),
            blockId: blockId,
            mesh: mesh,
            vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 3, (Math.random() - 0.5) * 1.5),
            time: 0,
            baseY: null,
            spawnY: spawnPos.y,
            spawnX: spawnPos.x,
            spawnZ: spawnPos.z,
            maxHeight: spawnPos.y + 0.8
        };
        
        this.scene.add(mesh);
        this.droppedItems.push(item);
    }

    update(dt) {
        for (let i = this.droppedItems.length - 1; i >= 0; i--) {
            const item = this.droppedItems[i];
            item.time += dt * 3;
            item.mesh.rotation.y += dt;
            
            if (item.baseY === null) {
                item.vel.y -= GRAVITY * dt;
                
                const dx = item.mesh.position.x - item.spawnX;
                const dz = item.mesh.position.z - item.spawnZ;
                const maxHorizontalDist = 0.4;
                
                if (Math.abs(dx) > maxHorizontalDist || Math.abs(dz) > maxHorizontalDist) {
                    item.vel.x *= 0.5;
                    item.vel.z *= 0.5;
                }
                
                if (item.mesh.position.y > item.maxHeight && item.vel.y > 0) {
                    item.vel.y *= -0.3;
                }
                
                item.mesh.position.addScaledVector(item.vel, dt);

                const ix = Math.floor(item.mesh.position.x);
                const iz = Math.floor(item.mesh.position.z);
                const iy = Math.floor(item.mesh.position.y - 0.15);

                if (this.worldEngine.getWorldBlock(ix, iy, iz) !== BLOCKS.AIR && 
                    this.worldEngine.getWorldBlock(ix, iy, iz) !== BLOCKS.SAPLING) {
                    const settleY = iy + 1.15;
                    if (settleY <= item.spawnY + 0.5) {
                        item.baseY = settleY;
                        item.vel.set(0, 0, 0);
                    }
                }
            } else {
                item.mesh.position.y = item.baseY + Math.sin(item.time) * 0.1;
                const ix = Math.floor(item.mesh.position.x);
                const iz = Math.floor(item.mesh.position.z);
                const iy = Math.floor(item.baseY - 1.15);
                if (this.worldEngine.getWorldBlock(ix, iy, iz) === BLOCKS.AIR) {
                    item.baseY = null;
                }
            }
        }
    }

    removeItem(item) {
        this.scene.remove(item.mesh);
        const idx = this.droppedItems.findIndex(i => i.id === item.id);
        if (idx !== -1) this.droppedItems.splice(idx, 1);
    }

    getItems() {
        return this.droppedItems;
    }
}