// GameConstants.js - All game configuration and constants

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 32;
export const WORLD_SIZE_CHUNKS = 6;
export const TEXTURE_SIZE = 16;
export const HOTBAR_SLOTS = 5;

// Physics
export const GRAVITY = 30;
export const SPEED = 5;
export const SPRINT_SPEED = 8;
export const JUMP_FORCE = 10;

// Player stats
export const MAX_HP = 10;
export const MAX_HUNGER = 10;

// Day/Night cycle

//REGULAR CONSTANTS

//export const DAY_DURATION = 300;

//export const SECONDS_BEFORE_MONKEYS = 60; // Time before monkeys start spawning

//export const SAPLING_GROWTH_TIME = 60; // in seconds

//TESTING CONSTANTS

export const DAY_DURATION = 900;

export const SECONDS_BEFORE_MONKEYS = 900; // Time before monkeys start spawning

export const SAPLING_GROWTH_TIME = 20; // in seconds

// Block types enum
export const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    PLANKS: 6,
    BEDROCK: 7,
    WATERMELON: 8,
    SWORD: 9,
    PICKAXE: 10,
    TORCH: 11,
    SAPLING: 12
};

// Block visual colors
export const BLOCK_COLORS = {
    [BLOCKS.GRASS]: '#567d46',
    [BLOCKS.DIRT]: '#5c4033',
    [BLOCKS.STONE]: '#7d7d7d',
    [BLOCKS.WOOD]: '#6b5344',
    [BLOCKS.LEAVES]: '#2d5a27',
    [BLOCKS.PLANKS]: '#966f33',
    [BLOCKS.BEDROCK]: '#222',
    [BLOCKS.WATERMELON]: '#80b80f',
    [BLOCKS.SWORD]: '#cccccc',
    [BLOCKS.PICKAXE]: '#888888',
    [BLOCKS.TORCH]: '#FFD700',
    [BLOCKS.SAPLING]: '#2d5a27'
};

// Cube face definitions for mesh generation
export const CUBE_FACES = {
    '+z': [0,0,1, 1,0,1, 0,1,1, 1,1,1],
    '-z': [1,0,0, 0,0,0, 1,1,0, 0,1,0],
    '+y': [0,1,1, 1,1,1, 0,1,0, 1,1,0],
    '-y': [0,0,0, 1,0,0, 0,0,1, 1,0,1],
    '+x': [1,0,1, 1,0,0, 1,1,1, 1,1,0],
    '-x': [0,0,0, 0,0,1, 0,1,0, 0,1,1]
};