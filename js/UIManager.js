// UIManager.js - Manages HUD, inventory, health bars, and UI interactions

import { BLOCKS, BLOCK_COLORS, HOTBAR_SLOTS, MAX_HP, MAX_HUNGER } from './GameConstants.js';

export class UIManager {
    constructor(controls) {
        this.controls = controls;
        // Inventory structure: array of {itemId, count} objects for main inventory
        this.inventorySlots = [];
        // Hotbar: array of {itemId, count} objects
        this.hotbarSlots = Array(HOTBAR_SLOTS).fill(null).map(() => ({itemId: BLOCKS.AIR, count: 0}));
        // Offhand slot
        this.offhandSlot = {itemId: BLOCKS.AIR, count: 0};
        this.selectedBlockIndex = 0;
        this.isInventoryOpen = false;
        
        this.playerHealth = MAX_HP;
        this.playerHunger = MAX_HUNGER;
        this.lastHungerDrain = 0;
        this.currentDay = 1;
        
        this.initInventory();
    }

    initInventory() {
        // Initialize inventory slots - empty, hotbar has starting items
        this.inventorySlots = [];
        
        this.hotbarSlots[0] = {itemId: BLOCKS.SWORD, count: 1};
        this.hotbarSlots[1] = {itemId: BLOCKS.PICKAXE, count: 1};
        this.hotbarSlots[2] = {itemId: BLOCKS.TORCH, count: 1};
        this.hotbarSlots[3] = {itemId: BLOCKS.WOOD, count: 100};
        this.hotbarSlots[4] = {itemId: BLOCKS.AIR, count: 0};
    }

    cleanInventory() {
        // Mark empty inventory slots as AIR instead of removing them
        for (let i = 0; i < this.inventorySlots.length; i++) {
            if (this.inventorySlots[i].count <= 0) {
                this.inventorySlots[i] = {itemId: BLOCKS.AIR, count: 0};
            }
        }
        
        // Clean hotbar slots
        for (let i = 0; i < HOTBAR_SLOTS; i++) {
            if (this.hotbarSlots[i].count <= 0) {
                this.hotbarSlots[i] = {itemId: BLOCKS.AIR, count: 0};
            }
        }
        
        // Clean offhand
        if (this.offhandSlot.count <= 0) {
            this.offhandSlot = {itemId: BLOCKS.AIR, count: 0};
        }
    }

    getSelectedBlockId() {
        return this.hotbarSlots[this.selectedBlockIndex].itemId;
    }

    selectHotbarSlot(index) {
        this.selectedBlockIndex = index;
        this.updateUI();
    }

    // Helper method to get total count of an item across all slots
    getItemCount(itemId) {
        let count = 0;
        for (let slot of this.inventorySlots) {
            if (slot.itemId === itemId) count += slot.count;
        }
        for (let slot of this.hotbarSlots) {
            if (slot.itemId === itemId) count += slot.count;
        }
        if (this.offhandSlot.itemId === itemId) count += this.offhandSlot.count;
        return count;
    }

    // Helper method to decrement an item by 1 (removes from first found slot)
    decrementItem(itemId) {
        // Try to decrement from hotbar first (more accessible)
        for (let slot of this.hotbarSlots) {
            if (slot.itemId === itemId && slot.count > 0) {
                slot.count--;
                return true;
            }
        }
        // Then try inventory
        for (let slot of this.inventorySlots) {
            if (slot.itemId === itemId && slot.count > 0) {
                slot.count--;
                return true;
            }
        }
        // Finally try offhand
        if (this.offhandSlot.itemId === itemId && this.offhandSlot.count > 0) {
            this.offhandSlot.count--;
            return true;
        }
        return false;
    }

    // Helper method to add an item (adds to first found slot of that item, or creates new slot)
    addItem(itemId, amount = 1) {
        // First, try to add to an existing stack in the hotbar
        for (let slot of this.hotbarSlots) {
            if (slot.itemId === itemId) {
                slot.count += amount;
                return;
            }
        }
        
        // Then, try to add to an existing stack in the inventory
        for (let slot of this.inventorySlots) {
            if (slot.itemId === itemId) {
                slot.count += amount;
                return;
            }
        }

        // If no existing stack, find an empty slot in the hotbar
        for (let slot of this.hotbarSlots) {
            if (slot.itemId === BLOCKS.AIR) {
                slot.itemId = itemId;
                slot.count = amount;
                return;
            }
        }
        
        // If hotbar is full, find an empty slot in the inventory
        for (let slot of this.inventorySlots) {
            if (slot.itemId === BLOCKS.AIR) {
                slot.itemId = itemId;
                slot.count = amount;
                return;
            }
        }

        // If no empty slots, create a new slot in the inventory
        this.inventorySlots.push({itemId: itemId, count: amount});
    }

