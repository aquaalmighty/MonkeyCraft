// MonkeyBehavior.js - AI behavior and detection for monkeys

import { BLOCKS, GRAVITY } from './GameConstants.js';

export class MonkeyBehavior {
    constructor(worldEngine) {
        this.worldEngine = worldEngine;
    }

    updateDetection(monkey, playerPos, dt) {
        monkey.searchTimer -= dt;
        monkey.lookChangeTimer -= dt;
        monkey.worriedTimer -= dt;

        const distToPlayer = monkey.mesh.position.distanceTo(playerPos);
        
        // Update look direction for visualization
        const currentLook = new THREE.Vector3(0, 0, -1);
        currentLook.applyQuaternion(monkey.mesh.quaternion);
        monkey.lookDirection.copy(currentLook);
        
        // DETECTION SYSTEM - only for non-aggressive monkeys
        if (!monkey.aggro && monkey.searchTimer <= 0) {
            monkey.searchTimer = 0.5 + Math.random() * 0.5;
            
            // Instant detection within alert radius
            if (distToPlayer <= monkey.alertRadius) {
                monkey.aggro = true;
                monkey.state = 'chase';
                monkey.targetEntity = 'player';
                monkey.worriedTimer = 30;
                return;
            }
            
            if (distToPlayer <= monkey.detectionRadius) {
                this.advancedDetection(monkey, playerPos, distToPlayer);
            }
        }
    }

    advancedDetection(monkey, playerPos, distToPlayer) {
        const vectorToPlayer = new THREE.Vector3()
            .subVectors(playerPos, monkey.mesh.position)
            .normalize();
        
        // Distance factor (closer = higher chance)
        let distancePercentage = distToPlayer / monkey.detectionRadius;
        let detectionChance = 1.0 - Math.pow(Math.max(0, Math.min(1, distancePercentage)), 3);
        
        // Hearing bonus (can detect even if not looking)
        const hearBonus = 0.1;
        detectionChance += hearBonus;
        
        // View factor (looking at player = higher chance)
        const viewDot = Math.max(0, monkey.lookDirection.dot(vectorToPlayer));
        let viewFactor = Math.pow(viewDot, 4);
        
        if (viewFactor > 0.1) {
            const sightBonus = 0.1;
            viewFactor += sightBonus;
            
            // Check line of sight from monkey's head to player's head
            const hasLineOfSight = this.hasDirectLineOfSight(monkey, playerPos);
            
            // Combine sight and distance
            let finalChance = viewFactor - (distancePercentage / 3);
            
            // Boost if close AND looking
            if (viewFactor > 0.5 && detectionChance > 0.5) {
                finalChance += 0.2;
            }
            
            // Extra boost for very close
            if (detectionChance > 0.5 && viewFactor > 0.001) {
                finalChance += 0.1;
                if (detectionChance > 0.8) finalChance += 0.3;
                if (detectionChance > 0.9) finalChance += 0.3;
            }
            
            // Adjust for frame rate (checked 20 times per second)
            const adjustedProbability = 1.0 - Math.pow(1.0 - Math.min(1, Math.max(0, finalChance)), 1 / 20);
            
            if (Math.random() < adjustedProbability && hasLineOfSight) {
                // DETECTED!
                monkey.aggro = true;
                monkey.state = 'chase';
                monkey.targetEntity = 'player';
                monkey.worriedTimer = 30;
                return;
            } else if (viewFactor > 0.3) {
                // Look at player with curiosity
                monkey.mesh.lookAt(playerPos.x, monkey.mesh.position.y, playerPos.z);
                monkey.lookChangeTimer = 2 + Math.random() * 2;
            }
        }
        
        // Hearing-only detection (adjusted for frame rate)
        const hearOnlyChance = 1.0 - Math.pow(1.0 - Math.min(1, Math.max(0, detectionChance)), 1 / 20);
        if (Math.random() < hearOnlyChance && distToPlayer < monkey.detectionRadius * 0.6) {
            // Heard something - look toward player
            monkey.mesh.lookAt(playerPos.x, monkey.mesh.position.y, playerPos.z);
            monkey.lookChangeTimer = 3 + Math.random() * 3;
            monkey.worriedTimer = Math.max(monkey.worriedTimer, 10);
        }
    }

