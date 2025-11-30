// SoundManager.js - Manages spatial and non-spatial audio playback

export class SoundManager {
    constructor(scene, camera, configPath = 'assets/sounds/SoundConfig.json') {
        this.scene = scene;
        this.camera = camera;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        
        this.soundConfig = null;
        this.audioBuffers = {};
        this.soundInstances = [];
        
        this.pitchSeed = 12345;
        this.sequenceSeed = 54321;
        
        this.walkSequence = ['walk1', 'walk2', 'walk3', 'walk4'];
        this.mineSequence = ['mine1', 'mine2'];
        
        this.lastWalkIndex = -1;
        this.lastMineIndex = -1;
        
        this.configPath = configPath;
    }

    /**
     * Loads the sound configuration file
     */
    async loadConfig() {
        try {
            const response = await fetch(this.configPath);
            if (!response.ok) throw new Error(`Failed to load config: ${response.statusText}`);
            
            this.soundConfig = await response.json();
            
            // Set seeds from config
            this.pitchSeed = this.soundConfig.pitchSeed || 12345;
            this.sequenceSeed = this.soundConfig.sequenceSeed || 21412412412;
            
            // Load all audio buffers
            await this.loadAllAudioBuffers();
        } catch (error) {
            console.error('Error loading sound configuration:', error);
        }
    }

    /**
     * Loads all audio buffers from the configuration
     */
    async loadAllAudioBuffers() {
        const audioLoader = new THREE.AudioLoader();
        const promises = [];

        for (const [soundName, config] of Object.entries(this.soundConfig.sounds)) {
            const promise = new Promise((resolve) => {
                audioLoader.load(config.path, (audioBuffer) => {
                    this.audioBuffers[soundName] = audioBuffer;
                    resolve();
                }, undefined, (error) => {
                    console.warn(`Failed to load sound: ${soundName}`, error);
                    resolve();
                });
            });
            promises.push(promise);
        }

        await Promise.all(promises);
    }

    /**
     * Seeded random number generator (between 0 and 1)
     */
    seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Get next walking sound with random sequence
     */
    getNextWalkSound() {
        // Use sequence seed to determine which walk sound
        const nextIndex = Math.floor(this.seededRandom(this.sequenceSeed + this.lastWalkIndex + 1) * this.walkSequence.length);
        
        // Avoid repeating the same sound
        let selectedIndex = nextIndex;
        if (this.walkSequence.length > 1) {
            while (selectedIndex === this.lastWalkIndex) {
                selectedIndex = (selectedIndex + 1) % this.walkSequence.length;
            }
        }
        
        this.lastWalkIndex = selectedIndex;
        return this.walkSequence[selectedIndex];
    }

    /**
     * Get next mining sound with random sequence
     */
    getNextMineSound() {
        // Use sequence seed to determine which mine sound
        const nextIndex = Math.floor(this.seededRandom(this.sequenceSeed + this.lastMineIndex + 100) * this.mineSequence.length);
        
        // Avoid repeating the same sound
        let selectedIndex = nextIndex;
        if (this.mineSequence.length > 1) {
            while (selectedIndex === this.lastMineIndex) {
                selectedIndex = (selectedIndex + 1) % this.mineSequence.length;
            }
        }
        
        this.lastMineIndex = selectedIndex;
        return this.mineSequence[selectedIndex];
    }

    /**
     * Calculate pitch variation using seeded random
     */
    getPitchVariation(soundName, seed) {
        const config = this.soundConfig.sounds[soundName];
        
        if (!config || !config.variablePitch) {
            return 1.0;
        }

        const variation = config.pitchVariation || 0.01;
        const randomValue = this.seededRandom(this.pitchSeed + seed);
        
        // Variation ranges from (1 - variation) to (1 + variation)
        return 1 + (randomValue * 2 - 1) * variation;
    }

