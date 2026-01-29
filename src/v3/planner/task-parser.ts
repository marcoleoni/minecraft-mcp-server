/**
 * Task Parser
 * Converts natural language commands into structured tasks
 */

export type TaskType =
  | 'build'
  | 'mine'
  | 'gather'
  | 'craft'
  | 'navigate'
  | 'follow'
  | 'attack'
  | 'eat'
  | 'equip'
  | 'unknown';

export interface ParsedTask {
  type: TaskType;
  params: Record<string, any>;
  originalText: string;
}

interface TaskPattern {
  pattern: RegExp;
  type: TaskType;
  extractParams: (match: RegExpMatchArray) => Record<string, any>;
}

// List of known materials to help with parsing
const KNOWN_MATERIALS = [
  'cobblestone', 'stone', 'cobble', 'brick', 'bricks', 'stone_bricks',
  'oak', 'birch', 'spruce', 'jungle', 'acacia', 'dark_oak', 'wood', 'wooden', 'planks',
  'oak_planks', 'birch_planks', 'spruce_planks', 'oak_log', 'birch_log',
  'dirt', 'sand', 'sandstone', 'glass', 'wool', 'clay', 'terracotta',
  'iron', 'gold', 'diamond', 'emerald', 'obsidian', 'netherrack', 'quartz',
  'granite', 'diorite', 'andesite', 'deepslate', 'copper', 'prismarine',
];

// Words to ignore as material names
const IGNORED_WORDS = ['a', 'an', 'the', 'small', 'big', 'large', 'tiny', 'huge', 'simple', 'basic', 'nice'];

