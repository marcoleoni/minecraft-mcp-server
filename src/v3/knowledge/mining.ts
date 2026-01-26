/**
 * Minecraft mining knowledge base
 * Maps blocks to their mining requirements and drops
 */

export type ToolTier = 'hand' | 'wooden' | 'stone' | 'iron' | 'diamond' | 'netherite';
export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'sword' | 'shears' | 'none';

export interface MiningInfo {
  tool: ToolType;           // Best tool type
  minTier: ToolTier;        // Minimum tier required (or 'hand' if no tool needed)
  drops: string;            // What it drops
  dropQuantity?: number;    // How many (default 1)
  silkTouch?: string;       // What it drops with silk touch (if different)
  hardness: number;         // Relative mining time (lower = faster)
}

export const MINING_INFO: Record<string, MiningInfo> = {
  // Logs - no tool required
  'oak_log': { tool: 'axe', minTier: 'hand', drops: 'oak_log', hardness: 2 },
  'birch_log': { tool: 'axe', minTier: 'hand', drops: 'birch_log', hardness: 2 },
  'spruce_log': { tool: 'axe', minTier: 'hand', drops: 'spruce_log', hardness: 2 },
  'jungle_log': { tool: 'axe', minTier: 'hand', drops: 'jungle_log', hardness: 2 },
  'acacia_log': { tool: 'axe', minTier: 'hand', drops: 'acacia_log', hardness: 2 },
  'dark_oak_log': { tool: 'axe', minTier: 'hand', drops: 'dark_oak_log', hardness: 2 },

  // Dirt/Sand - shovel recommended
  'dirt': { tool: 'shovel', minTier: 'hand', drops: 'dirt', hardness: 0.5 },
  'grass_block': { tool: 'shovel', minTier: 'hand', drops: 'dirt', silkTouch: 'grass_block', hardness: 0.6 },
  'sand': { tool: 'shovel', minTier: 'hand', drops: 'sand', hardness: 0.5 },
  'gravel': { tool: 'shovel', minTier: 'hand', drops: 'gravel', hardness: 0.6 },
  'clay': { tool: 'shovel', minTier: 'hand', drops: 'clay_ball', dropQuantity: 4, hardness: 0.6 },

  // Stone - pickaxe required
  'stone': { tool: 'pickaxe', minTier: 'wooden', drops: 'cobblestone', silkTouch: 'stone', hardness: 1.5 },
  'cobblestone': { tool: 'pickaxe', minTier: 'wooden', drops: 'cobblestone', hardness: 2 },
  'deepslate': { tool: 'pickaxe', minTier: 'wooden', drops: 'cobbled_deepslate', silkTouch: 'deepslate', hardness: 3 },
  'cobbled_deepslate': { tool: 'pickaxe', minTier: 'wooden', drops: 'cobbled_deepslate', hardness: 3.5 },
  'andesite': { tool: 'pickaxe', minTier: 'wooden', drops: 'andesite', hardness: 1.5 },
  'diorite': { tool: 'pickaxe', minTier: 'wooden', drops: 'diorite', hardness: 1.5 },
  'granite': { tool: 'pickaxe', minTier: 'wooden', drops: 'granite', hardness: 1.5 },

  // Ores - Coal & Iron (wooden pickaxe)
  'coal_ore': { tool: 'pickaxe', minTier: 'wooden', drops: 'coal', hardness: 3 },
  'deepslate_coal_ore': { tool: 'pickaxe', minTier: 'wooden', drops: 'coal', hardness: 4.5 },
  'iron_ore': { tool: 'pickaxe', minTier: 'stone', drops: 'raw_iron', hardness: 3 },
  'deepslate_iron_ore': { tool: 'pickaxe', minTier: 'stone', drops: 'raw_iron', hardness: 4.5 },
  'copper_ore': { tool: 'pickaxe', minTier: 'stone', drops: 'raw_copper', dropQuantity: 3, hardness: 3 },
  'deepslate_copper_ore': { tool: 'pickaxe', minTier: 'stone', drops: 'raw_copper', dropQuantity: 3, hardness: 4.5 },

  // Ores - Gold & Redstone & Lapis (iron pickaxe)
  'gold_ore': { tool: 'pickaxe', minTier: 'iron', drops: 'raw_gold', hardness: 3 },
  'deepslate_gold_ore': { tool: 'pickaxe', minTier: 'iron', drops: 'raw_gold', hardness: 4.5 },
  'redstone_ore': { tool: 'pickaxe', minTier: 'iron', drops: 'redstone', dropQuantity: 4, hardness: 3 },
  'deepslate_redstone_ore': { tool: 'pickaxe', minTier: 'iron', drops: 'redstone', dropQuantity: 4, hardness: 4.5 },
  'lapis_ore': { tool: 'pickaxe', minTier: 'stone', drops: 'lapis_lazuli', dropQuantity: 6, hardness: 3 },
  'deepslate_lapis_ore': { tool: 'pickaxe', minTier: 'stone', drops: 'lapis_lazuli', dropQuantity: 6, hardness: 4.5 },

  // Ores - Diamond & Emerald (iron pickaxe)
  'diamond_ore': { tool: 'pickaxe', minTier: 'iron', drops: 'diamond', hardness: 3 },
  'deepslate_diamond_ore': { tool: 'pickaxe', minTier: 'iron', drops: 'diamond', hardness: 4.5 },
  'emerald_ore': { tool: 'pickaxe', minTier: 'iron', drops: 'emerald', hardness: 3 },
  'deepslate_emerald_ore': { tool: 'pickaxe', minTier: 'iron', drops: 'emerald', hardness: 4.5 },

  // Obsidian (diamond pickaxe)
  'obsidian': { tool: 'pickaxe', minTier: 'diamond', drops: 'obsidian', hardness: 50 },

  // Crafted blocks
  'crafting_table': { tool: 'axe', minTier: 'hand', drops: 'crafting_table', hardness: 2.5 },
  'chest': { tool: 'axe', minTier: 'hand', drops: 'chest', hardness: 2.5 },
  'furnace': { tool: 'pickaxe', minTier: 'wooden', drops: 'furnace', hardness: 3.5 },

  // Leaves
  'oak_leaves': { tool: 'shears', minTier: 'hand', drops: 'stick', hardness: 0.2 },
  'birch_leaves': { tool: 'shears', minTier: 'hand', drops: 'stick', hardness: 0.2 },
  'spruce_leaves': { tool: 'shears', minTier: 'hand', drops: 'stick', hardness: 0.2 },
};

