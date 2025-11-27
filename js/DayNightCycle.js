// DayNightCycle.js - Manages day/night cycle, lighting, and sky color

import { DAY_DURATION } from './GameConstants.js';

export class DayNightCycle {
    constructor(scene) {
        this.scene = scene;
        this.gameTime = DAY_DURATION / 2;
        
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);
        
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.sunLight.position.set(50, 100, 50);
        this.sunLight.castShadow = true;
        this.scene.add(this.sunLight);
    }

    update(dt, onDayComplete) {
        const timeFraction = this.gameTime / DAY_DURATION;
        const sunAngle = (timeFraction * Math.PI * 2) - Math.PI / 2;
        const sunY = Math.sin(sunAngle);

        // Speed up night time
        if (sunY < -0.1) {
            this.gameTime += dt * 3;
        } else {
            this.gameTime += dt;
        }

        if (this.gameTime > DAY_DURATION) {
            this.gameTime = 0;
            if (onDayComplete) onDayComplete();
        }
        
        // Update sun position
        this.sunLight.position.x = 50 * Math.cos(sunAngle);
        this.sunLight.position.y = 50 * Math.sin(sunAngle);
        this.sunLight.position.z = 20;

        // Update sky color
        let skyColor;
        if (sunY > 0) {
            skyColor = new THREE.Color(0x87CEEB).lerp(new THREE.Color(0x191970), 1 - sunY);
        } else {
            skyColor = new THREE.Color(0x191970).lerp(new THREE.Color(0x000000), -sunY);
        }
        
        this.scene.background = skyColor;
        this.scene.fog.color = skyColor;
        
        // Update light intensity
        this.sunLight.intensity = Math.max(0, sunY);
        this.ambientLight.intensity = Math.max(0.1, sunY * 0.4);
    }

    getGameTime() {
        return this.gameTime;
    }

    isNight() {
        return this.gameTime > DAY_DURATION * 0.75 || this.gameTime < DAY_DURATION * 0.25;
    }
}