const TASK_PATTERNS: TaskPattern[] = [
  // Building - with "made of/from/with" syntax (highest priority)
  {
    pattern: /build\s+(?:a\s+)?(?:\w+\s+)?(?:\d+\s*x\s*\d+\s+)?(house|hut|shelter|cabin)\s+(?:made\s+)?(?:of|from|with|using)\s+(\w+)/i,
    type: 'build',
    extractParams: (m) => ({
      structure: 'house',
      width: 5,
      depth: 5,
      material: m[2].toLowerCase(),
    }),
  },
  // Building - NxN material house
  {
    pattern: /build\s+(?:a\s+)?(?:small\s+)?(\d+)\s*x\s*(\d+)\s+(\w+)\s+(house|hut|shelter|cabin)/i,
    type: 'build',
    extractParams: (m) => ({
      structure: 'house',
      width: parseInt(m[1]),
      depth: parseInt(m[2]),
      material: m[3].toLowerCase(),
    }),
  },
  // Building - material house (e.g., "cobblestone house", "oak_planks house")
  {
    pattern: /build\s+(?:a\s+)?(?:small\s+|big\s+|large\s+)?(\w+(?:_\w+)?)\s+(house|hut|shelter|cabin)/i,
    type: 'build',
    extractParams: (m) => {
      const potentialMaterial = m[1].toLowerCase();
      // Check if it's actually a material or just a size word
      const isMaterial = KNOWN_MATERIALS.some(mat => potentialMaterial.includes(mat)) ||
                         potentialMaterial.includes('_') ||
                         !IGNORED_WORDS.includes(potentialMaterial);
      return {
        structure: 'house',
        width: 5,
        depth: 5,
        material: isMaterial && !IGNORED_WORDS.includes(potentialMaterial) ? potentialMaterial : 'cobblestone',
      };
    },
  },
  // Building - simple "build a house" (default material)
  {
    pattern: /build\s+(?:a\s+)?(?:small\s+|big\s+|large\s+)?(house|hut|shelter|cabin)$/i,
    type: 'build',
    extractParams: (m) => ({
      structure: 'house',
      width: 5,
      depth: 5,
      material: 'cobblestone',
    }),
  },
  // Building - walls/towers with dimensions
  {
    pattern: /build\s+(?:a\s+)?(\d+)\s*(?:block\s+)?(?:tall\s+)?(\w+)\s+(wall|tower)/i,
    type: 'build',
    extractParams: (m) => ({
      structure: m[3].toLowerCase(),
      height: parseInt(m[1]),
      material: m[2].toLowerCase(),
    }),
  },
  // Building - material wall/floor/etc
  {
    pattern: /build\s+(?:a\s+)?(\w+(?:_\w+)?)\s+(wall|floor|platform|bridge|tower)/i,
    type: 'build',
    extractParams: (m) => ({
      structure: m[2].toLowerCase(),
      material: m[1].toLowerCase(),
      length: 5,
      width: 3,
    }),
  },
  // Placing blocks
  {
    pattern: /place\s+(\d+)\s+(\w+(?:_\w+)?)/i,
    type: 'build',
    extractParams: (m) => ({
      structure: 'custom',
      quantity: parseInt(m[1]),
      material: m[2].toLowerCase(),
    }),
  },

  // Mining
  {
    pattern: /mine\s+(\d+)\s+(\w+)/i,
    type: 'mine',
    extractParams: (m) => ({
      quantity: parseInt(m[1]),
      block: m[2].toLowerCase(),
    }),
  },
  {
    pattern: /mine\s+(?:some\s+)?(\w+)/i,
    type: 'mine',
    extractParams: (m) => ({
      quantity: 10,
      block: m[1].toLowerCase(),
    }),
  },
  {
    pattern: /dig\s+down\s+(\d+)/i,
    type: 'mine',
    extractParams: (m) => ({
      quantity: parseInt(m[1]),
      direction: 'down',
    }),
  },

  // Gathering
  {
    pattern: /gather\s+(\d+)\s+(\w+)/i,
    type: 'gather',
    extractParams: (m) => ({
      quantity: parseInt(m[1]),
      item: m[2].toLowerCase(),
    }),
  },
  {
    pattern: /collect\s+(\d+)\s+(\w+)/i,
    type: 'gather',
    extractParams: (m) => ({
      quantity: parseInt(m[1]),
      item: m[2].toLowerCase(),
    }),
  },
  {
    pattern: /get\s+(\d+)\s+(\w+)/i,
    type: 'gather',
    extractParams: (m) => ({
      quantity: parseInt(m[1]),
      item: m[2].toLowerCase(),
    }),
  },
  {
    pattern: /get\s+(?:some\s+)?(\w+)/i,
    type: 'gather',
    extractParams: (m) => ({
      quantity: 10,
      item: m[1].toLowerCase(),
    }),
  },

  // Crafting
  {
    pattern: /craft\s+(\d+)\s+(\w+)/i,
    type: 'craft',
    extractParams: (m) => ({
      quantity: parseInt(m[1]),
      item: m[2].toLowerCase(),
    }),
  },
  {
    pattern: /craft\s+(?:a\s+)?(\w+)/i,
    type: 'craft',
    extractParams: (m) => ({
      quantity: 1,
      item: m[1].toLowerCase(),
    }),
  },
  {
    pattern: /make\s+(\d+)\s+(\w+)/i,
    type: 'craft',
    extractParams: (m) => ({
      quantity: parseInt(m[1]),
      item: m[2].toLowerCase(),
    }),
  },
  {
    pattern: /make\s+(?:a\s+)?(\w+)/i,
    type: 'craft',
    extractParams: (m) => ({
      quantity: 1,
      item: m[1].toLowerCase(),
    }),
  },

  // Navigation
  {
    pattern: /go\s+to\s+(-?\d+)\s*[,\s]+\s*(-?\d+)\s*[,\s]+\s*(-?\d+)/i,
    type: 'navigate',
    extractParams: (m) => ({
      x: parseInt(m[1]),
      y: parseInt(m[2]),
      z: parseInt(m[3]),
    }),
  },
  {
    pattern: /come\s+(?:here|to\s+me)/i,
    type: 'navigate',
    extractParams: () => ({ toPlayer: true }),
  },
  {
    pattern: /move\s+to\s+(-?\d+)\s*[,\s]+\s*(-?\d+)\s*[,\s]+\s*(-?\d+)/i,
    type: 'navigate',
    extractParams: (m) => ({
      x: parseInt(m[1]),
      y: parseInt(m[2]),
      z: parseInt(m[3]),
    }),
  },

  // Following
  {
    pattern: /follow\s+(?:me|player\s+)?(\w+)?/i,
    type: 'follow',
    extractParams: (m) => ({
      target: m[1]?.toLowerCase() || 'player',
    }),
  },
  {
    pattern: /stop\s+follow/i,
    type: 'follow',
    extractParams: () => ({ stop: true }),
  },

  // Combat
  {
    pattern: /kill\s+(?:all\s+)?(?:the\s+)?(?:nearby\s+)?(\w+)/i,
    type: 'attack',
    extractParams: (m) => ({
      target: m[1].toLowerCase(),
      all: true,
    }),
  },
  {
    pattern: /attack\s+(?:the\s+)?(\w+)/i,
    type: 'attack',
    extractParams: (m) => ({
      target: m[1].toLowerCase(),
      all: false,
    }),
  },
  {
    pattern: /hunt\s+(\w+)/i,
    type: 'attack',
    extractParams: (m) => ({
      target: m[1].toLowerCase(),
      all: true,
    }),
  },

  // Eating
  {
    pattern: /eat\s+(?:some\s+)?(?:food)?/i,
    type: 'eat',
    extractParams: () => ({}),
  },
  {
    pattern: /eat\s+(\w+)/i,
    type: 'eat',
    extractParams: (m) => ({
      food: m[1].toLowerCase(),
    }),
  },

  // Equipping
  {
    pattern: /equip\s+(?:the\s+)?(\w+)/i,
    type: 'equip',
    extractParams: (m) => ({
      item: m[1].toLowerCase(),
    }),
  },
  {
    pattern: /hold\s+(?:the\s+)?(\w+)/i,
    type: 'equip',
    extractParams: (m) => ({
      item: m[1].toLowerCase(),
    }),
  },
];