    hasDirectLineOfSight(monkey, playerPos) {
        // Get monkey head position (head is at y + 1.55 approximately based on model)
        const monkeyHeadPos = monkey.mesh.position.clone().add(new THREE.Vector3(0, 1.55, 0));
        
        // Get player head position (camera/head is at the player position)
        const playerHeadPos = playerPos.clone().add(new THREE.Vector3(0, 0.6, 0));
        
        // Direction from monkey head to player head
        const direction = playerHeadPos.clone().sub(monkeyHeadPos).normalize();
        const distance = monkeyHeadPos.distanceTo(playerHeadPos);
        
        // Create raycaster for line of sight check
        const raycaster = new THREE.Raycaster(monkeyHeadPos, direction, 0, distance);
        
        // Get all block meshes from world
        const blockMeshes = Object.values(this.worldEngine.chunks)
            .map(c => c.mesh)
            .filter(m => m !== undefined && m !== null);
        
        // Check if any blocks are in the way
        const hits = raycaster.intersectObjects(blockMeshes, true);
        
        // If no hits, line of sight is clear
        if (hits.length === 0) {
            return true;
        }
        
        // If there are hits, check if they're closer than the player
        // If the closest hit is farther than the player, line of sight is clear
        if (hits.length > 0 && hits[0].distance > distance) {
            return true;
        }
        
        return false;
    }

    updateIdleState(monkey, dt) {
        if (monkey.state !== 'idle') return;
        
        if (monkey.timer <= 0) {
            const r = Math.random();
            if (r < 0.6) {
                monkey.state = 'move';
                monkey.target.set(
                    monkey.mesh.position.x + (Math.random() - 0.5) * 10,
                    monkey.mesh.position.y,
                    monkey.mesh.position.z + (Math.random() - 0.5) * 10
                );
                monkey.timer = 2 + Math.random() * 2;
            } else {
                monkey.timer = 3 + Math.random() * 5;
            }
        }
        
        // Random look direction changes for idle monkeys
        if (monkey.lookChangeTimer <= 0) {
            const randomAngle = Math.random() * Math.PI * 2;
            const lookTarget = new THREE.Vector3(
                monkey.mesh.position.x + Math.cos(randomAngle) * 5,
                monkey.mesh.position.y,
                monkey.mesh.position.z + Math.sin(randomAngle) * 5
            );
            monkey.mesh.lookAt(lookTarget.x, monkey.mesh.position.y, lookTarget.z);
            monkey.lookChangeTimer = (monkey.worriedTimer > 0) ? (2 + Math.random() * 2) : (5 + Math.random() * 10);
        }
    }

    updateChaseState(monkey, playerPos, campfireMesh, campfireHealth, onPlayerDamage) {
        if (monkey.state !== 'chase') return;
        
        if (monkey.targetEntity === 'campfire' && campfireMesh) {
            monkey.target.copy(campfireMesh.position);
            const distToFire = monkey.mesh.position.distanceTo(campfireMesh.position);
            if (distToFire < 3.0 && monkey.attackCooldown <= 0) {
                return { attackCampfire: true, damage: 2 };
            }
        } else {
            monkey.target.copy(playerPos);
            const distToPlayer = monkey.mesh.position.distanceTo(playerPos);
            
            if (monkey.attackCooldown <= 0 && this.canMonkeyReachPlayer(monkey.mesh.position, playerPos)) {
                if (onPlayerDamage) onPlayerDamage(monkey);
                monkey.attackCooldown = 1.5;
            }
            
            if (distToPlayer > 60 && monkey.targetEntity === 'player') {
                monkey.aggro = false;
                monkey.state = 'idle';
                monkey.timer = 3 + Math.random() * 5;
            }
        }
        
        return null;
    }