// Tool tier hierarchy
const TIER_LEVEL: Record<ToolTier, number> = {
  'hand': 0,
  'wooden': 1,
  'stone': 2,
  'iron': 3,
  'diamond': 4,
  'netherite': 5,
};

/**
 * Check if a tool tier is sufficient for mining a block
 */
export function canMineWith(blockTier: ToolTier, toolTier: ToolTier): boolean {
  return TIER_LEVEL[toolTier] >= TIER_LEVEL[blockTier];
}

/**
 * Get the tool item name for a tier and type
 */
export function getToolName(tier: ToolTier, type: ToolType): string | null {
  if (tier === 'hand' || type === 'none') return null;
  if (type === 'shears') return 'shears';
  return `${tier}_${type}`;
}

/**
 * Get mining info for a block
 */
export function getMiningInfo(block: string): MiningInfo | null {
  return MINING_INFO[block] || null;
}

/**
 * Find the minimum pickaxe tier needed for an item
 */
export function getRequiredPickaxeTier(item: string): ToolTier {
  // Find any block that drops this item
  for (const [block, info] of Object.entries(MINING_INFO)) {
    if (info.drops === item && info.tool === 'pickaxe') {
      return info.minTier;
    }
  }
  return 'hand';
}

/**
 * Find blocks that drop a specific item
 */
export function findBlocksThatDrop(item: string): string[] {
  const blocks: string[] = [];
  for (const [block, info] of Object.entries(MINING_INFO)) {
    if (info.drops === item) {
      blocks.push(block);
    }
  }
  return blocks;
}

/**
 * Get the best available pickaxe from inventory items
 */
export function getBestPickaxe(inventoryItems: string[]): { name: string; tier: ToolTier } | null {
  const pickaxes: [string, ToolTier][] = [
    ['netherite_pickaxe', 'netherite'],
    ['diamond_pickaxe', 'diamond'],
    ['iron_pickaxe', 'iron'],
    ['stone_pickaxe', 'stone'],
    ['wooden_pickaxe', 'wooden'],
  ];

  for (const [name, tier] of pickaxes) {
    if (inventoryItems.includes(name)) {
      return { name, tier };
    }
  }
  return null;
}

/**
 * Get the best available axe from inventory items
 */
export function getBestAxe(inventoryItems: string[]): { name: string; tier: ToolTier } | null {
  const axes: [string, ToolTier][] = [
    ['netherite_axe', 'netherite'],
    ['diamond_axe', 'diamond'],
    ['iron_axe', 'iron'],
    ['stone_axe', 'stone'],
    ['wooden_axe', 'wooden'],
  ];

  for (const [name, tier] of axes) {
    if (inventoryItems.includes(name)) {
      return { name, tier };
    }
  }
  return null;
}
