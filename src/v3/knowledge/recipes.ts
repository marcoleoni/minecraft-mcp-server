/**
 * Minecraft crafting recipes knowledge base
 * Maps item names to their crafting requirements
 */

export interface Recipe {
  ingredients: Record<string, number>;
  result: number;  // How many items this recipe produces
  tool: 'crafting_table' | 'furnace' | 'hand' | null;  // null = can craft in inventory
}

export const RECIPES: Record<string, Recipe> = {
  // Wood processing
  'oak_planks': { ingredients: { 'oak_log': 1 }, result: 4, tool: null },
  'birch_planks': { ingredients: { 'birch_log': 1 }, result: 4, tool: null },
  'spruce_planks': { ingredients: { 'spruce_log': 1 }, result: 4, tool: null },
  'jungle_planks': { ingredients: { 'jungle_log': 1 }, result: 4, tool: null },
  'acacia_planks': { ingredients: { 'acacia_log': 1 }, result: 4, tool: null },
  'dark_oak_planks': { ingredients: { 'dark_oak_log': 1 }, result: 4, tool: null },
  'planks': { ingredients: { 'log': 1 }, result: 4, tool: null },  // Generic alias

  // Sticks
  'stick': { ingredients: { 'planks': 2 }, result: 4, tool: null },

  // Tools - Wooden
  'wooden_pickaxe': { ingredients: { 'planks': 3, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'wooden_axe': { ingredients: { 'planks': 3, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'wooden_shovel': { ingredients: { 'planks': 1, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'wooden_sword': { ingredients: { 'planks': 2, 'stick': 1 }, result: 1, tool: 'crafting_table' },
  'wooden_hoe': { ingredients: { 'planks': 2, 'stick': 2 }, result: 1, tool: 'crafting_table' },

  // Tools - Stone
  'stone_pickaxe': { ingredients: { 'cobblestone': 3, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'stone_axe': { ingredients: { 'cobblestone': 3, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'stone_shovel': { ingredients: { 'cobblestone': 1, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'stone_sword': { ingredients: { 'cobblestone': 2, 'stick': 1 }, result: 1, tool: 'crafting_table' },
  'stone_hoe': { ingredients: { 'cobblestone': 2, 'stick': 2 }, result: 1, tool: 'crafting_table' },

  // Tools - Iron
  'iron_pickaxe': { ingredients: { 'iron_ingot': 3, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'iron_axe': { ingredients: { 'iron_ingot': 3, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'iron_shovel': { ingredients: { 'iron_ingot': 1, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'iron_sword': { ingredients: { 'iron_ingot': 2, 'stick': 1 }, result: 1, tool: 'crafting_table' },
  'iron_hoe': { ingredients: { 'iron_ingot': 2, 'stick': 2 }, result: 1, tool: 'crafting_table' },

  // Tools - Diamond
  'diamond_pickaxe': { ingredients: { 'diamond': 3, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'diamond_axe': { ingredients: { 'diamond': 3, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'diamond_shovel': { ingredients: { 'diamond': 1, 'stick': 2 }, result: 1, tool: 'crafting_table' },
  'diamond_sword': { ingredients: { 'diamond': 2, 'stick': 1 }, result: 1, tool: 'crafting_table' },
  'diamond_hoe': { ingredients: { 'diamond': 2, 'stick': 2 }, result: 1, tool: 'crafting_table' },

  // Crafting stations
  'crafting_table': { ingredients: { 'planks': 4 }, result: 1, tool: null },
  'furnace': { ingredients: { 'cobblestone': 8 }, result: 1, tool: 'crafting_table' },
  'chest': { ingredients: { 'planks': 8 }, result: 1, tool: 'crafting_table' },

  // Torches
  'torch': { ingredients: { 'coal': 1, 'stick': 1 }, result: 4, tool: null },

  // Armor - Iron
  'iron_helmet': { ingredients: { 'iron_ingot': 5 }, result: 1, tool: 'crafting_table' },
  'iron_chestplate': { ingredients: { 'iron_ingot': 8 }, result: 1, tool: 'crafting_table' },
  'iron_leggings': { ingredients: { 'iron_ingot': 7 }, result: 1, tool: 'crafting_table' },
  'iron_boots': { ingredients: { 'iron_ingot': 4 }, result: 1, tool: 'crafting_table' },

  // Armor - Diamond
  'diamond_helmet': { ingredients: { 'diamond': 5 }, result: 1, tool: 'crafting_table' },
  'diamond_chestplate': { ingredients: { 'diamond': 8 }, result: 1, tool: 'crafting_table' },
  'diamond_leggings': { ingredients: { 'diamond': 7 }, result: 1, tool: 'crafting_table' },
  'diamond_boots': { ingredients: { 'diamond': 4 }, result: 1, tool: 'crafting_table' },

  // Building blocks
  'stone_bricks': { ingredients: { 'stone': 4 }, result: 4, tool: 'crafting_table' },
  'bricks': { ingredients: { 'brick': 4 }, result: 1, tool: 'crafting_table' },

  // Misc
  'bucket': { ingredients: { 'iron_ingot': 3 }, result: 1, tool: 'crafting_table' },
  'bowl': { ingredients: { 'planks': 3 }, result: 4, tool: null },
  'bread': { ingredients: { 'wheat': 3 }, result: 1, tool: 'crafting_table' },
  'bed': { ingredients: { 'planks': 3, 'wool': 3 }, result: 1, tool: 'crafting_table' },
  'ladder': { ingredients: { 'stick': 7 }, result: 3, tool: 'crafting_table' },
  'door': { ingredients: { 'planks': 6 }, result: 3, tool: 'crafting_table' },
  'fence': { ingredients: { 'planks': 4, 'stick': 2 }, result: 3, tool: 'crafting_table' },
};

// Smelting recipes (furnace)
export const SMELTING: Record<string, { input: string; fuel?: number }> = {
  'iron_ingot': { input: 'raw_iron' },
  'gold_ingot': { input: 'raw_gold' },
  'copper_ingot': { input: 'raw_copper' },
  'glass': { input: 'sand' },
  'stone': { input: 'cobblestone' },
  'smooth_stone': { input: 'stone' },
  'brick': { input: 'clay_ball' },
  'charcoal': { input: 'log' },
  'cooked_beef': { input: 'beef' },
  'cooked_porkchop': { input: 'porkchop' },
  'cooked_chicken': { input: 'chicken' },
  'cooked_mutton': { input: 'mutton' },
  'cooked_cod': { input: 'cod' },
  'cooked_salmon': { input: 'salmon' },
};

/**
 * Find a recipe for an item
 */
export function findRecipe(item: string): Recipe | null {
  return RECIPES[item] || null;
}

/**
 * Find smelting recipe for an item
 */
export function findSmeltingRecipe(item: string): { input: string; fuel?: number } | null {
  return SMELTING[item] || null;
}

/**
 * Get all planks types (for generic 'planks' requests)
 */
export function getPlanksTypes(): string[] {
  return ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks'];
}

/**
 * Get all log types
 */
export function getLogTypes(): string[] {
  return ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'];
}