    /**
     * Play a sound by name
     * @param {string} soundName - Name of the sound to play
     * @param {THREE.Vector3} position - Position for spatial sounds (optional)
     * @param {number} volumeOverride - Override the config volume (optional, 0-1)
     */
    play(soundName, position = null, volumeOverride = null) {
        if (!this.soundConfig || !this.audioBuffers[soundName]) {
            console.warn(`Sound not found: ${soundName}`);
            return;
        }

        const config = this.soundConfig.sounds[soundName];
        let sound;

        if (config.spatial && position) {
            // Spatial audio
            sound = new THREE.PositionalAudio(this.listener);
            sound.setBuffer(this.audioBuffers[soundName]);
            
            // Create object to attach sound to
            const soundObject = new THREE.Object3D();
            soundObject.position.copy(position);
            soundObject.add(sound);
            this.scene.add(soundObject);
            
            // Spatial audio parameters
            sound.setRefDistance(5);
            sound.setMaxDistance(50);
            sound.setRolloffFactor(1);
        } else {
            // Non-spatial audio
            sound = new THREE.Audio(this.listener);
            sound.setBuffer(this.audioBuffers[soundName]);
        }

        // Set volume
        const volume = volumeOverride !== null ? volumeOverride : config.volume;
        sound.setVolume(volume);

        // Apply pitch variation if needed
        if (config.variablePitch) {
            let seedValue;
            
            // Use different seed values for different sound types
            if (soundName.startsWith('walk')) {
                seedValue = this.lastWalkIndex * 1000 + Math.random() * 10000;
            } else if (soundName.startsWith('mine')) {
                seedValue = this.lastMineIndex * 1000 + Math.random() * 10000;
            } else {
                seedValue = Math.random() * 10000;
            }
            
            const pitch = this.getPitchVariation(soundName, seedValue);
            sound.playbackRate = pitch;
        }

        // Play the sound
        sound.play();

        // Track and clean up
        this.soundInstances.push({ sound, object: sound.parent || null });

        // Remove from tracking after it finishes
        const duration = this.audioBuffers[soundName].duration * 1000;
        setTimeout(() => {
            const index = this.soundInstances.indexOf({ sound });
            if (index > -1) {
                this.soundInstances.splice(index, 1);
            }
            if (config.spatial && sound.parent) {
                sound.parent.parent.remove(sound.parent);
            }
        }, duration);

        return sound;
    }

    /**
     * Play a walking sound (non-spatial, random from sequence)
     */
    playWalkSound(volumeOverride = null) {
        const soundName = this.getNextWalkSound();
        return this.play(soundName, null, volumeOverride);
    }

    /**
     * Play a mining sound (spatial, random from sequence)
     * @param {THREE.Vector3} position - Position where the mining is happening
     * @param {number} volumeOverride - Override volume (optional)
     */
    playMineSound(position, volumeOverride = null) {
        const soundName = this.getNextMineSound();
        return this.play(soundName, position, volumeOverride);
    }

    /**
     * Play a swing sword sound (non-spatial)
     */
    playSwingSwordSound(volumeOverride = null) {
        return this.play('swingsword', null, volumeOverride);
    }

    /**
     * Play a block break sound (spatial)
     */
    playBreakBlockSound(position, volumeOverride = null) {
        return this.play('breakblock', position, volumeOverride);
    }

    /**
     * Play a block place sound (spatial)
     */
    playPlaceBlockSound(position, volumeOverride = null) {
        return this.play('placeblock', position, volumeOverride);
    }

    /**
     * Play a hit entity sound (spatial)
     */
    playHitEntitySound(position, volumeOverride = null) {
        return this.play('hitEntity', position, volumeOverride);
    }

    /**
     * Play a pickup item sound (non-spatial)
     */
    playPickupItemSound(volumeOverride = null) {
        return this.play('pickupitem', null, volumeOverride);
    }

    /**
     * Stop all currently playing sounds
     */
    stopAll() {
        this.soundInstances.forEach(({ sound, object }) => {
            sound.stop();
            if (object && object.parent) {
                object.parent.remove(object);
            }
        });
        this.soundInstances = [];
    }

    /**
     * Stop a specific sound
     */
    stopSound(sound) {
        sound.stop();
        const index = this.soundInstances.findIndex(s => s.sound === sound);
        if (index > -1) {
            const { object } = this.soundInstances[index];
            if (object && object.parent) {
                object.parent.remove(object);
            }
            this.soundInstances.splice(index, 1);
        }
    }

    /**
     * Set master volume for all sounds
     */
    setMasterVolume(volume) {
        this.listener.setMasterVolume(Math.max(0, Math.min(1, volume)));
    }

    /**
     * Update pitch seeds (useful for testing)
     */
    setPitchSeed(seed) {
        this.pitchSeed = seed;
    }

    /**
     * Update sequence seeds (useful for testing)
     */
    setSequenceSeed(seed) {
        this.sequenceSeed = seed;
    }
}
