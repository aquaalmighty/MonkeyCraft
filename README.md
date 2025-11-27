# 🐵 MonkeyCraft

A 3D voxel survival game where you defend a campfire from waves of monkeys! Built with Three.js and WebGL.

![MonkeyCraft Banner](https://img.shields.io/badge/Status-In%20Development-yellow) ![Three.js](https://img.shields.io/badge/Three.js-r128-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## 🎮 Play Now

**[Play MonkeyCraft →](https://aquaalmighty.github.io/MonkeyCraft/)**

## ✨ Features

- 🔥 **Defend the Campfire** - Keep the fire burning or face defeat in darkness
- 🌍 **Procedural World** - Explore a randomly generated voxel world
- 🐒 **Monkey AI** - Intelligent enemies that break blocks and attack
- 🌳 **Tree Growing** - Plant saplings and watch them grow into full trees
- 🌙 **Day/Night Cycle** - Dynamic lighting with increasing difficulty at night
- 🎒 **Inventory System** - Collect resources and manage your items
- ⚒️ **Mining & Crafting** - Break blocks and place them strategically
- 🍉 **Hunger System** - Eat watermelons to survive

## 🎯 Gameplay

### Objective
Protect the campfire from monkeys while managing your health and hunger. The fire slowly drains - refuel it with wood blocks to keep it alive!

### Controls
- **WASD** - Move
- **Mouse** - Look around
- **Left Click** - Mine blocks / Attack
- **Right Click** - Place blocks / Eat / Refuel fire
- **Space** - Jump
- **Shift** - Sprint
- **E** - Open inventory
- **1-5** - Select hotbar slots

### Tips
- Monkeys spawn more frequently at night
- Keep wood in your hotbar or offhand for quick refueling
- Plant saplings to grow more trees (takes 2 minutes)
- Leaves have a 20% chance to drop saplings when broken
- Use torches at night for visibility

## 🛠️ Technology Stack

- **Three.js (r128)** - 3D graphics rendering
- **WebGL** - Hardware-accelerated graphics
- **JavaScript ES6+** - Modular game architecture
- **HTML5 Canvas** - 2D UI overlays

## 📂 Project Structure

```
MonkeyCraft/
├── index.html              # Main entry point
├── css/
│   └── default.css        # Game styling
├── js/
│   ├── GameConstants.js   # Configuration & enums
│   ├── WorldEngine.js     # Terrain generation
│   ├── EntityManager.js   # Entities & AI
│   ├── PlayerController.js # Input & movement
│   ├── UIManager.js       # HUD & inventory
│   ├── DayNightCycle.js   # Lighting system
│   └── MonkeyCraft.js     # Main game loop
└── assets/
    ├── models/            # 3D models (GLB)
    └── textures/          # Textures (PNG)
```

## 🚀 Local Development

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge)
- A local web server (required for ES6 modules)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/MonkeyCraft.git
cd MonkeyCraft
```

2. **Start a local server**

**Option A: VS Code Live Server**
- Install the "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

**Option B: Python**
```bash
python -m http.server 8000
```

**Option C: Node.js**
```bash
npx http-server
```

3. **Open in browser**
- Navigate to `http://localhost:8000` (or the port shown)

## 🌐 Deploying to GitHub Pages

1. **Push your code to GitHub**
```bash
git add .
git commit -m "Deploy MonkeyCraft"
git push origin main
```

2. **Enable GitHub Pages**
- Go to repository **Settings** → **Pages**
- Set source to **main branch** and **/ (root)**
- Click **Save**

3. **Wait 1-2 minutes** for deployment
- Your game will be live at `https://YOUR_USERNAME.github.io/MonkeyCraft/`

## 🎨 Customization

### Adding New Blocks
Edit `js/GameConstants.js`:
```javascript
export const BLOCKS = {
    // ... existing blocks
    CUSTOM_BLOCK: 13
};

export const BLOCK_COLORS = {
    // ... existing colors
    [BLOCKS.CUSTOM_BLOCK]: '#FF00FF'
};
```

### Adjusting Difficulty
Modify spawn rates in `js/EntityManager.js`:
```javascript
let spawnRate = isNight ? 2.0 : 10.0; // Seconds between spawns
```

### Changing World Size
Edit `js/GameConstants.js`:
```javascript
export const WORLD_SIZE_CHUNKS = 6; // Increase for larger worlds
```

## 📝 Version History

### v7.0 (Current)
- ✅ Sapling system with growth timer
- ✅ Offhand inventory slot
- ✅ Improved monkey pathfinding
- ✅ Block-breaking AI for monkeys
- ✅ Campfire health system
- ✅ Day/night cycle

### Planned Features
- [ ] Multiplayer support
- [ ] More block types
- [ ] Crafting system
- [ ] Different biomes
- [ ] Boss monkeys

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by Minecraft's voxel mechanics
- Three.js community for excellent documentation
- PathTracedPong for project structure inspiration

## 📧 Contact

Your Name - [@yourtwitter](https://twitter.com/yourtwitter)

Project Link: [https://github.com/YOUR_USERNAME/MonkeyCraft](https://github.com/YOUR_USERNAME/MonkeyCraft)

---

**Made with ❤️ and 🍌 by AQUA Clipz**