    getBlockIconHTML(id) {
        if (!id || id === BLOCKS.AIR) {
            return '<div class="block-icon" style="background:transparent;"></div>';
        }

        if (id === BLOCKS.SWORD) {
            return `<img src="assets/textures/icons/sword.png" class="block-icon" alt="Sword" style="width:30px; height:30px; object-fit:contain; image-rendering:pixelated;"/>`;
        }
        if (id === BLOCKS.PICKAXE) {
            return `<img src="assets/textures/icons/pickaxe.png" class="block-icon" alt="Pickaxe" style="width:30px; height:30px; object-fit:contain; image-rendering:pixelated;"/>`;
        }
        if (id === BLOCKS.TORCH) {
            return `<img src="assets/textures/icons/torch.png" class="block-icon" alt="Torch" style="width:30px; height:30px; object-fit:contain; image-rendering:pixelated;"/>`;
        }
        if (id === BLOCKS.SAPLING) {
            return `<img src="assets/textures/icons/sapling.png" class="block-icon" alt="Sapling" style="width:30px; height:30px; object-fit:contain; image-rendering:pixelated;"/>`;
        }
        if (id === BLOCKS.WATERMELON) {
            return `<img src="assets/textures/icons/watermelon.png" class="block-icon" alt="Watermelon" style="width:30px; height:30px; object-fit:contain; image-rendering:pixelated;"/>`;
        }
        
        const color = BLOCK_COLORS[id] || 'transparent';
        return `<div class="block-icon" style="background-color:${color};"></div>`;
    }

    updateUI() {
        const hb = document.getElementById('hotbar');
        hb.innerHTML = '';
        
        const selectedSlot = this.hotbarSlots[this.selectedBlockIndex];
        
        this.hotbarSlots.forEach((slot, index) => {
            const d = document.createElement('div');
            d.className = 'slot ' + (this.selectedBlockIndex === index ? 'active' : '');
            d.innerHTML = this.getBlockIconHTML(slot.itemId);
            
            const c = document.createElement('span');
            c.className = 'slot-count';
            c.innerText = (slot.itemId !== BLOCKS.AIR && 
                          slot.itemId !== BLOCKS.SWORD && 
                          slot.itemId !== BLOCKS.PICKAXE && 
                          slot.itemId !== BLOCKS.TORCH && 
                          slot.count > 0) ? slot.count : '';
            
            d.appendChild(c);
            d.onclick = () => {
                this.selectedBlockIndex = index;
                this.updateUI();
            };
            hb.appendChild(d);
        });
        
        document.getElementById('health-fill').style.width = `${(this.playerHealth / MAX_HP) * 100}%`;
        document.getElementById('hunger-fill').style.width = `${(this.playerHunger / MAX_HUNGER) * 100}%`;
        document.getElementById('day-counter').innerText = `Day: ${this.currentDay}`;
    }

    toggleInventory() {
        this.isInventoryOpen = !this.isInventoryOpen;
        const scr = document.getElementById('inventory-screen');
        
        if (this.isInventoryOpen) {
            this.controls.unlock();
            scr.style.display = 'flex';
            this.renderInventoryScreen(scr);
        } else {
            scr.style.display = 'none';
            this.controls.lock();
            this.updateUI();
        }
    }

