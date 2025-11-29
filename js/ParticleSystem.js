// ParticleSystem.js - Manages visual effects and particles

import { GRAVITY } from './GameConstants.js';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    spawn(pos, colorHex, size = 0.15, life = 1.0, isSmoke = false) {
        const count = isSmoke ? 1 : 8;
        const geo = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.8 });
        
        for (let i = 0; i < count; i++) {
            const p = new THREE.Mesh(geo, mat);
            p.position.copy(pos);
            p.position.x += (Math.random() - 0.5) * 0.5;
            p.position.y += (Math.random() - 0.5) * 0.5;
            p.position.z += (Math.random() - 0.5) * 0.5;
            
            if (isSmoke) {
                p.userData.vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 1,
                    (Math.random()) * 2 + 1,
                    (Math.random() - 0.5) * 1
                );
                p.userData.isSmoke = true;
            } else {
                p.userData.vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 4,
                    (Math.random()) * 4,
                    (Math.random() - 0.5) * 4
                );
            }
            
            p.userData.life = life;
            p.userData.maxLife = life;
            this.scene.add(p);
            this.particles.push(p);
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.userData.life -= dt;
            
            if (p.userData.isSmoke) {
                p.userData.vel.x += (Math.random() - 0.5) * dt;
                p.userData.vel.z += (Math.random() - 0.5) * dt;
                p.material.opacity = (p.userData.life / p.userData.maxLife) * 0.6;
                p.scale.addScalar(dt * 0.5);
            } else {
                p.userData.vel.y -= GRAVITY * dt;
            }
            
            p.position.addScaledVector(p.userData.vel, dt);
            
            if (p.userData.life <= 0) {
                this.scene.remove(p);
                this.particles.splice(i, 1);
            } else if (!p.userData.isSmoke) {
                p.scale.setScalar(p.userData.life);
            }
        }
    }
}