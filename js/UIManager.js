// UIManager.js - Manages HUD, inventory, health bars, and UI interactions

import { BLOCKS, BLOCK_COLORS, HOTBAR_SLOTS, MAX_HP, MAX_HUNGER } from './GameConstants.js';

export class UIManager {
    constructor(controls) {
        this.controls = controls;
        this.inventory = {};
        this.hotbarItems = Array(HOTBAR_SLOTS).fill(BLOCKS.AIR);
        this.offhandItem = BLOCKS.AIR;
        this.selectedBlockIndex = 0;
        this.isInventoryOpen = false;
        
        this.playerHealth = MAX_HP;
        this.playerHunger = MAX_HUNGER;
        this.lastHungerDrain = 0;
        this.currentDay = 1;
        
        this.initInventory();
    }

    initInventory() {
        for (let k in BLOCKS) this.inventory[BLOCKS[k]] = 0;
        this.inventory[BLOCKS.GRASS] = 10;
        this.inventory[BLOCKS.DIRT] = 10;
        this.inventory[BLOCKS.STONE] = 10;
        this.inventory[BLOCKS.WOOD] = 20;
        this.inventory[BLOCKS.PLANKS] = 10;
        this.inventory[BLOCKS.SWORD] = 1;
        this.inventory[BLOCKS.PICKAXE] = 1;
        this.inventory[BLOCKS.TORCH] = 10;
        this.inventory[BLOCKS.WATERMELON] = 5;
        
        this.hotbarItems[0] = BLOCKS.GRASS;
        this.hotbarItems[1] = BLOCKS.PICKAXE;
        this.hotbarItems[2] = BLOCKS.STONE;
        this.hotbarItems[3] = BLOCKS.SWORD;
        this.hotbarItems[4] = BLOCKS.TORCH;
    }

    cleanInventory() {
        for (let k in this.inventory) {
            if (this.inventory[k] <= 0) this.inventory[k] = 0;
        }
        
        for (let i = 0; i < HOTBAR_SLOTS; i++) {
            if (this.hotbarItems[i] !== BLOCKS.AIR && 
                this.inventory[this.hotbarItems[i]] <= 0 && 
                this.hotbarItems[i] !== BLOCKS.SWORD && 
                this.hotbarItems[i] !== BLOCKS.PICKAXE) {
                this.hotbarItems[i] = BLOCKS.AIR;
            }
        }
        
        if (this.offhandItem !== BLOCKS.AIR && 
            this.inventory[this.offhandItem] <= 0 &&
            this.offhandItem !== BLOCKS.SWORD && 
            this.offhandItem !== BLOCKS.PICKAXE) {
            this.offhandItem = BLOCKS.AIR;
        }
    }

    getSelectedBlockId() {
        return this.hotbarItems[this.selectedBlockIndex];
    }

    selectHotbarSlot(index) {
        this.selectedBlockIndex = index;
        this.updateUI();
    }

    getBlockIconHTML(id) {
        if (!id || id === BLOCKS.AIR) {
            return '<div class="block-icon" style="background:transparent;"></div>';
        }

        if (id === BLOCKS.SWORD) {
            return `<svg viewBox="0 0 100 100" class="block-icon"><path d="M50 10 L60 20 L50 30 L40 20 Z" fill="#8B4513"/><rect x="45" y="30" width="10" height="60" fill="#cccccc"/></svg>`;
        }
        if (id === BLOCKS.PICKAXE) {
            return `<svg viewBox="0 0 100 100" class="block-icon"><path d="M10 30 Q50 0 90 30 L80 40 Q50 15 20 40 Z" fill="#888"/><rect x="45" y="30" width="10" height="60" fill="#8B4513"/></svg>`;
        }
        if (id === BLOCKS.TORCH) {
            return `<svg viewBox="0 0 100 100" class="block-icon"><rect x="40" y="40" width="20" height="50" fill="#8B4513"/><circle cx="50" cy="30" r="15" fill="#FFD700"/></svg>`;
        }
        if (id === BLOCKS.SAPLING) {
            return `<div class="block-icon" style="background:transparent; display:flex; justify-content:center; align-items:end;"><div style="width:4px; height:15px; background:#4a3728;"></div><div style="width:12px; height:12px; background:#2d5a27; border-radius:50%; margin-bottom:10px; margin-left:-8px;"></div></div>`;
        }
        
        const color = BLOCK_COLORS[id] || 'transparent';
        return `<div class="block-icon" style="background-color:${color};"></div>`;
    }

