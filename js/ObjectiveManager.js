// ObjectiveManager.js - Manages game objectives and tasks

export class ObjectiveManager {
    constructor() {
        this.objectives = [];
        this.currentObjectiveIndex = -1;
        this.timeRemaining = 0;
        this.objectiveNameElement = document.getElementById('objective-name');
        this.objectiveTimerElement = document.getElementById('objective-timer');
    }

    addObjective(name, duration, onComplete) {
        this.objectives.push({
            name: name,
            duration: duration,
            onComplete: onComplete,
            hasTimer: duration > 0
        });
    }

    start() {
        if (this.objectives.length === 0) return;
        
        this.currentObjectiveIndex = 0;
        this.setCurrentObjective();
    }

    setCurrentObjective() {
        if (this.currentObjectiveIndex >= this.objectives.length) {
            this.updateDisplay('', '');
            return;
        }

        const objective = this.objectives[this.currentObjectiveIndex];
        this.timeRemaining = objective.duration;
        this.updateDisplay(objective.name, this.formatTime(this.timeRemaining));
    }

    update(dt) {
        if (this.currentObjectiveIndex < 0 || this.currentObjectiveIndex >= this.objectives.length) {
            return;
        }

        const objective = this.objectives[this.currentObjectiveIndex];

        if (objective.hasTimer) {
            this.timeRemaining -= dt;

            if (this.timeRemaining <= 0) {
                this.timeRemaining = 0;
                this.updateDisplay(objective.name, this.formatTime(0));
                
                // Execute completion callback
                if (objective.onComplete) {
                    objective.onComplete();
                }

                // Move to next objective
                this.currentObjectiveIndex++;
                this.setCurrentObjective();
            } else {
                this.updateDisplay(objective.name, this.formatTime(this.timeRemaining));
            }
        } else {
            // No timer, just display the objective name
            this.updateDisplay(objective.name, '');
        }
    }

    updateDisplay(name, timer) {
        this.objectiveNameElement.textContent = name;
        this.objectiveTimerElement.textContent = timer;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    getCurrentObjective() {
        if (this.currentObjectiveIndex >= 0 && this.currentObjectiveIndex < this.objectives.length) {
            return this.objectives[this.currentObjectiveIndex];
        }
        return null;
    }

    isObjectiveActive(name) {
        const current = this.getCurrentObjective();
        return current && current.name === name;
    }
}
