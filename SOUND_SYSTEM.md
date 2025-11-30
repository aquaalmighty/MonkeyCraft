# MonkeyCraft Sound Manager - Implementation Guide

## Overview

The Sound Manager is a comprehensive audio system for MonkeyCraft that handles both spatial (3D) and non-spatial audio playback with advanced features like pitch variation and intelligent sound sequencing.

## Files Created/Modified

### New Files
1. **js/SoundManager.js** - Main sound manager class
2. **assets/sounds/SoundConfig.json** - Sound configuration file

### Modified Files
1. **js/MonkeyCraft.js** - Initializes SoundManager and passes it to subsystems
2. **js/PlayerController.js** - Uses SoundManager for walking, mining, block placement, and item pickup
3. **js/EntityManager.js** - Uses SoundManager for entity interactions

## Configuration

The sound system is configured via `assets/sounds/SoundConfig.json`:

```json
{
  "sounds": {
    "soundName": {
      "path": "assets/sounds/filename.mp3",
      "volume": 0.7,
      "spatial": true,
      "variablePitch": true,
      "pitchVariation": 0.15
    }
  },
  "pitchSeed": 12345,
  "sequenceSeed": 54321
}
```

### Sound Properties

- **path**: Path to the audio file (relative to project root)
- **volume**: Volume level (0.0 - 1.0)
- **spatial**: Whether sound is 3D positional (true) or listener-relative (false)
- **variablePitch**: Whether sound should have random pitch variations
- **pitchVariation**: Range of pitch variation as a decimal (0.1 = ±10%)

## Implemented Sounds

### Non-Spatial (Listener-Relative)
- **swingsword** - Sword swing attack (non-spatial)
- **pickupitem** - Item pickup (non-spatial)
- **walk1-4** - Walking sounds with random sequencing and pitch variation

### Spatial (3D Positional)
- **breakblock** - Block break event
- **placeblock** - Block placement event
- **hitEntity** - Entity hit/damage sound
- **mine1-2** - Mining/block breaking sounds with random sequencing and pitch variation

## Features

### 1. Spatial Audio
Uses THREE.js PositionalAudio for 3D sound placement. Sounds play louder when closer to the player and fade with distance.

**Configuration:**
- Reference distance: 5 blocks
- Max distance: 50 blocks
- Rolloff factor: 1 (linear attenuation)

### 2. Non-Spatial Audio
Uses THREE.js Audio for listener-relative playback, unaffected by position.

### 3. Pitch Variation
Slight random pitch variations make repetitive sounds less noticeable:
- Supports configurable variation range
- Uses seeded random for reproducibility
- Applied to: walking sounds, mining sounds

### 4. Sound Sequencing
Walking and mining sounds play in randomized order from a predefined set:
- **Walking**: Cycles through walk1, walk2, walk3, walk4
- **Mining**: Cycles through mine1, mine2
- Uses seeded sequence randomization for reproducibility
- Avoids immediate repetition

### 5. Volume Control
Each sound has individual volume configuration and runtime override capability.

## Usage Examples

### Playing Sounds from Code

```javascript
// Play a non-spatial sound (e.g., sword swing)
soundManager.playSwingSwordSound();

// Play a spatial sound at a specific location
soundManager.playBreakBlockSound(new THREE.Vector3(x, y, z));

// Play walking sound (auto-sequenced and pitch-varied)
soundManager.playWalkSound();

// Play mining sound (auto-sequenced and pitch-varied)
soundManager.playMineSound(new THREE.Vector3(x, y, z));

// Override volume for a specific play
soundManager.play('swingsword', null, 1.0); // Max volume
```

## Integration Points

### PlayerController
- **Walking**: Plays every 600ms (normal) or 400ms (sprinting) when moving on ground
- **Sword swing**: Plays on sword attack
- **Mining**: Plays when block is successfully mined
- **Block placement**: Plays at placement location
- **Item pickup**: Plays on auto-loot

### EntityManager
- **Monkey hit**: Plays when struck by player
- **Block break**: Plays when monkey breaks a block

## Customization

### Changing Audio Files
Edit `assets/sounds/SoundConfig.json` to point to different audio files or adjust volumes.

### Adjusting Seeds
Modify `pitchSeed` and `sequenceSeed` in the config file to change pitch variation and sound sequencing patterns.

### Adding New Sounds
1. Add audio file to `assets/sounds/`
2. Add entry to SoundConfig.json
3. Use `soundManager.play(soundName, position, volumeOverride)` in code

### Runtime Adjustments
```javascript
// Change pitch variation seed
soundManager.setPitchSeed(54321);

// Change sequence seed
soundManager.setSequenceSeed(12345);

// Adjust master volume
soundManager.setMasterVolume(0.8);
```

## Technical Details

### Seeded Random Number Generation
Uses a custom seeded random function for reproducible randomization:
- Enables consistent gameplay across sessions
- Different seeds produce different sequences while maintaining gameplay consistency

### Audio Cleanup
- Sounds are automatically removed from the scene after playback completes
- Prevents memory leaks from accumulated audio nodes
- Tracked via `soundInstances` array

### Browser Compatibility
Requires:
- WebGL support (for THREE.js)
- Web Audio API support
- Modern browser with AudioContext support

## Performance Considerations

- Audio buffers are loaded once during initialization
- Maximum concurrent sounds depends on browser AudioContext capabilities (typically 16-32)
- Spatial audio has negligible CPU impact compared to rendering
- Seeded random calculations are instantaneous

## Troubleshooting

### No Sound Playing
1. Check browser console for load errors in SoundConfig.json
2. Verify audio files exist at specified paths
3. Ensure browser permissions allow audio playback
4. Check system volume and browser volume controls

### Sound Not Spatial
Verify `spatial: true` in SoundConfig.json for that sound and provide a position argument.

### Inconsistent Pitch Variation
Ensure `variablePitch: true` in config and desired `pitchVariation` value is set (0.1-0.2 recommended).

## Future Enhancements

- Music system with dynamic layering
- Ambient sound zones
- Echo/reverb effects based on environment
- Footstep audio based on block type
- Distance-based audio compression for far sounds