    renderInventoryScreen(scr) {
        scr.innerHTML = '<h2>Inventory (E to Close)</h2><p style="font-size:12px;">Drag items to move them between inventory slots.</p>';
        
        const invGrid = document.createElement('div');
        invGrid.id = 'inventory-slots-grid';
        invGrid.setAttribute('data-zone', 'inventory');
        scr.appendChild(invGrid);
        
        // Ensure inventory has at least 25 slots
        const minSlots = 25;
        while (this.inventorySlots.length < minSlots) {
            this.inventorySlots.push({itemId: BLOCKS.AIR, count: 0});
        }
        
        // Render all inventory slots
        this.inventorySlots.slice(0, minSlots).forEach((slot, idx) => {
            const d = document.createElement('div');
            d.className = 'inv-slot draggable-slot';
            d.draggable = true;
            d.setAttribute('data-zone', 'inventory');
            d.setAttribute('data-slot-index', idx);
            d.setAttribute('data-item-id', slot.itemId);
            d.innerHTML = this.getBlockIconHTML(slot.itemId);
            
            const c = document.createElement('span');
            c.className = 'slot-count';
            if (slot.count > 0) {
                c.innerText = (slot.itemId !== BLOCKS.SWORD && slot.itemId !== BLOCKS.PICKAXE && slot.itemId !== BLOCKS.TORCH) ? slot.count : '';
            }
            d.appendChild(c);
            
            this.addDragEventListeners(d, 'inventory', idx);
            invGrid.appendChild(d);
        });
        
        // Hotbar
        const hbTitle = document.createElement('h3');
        hbTitle.innerText = "Hotbar";
        scr.appendChild(hbTitle);

        const hbInv = document.createElement('div');
        hbInv.id = 'inventory-hotbar-zone';
        hbInv.setAttribute('data-zone', 'hotbar');
        hbInv.style.cssText = 'display:flex; gap:5px; margin-top:5px;';
        scr.appendChild(hbInv);
        
        this.hotbarSlots.forEach((slot, idx) => {
            const d = document.createElement('div');
            d.className = 'slot draggable-slot ' + (this.selectedBlockIndex === idx ? 'active' : '');
            d.draggable = true;
            d.setAttribute('data-zone', 'hotbar');
            d.setAttribute('data-slot-index', idx);
            d.setAttribute('data-item-id', slot.itemId);
            d.innerHTML = this.getBlockIconHTML(slot.itemId);
            
            const c = document.createElement('span');
            c.className = 'slot-count';
            c.innerText = (slot.itemId !== BLOCKS.AIR && 
                          slot.itemId !== BLOCKS.SWORD && 
                          slot.itemId !== BLOCKS.PICKAXE && 
                          slot.itemId !== BLOCKS.TORCH && 
                          slot.count > 0) ? slot.count : '';
            d.appendChild(c);

            this.addDragEventListeners(d, 'hotbar', idx);
            hbInv.appendChild(d);
        });
        
        // Offhand
        const ofDiv = document.createElement('div');
        ofDiv.className = 'offhand-slot-container';
        ofDiv.setAttribute('data-zone', 'offhand');
        ofDiv.innerHTML = '<span>Offhand:</span>';
        
        const slot = document.createElement('div');
        slot.className = 'inv-slot draggable-slot';
        slot.draggable = true;
        slot.setAttribute('data-zone', 'offhand');
        slot.setAttribute('data-item-id', this.offhandSlot.itemId);
        slot.innerHTML = this.getBlockIconHTML(this.offhandSlot.itemId);
        
        if (this.offhandSlot.itemId !== BLOCKS.AIR && 
            this.offhandSlot.count > 0 && 
            this.offhandSlot.itemId !== BLOCKS.SWORD && 
            this.offhandSlot.itemId !== BLOCKS.PICKAXE && 
            this.offhandSlot.itemId !== BLOCKS.TORCH) {
            const cnt = document.createElement('span');
            cnt.className = 'slot-count';
            cnt.innerText = this.offhandSlot.count;
            slot.appendChild(cnt);
        }
        
        this.addDragEventListeners(slot, 'offhand', 0);
        ofDiv.appendChild(slot);
        scr.appendChild(ofDiv);
    }

    addDragEventListeners(element, zone, slotIndex) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('sourceZone', zone);
            e.dataTransfer.setData('sourceIndex', slotIndex);
            element.classList.add('dragging');
        });

        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
        });

        // Make slots drop targets
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            element.classList.add('drag-over');
        });

        element.addEventListener('dragleave', (e) => {
            element.classList.remove('drag-over');
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            
            const sourceZone = e.dataTransfer.getData('sourceZone');
            const sourceIndex = parseInt(e.dataTransfer.getData('sourceIndex'));
            
            this.handleInventoryDrop(sourceZone, sourceIndex, zone, slotIndex);
            
            const scr = document.getElementById('inventory-screen');
            this.renderInventoryScreen(scr);
            this.updateUI();  // Update the visible hotbar
        });
    }

    handleInventoryDrop(sourceZone, sourceIndex, targetZone, targetIndex) {
        // Get source and target slots
        let sourceSlot = null;
        let targetSlot = null;

        if (sourceZone === 'inventory') {
            sourceSlot = this.inventorySlots[sourceIndex];
        } else if (sourceZone === 'hotbar') {
            sourceSlot = this.hotbarSlots[sourceIndex];
        } else if (sourceZone === 'offhand') {
            sourceSlot = this.offhandSlot;
        }

        if (targetZone === 'inventory') {
            targetSlot = this.inventorySlots[targetIndex];
        } else if (targetZone === 'hotbar') {
            targetSlot = this.hotbarSlots[targetIndex];
        } else if (targetZone === 'offhand') {
            targetSlot = this.offhandSlot;
        }

        if (!sourceSlot || !targetSlot) return;

        // If dragging to the same slot, do nothing
        if (sourceZone === targetZone && sourceIndex === targetIndex) return;

        // Swap the entire slots
        const temp = {itemId: targetSlot.itemId, count: targetSlot.count};
        targetSlot.itemId = sourceSlot.itemId;
        targetSlot.count = sourceSlot.count;
        sourceSlot.itemId = temp.itemId;
        sourceSlot.count = temp.count;

        // Clean up empty slots
        this.cleanInventory();
    }

    updateHunger(dt) {
        this.lastHungerDrain += dt;
        if (this.lastHungerDrain > 5 && this.playerHunger > 0) {
            this.playerHunger = Math.max(0, this.playerHunger - 1);
            this.lastHungerDrain = 0;
            this.updateUI();
        }
    }

    checkPlayerDeath(controls) {
        if (this.playerHealth <= 0) {
            this.playerHealth = MAX_HP;
            this.playerHunger = MAX_HUNGER;
            controls.getObject().position.set(0, 30, 0);
            this.updateUI();
            return true;
        }
        return false;
    }

    incrementDay() {
        this.currentDay++;
        this.updateUI();
    }
}
