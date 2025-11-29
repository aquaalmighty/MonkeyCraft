// MonkeySpawner.js - Handles monkey creation and spawning

export class MonkeySpawner {
    constructor(scene) {
        this.scene = scene;
    }

    createMonkey(playerPos, forceAggressive = false, campfireHealth = 0) {
        const group = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

        const faceTex = new THREE.TextureLoader().load('assets/textures/face.png');
        const skinMat = new THREE.MeshLambertMaterial({ map: faceTex, transparent: true });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), mat);
        body.position.y = 0.8;
        group.add(body);
        
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
        head.position.y = 1.55;
        group.add(head);
        
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), skinMat);
        face.position.y = 1.55;
        face.position.z = 0.3;
        group.add(face);
        
        const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const legGeo = new THREE.BoxGeometry(0.25, 0.4, 0.25);
        
        const armL = new THREE.Mesh(armGeo, mat);
        armL.position.set(-0.4, 0.9, 0);
        group.add(armL);
        
        const armR = new THREE.Mesh(armGeo, mat);
        armR.position.set(0.4, 0.9, 0);
        group.add(armR);
        
        const legL = new THREE.Mesh(legGeo, mat);
        legL.position.set(-0.2, 0.2, 0);
        group.add(legL);
        
        const legR = new THREE.Mesh(legGeo, mat);
        legR.position.set(0.2, 0.2, 0);
        group.add(legR);
        
        this.scene.add(group);
        
        // Find spawn position away from player
        let spawnX, spawnZ;
        let attempts = 0;
        do {
            spawnX = (Math.random() - 0.5) * 80;
            spawnZ = (Math.random() - 0.5) * 80;
            const dist = Math.sqrt(Math.pow(spawnX - playerPos.x, 2) + Math.pow(spawnZ - playerPos.z, 2));
            if (dist > 10) break;
            attempts++;
        } while (attempts < 10);

        group.position.set(spawnX, 30, spawnZ);

        // Create health bar
        const bar = document.createElement('div');
        bar.className = 'world-health-bar';
        bar.innerHTML = '<div class="world-health-fill" style="background-color: #00ff00;"></div>';
        document.getElementById('world-labels').appendChild(bar);

        // Determine initial behavior
        let initialState = 'idle';
        let targetType = null;
        let aggro = false;
        
        if (forceAggressive) {
            initialState = 'chase';
            targetType = (Math.random() < 0.5 && campfireHealth > 0) ? 'campfire' : 'player';
            aggro = true;
        } else {
            initialState = 'idle';
            targetType = null;
            aggro = false;
        }

        return {
            mesh: group,
            health: 5,
            maxHealth: 5,
            barElement: bar,
            state: initialState,
            targetEntity: targetType,
            timer: 2 + Math.random() * 3,
            target: new THREE.Vector3(),
            vel: new THREE.Vector3(),
            animTimer: Math.random() * 100,
            limbs: { armL, armR, legL, legR },
            aggro: aggro,
            attackCooldown: 0,
            breakTimer: 0,
            breakingBlock: null,
            detectionRadius: 40,
            alertRadius: 15,
            worriedTimer: 0,
            searchTimer: 0.5 + Math.random() * 0.5,
            lookChangeTimer: 5 + Math.random() * 5,
            lookDirection: new THREE.Vector3(0, 0, -1),
            hitCount: 0,
            isDrainingCampfire: false
        };
    }

    destroyMonkey(monkey) {
        this.scene.remove(monkey.mesh);
        if (monkey.barElement) monkey.barElement.remove();
    }
}