    updateMovement(monkey, dt) {
        if (monkey.state !== 'move' && monkey.state !== 'chase') {
            monkey.limbs.armL.rotation.x = 0;
            monkey.limbs.armR.rotation.x = 0;
            monkey.limbs.legL.rotation.x = 0;
            monkey.limbs.legR.rotation.x = 0;
            return;
        }
        
        const dx = monkey.target.x - monkey.mesh.position.x;
        const dz = monkey.target.z - monkey.mesh.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        
        if (d > 0.5) {
            const speed = monkey.state === 'chase' ? 4.5 : 2;
            const nextX = monkey.mesh.position.x + (dx / d) * speed * dt;
            const nextZ = monkey.mesh.position.z + (dz / d) * speed * dt;
            
            const currY = Math.floor(monkey.mesh.position.y);
            const checkX = Math.floor(nextX);
            const checkZ = Math.floor(nextZ);
            
            const blockAtFeet = this.worldEngine.getWorldBlock(checkX, currY, checkZ);
            const blockHead = this.worldEngine.getWorldBlock(checkX, currY + 1, checkZ);

            let canMove = true;
            
            if (blockAtFeet !== BLOCKS.AIR && blockAtFeet !== BLOCKS.SAPLING) {
                if (blockHead !== BLOCKS.AIR && blockHead !== BLOCKS.SAPLING) {
                    canMove = false;
                    monkey.state = 'break';
                    monkey.breakTimer = 0;
                    monkey.breakingBlock = { x: checkX, y: currY + 1, z: checkZ };
                }
            } else if (blockHead !== BLOCKS.AIR && blockHead !== BLOCKS.SAPLING) {
                canMove = false;
                monkey.state = 'break';
                monkey.breakTimer = 0;
                monkey.breakingBlock = { x: checkX, y: currY + 1, z: checkZ };
            }

            if (canMove) {
                monkey.mesh.position.x = nextX;
                monkey.mesh.position.z = nextZ;
                monkey.mesh.lookAt(monkey.target.x, monkey.mesh.position.y, monkey.target.z);
                monkey.limbs.armL.rotation.x = Math.sin(monkey.animTimer) * 0.8;
                monkey.limbs.armR.rotation.x = -Math.sin(monkey.animTimer) * 0.8;
                monkey.limbs.legL.rotation.x = -Math.sin(monkey.animTimer) * 0.8;
                monkey.limbs.legR.rotation.x = Math.sin(monkey.animTimer) * 0.8;
            }
        } else {
            if (monkey.state !== 'chase') monkey.state = 'idle';
        }
    }

    updatePhysics(monkey, dt) {
        monkey.vel.y -= GRAVITY * dt;
        monkey.mesh.position.y += monkey.vel.y * dt;
        
        const ix = Math.floor(monkey.mesh.position.x);
        const iz = Math.floor(monkey.mesh.position.z);
        const iy = Math.floor(monkey.mesh.position.y);
        
        if (this.worldEngine.getWorldBlock(ix, iy, iz) !== BLOCKS.AIR && 
            this.worldEngine.getWorldBlock(ix, iy, iz) !== BLOCKS.SAPLING) {
            if (this.worldEngine.getWorldBlock(ix, iy + 1, iz) === BLOCKS.AIR || 
                this.worldEngine.getWorldBlock(ix, iy + 1, iz) === BLOCKS.SAPLING) {
                monkey.mesh.position.y = iy + 1.001;
                monkey.vel.y = 0;
            } else {
                monkey.mesh.position.y = iy + 1.001;
                monkey.vel.y = 0;
            }
        }
    }

    canMonkeyReachPlayer(monkeyPos, playerPos) {
        const maxAttackDistance = 3.0;
        const distance = monkeyPos.distanceTo(playerPos);
        if (distance > maxAttackDistance) {
            return false;
        }

        const direction = new THREE.Vector3()
            .subVectors(playerPos, monkeyPos)
            .normalize();
        
        const stepSize = 0.3;
        let currentPos = monkeyPos.clone();
        const step = direction.clone().multiplyScalar(stepSize);
        
        while (currentPos.distanceTo(monkeyPos) < distance - 0.5) {
            currentPos.add(step);
            const x = Math.floor(currentPos.x);
            const y = Math.floor(currentPos.y);
            const z = Math.floor(currentPos.z);
            
            const block = this.worldEngine.getWorldBlock(x, y, z);
            if (block !== BLOCKS.AIR && block !== BLOCKS.SAPLING) {
                return false;
            }
        }
        
        return true;
    }
}