    updateUI() {
        const hb = document.getElementById('hotbar');
        hb.innerHTML = '';
        
        const selectedBlockId = this.hotbarItems[this.selectedBlockIndex];
        
        this.hotbarItems.forEach((id, index) => {
            const d = document.createElement('div');
            d.className = 'slot ' + (this.selectedBlockIndex === index ? 'active' : '');
            d.innerHTML = this.getBlockIconHTML(id);
            
            const c = document.createElement('span');
            c.className = 'slot-count';
            const count = this.inventory[id] || 0;
            c.innerText = (id !== BLOCKS.AIR && 
                          id !== BLOCKS.SWORD && 
                          id !== BLOCKS.PICKAXE && 
                          id !== BLOCKS.TORCH && 
                          count > 0) ? count : '';
            
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
        scr.innerHTML = '<h2>Inventory (E to Close)</h2><p style="font-size:12px;">Click to move to Hotbar/Offhand.</p>';
        
        const invGrid = document.createElement('div');
        invGrid.id = 'inventory-slots-grid';
        scr.appendChild(invGrid);
        
        const keys = new Set();
        Object.keys(this.inventory).map(Number).filter(k => this.inventory[k] > 0).forEach(id => keys.add(id));
        this.hotbarItems.forEach(id => keys.add(id));
        if (this.offhandItem !== BLOCKS.AIR) keys.add(this.offhandItem);
        
        const sortedKeys = Array.from(keys).filter(id => id !== BLOCKS.AIR).sort((a, b) => a - b);
        
        sortedKeys.forEach(id => {
            const d = document.createElement('div');
            d.className = 'inv-slot';
            d.innerHTML = this.getBlockIconHTML(id);
            
            const c = document.createElement('span');
            c.className = 'slot-count';
            const count = this.inventory[id] || 0;
            c.innerText = (id !== BLOCKS.SWORD && id !== BLOCKS.PICKAXE && id !== BLOCKS.TORCH) ? count : '';
            d.appendChild(c);
            
            d.onclick = () => {
                const emptyHbIdx = this.hotbarItems.indexOf(BLOCKS.AIR);
                if (emptyHbIdx !== -1) {
                    if (this.hotbarItems.includes(id) && 
                        (id === BLOCKS.SWORD || id === BLOCKS.PICKAXE || id === BLOCKS.TORCH)) return;
                    this.hotbarItems[emptyHbIdx] = id;
                } else if (this.offhandItem === BLOCKS.AIR) {
                    this.offhandItem = id;
                } else {
                    this.hotbarItems[this.selectedBlockIndex] = id;
                }
                this.renderInventoryScreen(scr);
            };
            invGrid.appendChild(d);
        });
        
        // Hotbar
        const hbTitle = document.createElement('h3');
        hbTitle.innerText = "Hotbar";
        scr.appendChild(hbTitle);

        const hbInv = document.createElement('div');
        hbInv.style.cssText = 'display:flex; gap:5px; margin-top:5px;';
        scr.appendChild(hbInv);
        
        this.hotbarItems.forEach((id, idx) => {
            const d = document.createElement('div');
            d.className = 'slot ' + (this.selectedBlockIndex === idx ? 'active' : '');
            d.innerHTML = this.getBlockIconHTML(id);
            
            const c = document.createElement('span');
            c.className = 'slot-count';
            const count = this.inventory[id] || 0;
            c.innerText = (id !== BLOCKS.AIR && 
                          id !== BLOCKS.SWORD && 
                          id !== BLOCKS.PICKAXE && 
                          id !== BLOCKS.TORCH && 
                          count > 0) ? count : '';
            d.appendChild(c);

            d.onclick = () => {
                if (id !== BLOCKS.AIR) {
                    this.hotbarItems[idx] = BLOCKS.AIR;
                    this.renderInventoryScreen(scr);
                }
            };
            hbInv.appendChild(d);
        });
        
        // Offhand
        const ofDiv = document.createElement('div');
        ofDiv.className = 'offhand-slot-container';
        ofDiv.innerHTML = '<span>Offhand:</span>';
        
        const slot = document.createElement('div');
        slot.className = 'inv-slot';
        slot.innerHTML = this.getBlockIconHTML(this.offhandItem);
        
        if (this.offhandItem !== BLOCKS.AIR && 
            this.inventory[this.offhandItem] > 0 && 
            this.offhandItem !== BLOCKS.SWORD && 
            this.offhandItem !== BLOCKS.PICKAXE && 
            this.offhandItem !== BLOCKS.TORCH) {
            const cnt = document.createElement('span');
            cnt.className = 'slot-count';
            cnt.innerText = this.inventory[this.offhandItem];
            slot.appendChild(cnt);
        }
        
        slot.onclick = () => {
            this.offhandItem = BLOCKS.AIR;
            this.renderInventoryScreen(scr);
        };
        
        ofDiv.appendChild(slot);
        scr.appendChild(ofDiv);
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