/**
 * Parse a natural language task into a structured format
 */
export function parseTask(text: string): ParsedTask {
  const normalizedText = text.trim();

  for (const { pattern, type, extractParams } of TASK_PATTERNS) {
    const match = normalizedText.match(pattern);
    if (match) {
      return {
        type,
        params: extractParams(match),
        originalText: normalizedText,
      };
    }
  }

  return {
    type: 'unknown',
    params: { text: normalizedText },
    originalText: normalizedText,
  };
}

/**
 * Normalize block/item names
 * Handles common variations and aliases
 */
export function normalizeItemName(name: string): string {
  const normalized = name.toLowerCase().replace(/\s+/g, '_');

  const aliases: Record<string, string> = {
    'wood': 'oak_log',
    'log': 'oak_log',
    'logs': 'oak_log',
    'tree': 'oak_log',
    'cobble': 'cobblestone',
    'stone_brick': 'stone_bricks',
    'plank': 'oak_planks',
    'planks': 'oak_planks',
    'workbench': 'crafting_table',
    'pick': 'wooden_pickaxe',
    'pickaxe': 'wooden_pickaxe',
    'sword': 'wooden_sword',
    'axe': 'wooden_axe',
    'iron': 'iron_ore',
    'diamond': 'diamond_ore',
    'coal': 'coal_ore',
    'gold': 'gold_ore',
    'dirt_block': 'dirt',
  };

  return aliases[normalized] || normalized;
}

/**
 * Get suggestions for unknown tasks
 */
export function getSuggestions(text: string): string[] {
  const suggestions: string[] = [];
  const lower = text.toLowerCase();

  if (lower.includes('house') || lower.includes('build')) {
    suggestions.push('build a 5x5 cobblestone house');
    suggestions.push('build a small wooden house');
  }
  if (lower.includes('mine') || lower.includes('dig')) {
    suggestions.push('mine 10 stone');
    suggestions.push('mine 5 iron_ore');
  }
  if (lower.includes('wood') || lower.includes('tree')) {
    suggestions.push('gather 10 oak_log');
    suggestions.push('mine 20 wood');
  }
  if (lower.includes('tool') || lower.includes('craft')) {
    suggestions.push('craft a wooden_pickaxe');
    suggestions.push('craft 10 sticks');
  }

  if (suggestions.length === 0) {
    suggestions.push(
      'build a 5x5 cobblestone house',
      'mine 10 stone',
      'gather 20 wood',
      'craft a wooden_pickaxe',
      'go to 100, 64, 100',
      'follow me'
    );
  }

  return suggestions;
}
