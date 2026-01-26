/**
 * Dependency Resolver
 * Figures out what steps are needed to obtain items or complete goals
 */

import {
  findRecipe,
  findSmeltingRecipe,
  getLogTypes,
  getPlanksTypes,
} from '../knowledge/recipes.js';
import {
  getMiningInfo,
  findBlocksThatDrop,
  getRequiredPickaxeTier,
  canMineWith,
  getToolName,
  ToolTier,
} from '../knowledge/mining.js';
import {
  PlanAction,
  BotState,
  PlannerOptions,
  DEFAULT_PLANNER_OPTIONS,
  Inventory,
} from './types.js';

/**
 * Simple inventory implementation for planning
 */
export class SimulatedInventory implements Inventory {
  items: Map<string, number> = new Map();

  constructor(initial?: Map<string, number>) {
    if (initial) {
      this.items = new Map(initial);
    }
  }

  count(item: string): number {
    // Handle generic items
    if (item === 'planks') {
      let total = 0;
      for (const plankType of getPlanksTypes()) {
        total += this.items.get(plankType) || 0;
      }
      return total;
    }
    if (item === 'log') {
      let total = 0;
      for (const logType of getLogTypes()) {
        total += this.items.get(logType) || 0;
      }
      return total;
    }
    return this.items.get(item) || 0;
  }

  has(item: string, quantity: number = 1): boolean {
    return this.count(item) >= quantity;
  }

  add(item: string, quantity: number): void {
    this.items.set(item, (this.items.get(item) || 0) + quantity);
  }

  remove(item: string, quantity: number): boolean {
    // Handle generic items - remove from first available
    if (item === 'planks') {
      let remaining = quantity;
      for (const plankType of getPlanksTypes()) {
        const have = this.items.get(plankType) || 0;
        if (have > 0) {
          const toRemove = Math.min(have, remaining);
          this.items.set(plankType, have - toRemove);
          remaining -= toRemove;
          if (remaining <= 0) return true;
        }
      }
      return remaining <= 0;
    }
    if (item === 'log') {
      let remaining = quantity;
      for (const logType of getLogTypes()) {
        const have = this.items.get(logType) || 0;
        if (have > 0) {
          const toRemove = Math.min(have, remaining);
          this.items.set(logType, have - toRemove);
          remaining -= toRemove;
          if (remaining <= 0) return true;
        }
      }
      return remaining <= 0;
    }

    const current = this.items.get(item) || 0;
    if (current < quantity) return false;
    this.items.set(item, current - quantity);
    return true;
  }

  getAll(): { name: string; count: number }[] {
    const result: { name: string; count: number }[] = [];
    for (const [name, count] of this.items) {
      if (count > 0) {
        result.push({ name, count });
      }
    }
    return result;
  }

  clone(): Inventory {
    return new SimulatedInventory(new Map(this.items));
  }
}

/**
 * Plan how to obtain a specific item
 */
export function planToObtain(
  item: string,
  quantity: number,
  state: BotState,
  options: PlannerOptions = DEFAULT_PLANNER_OPTIONS,
  depth: number = 0
): PlanAction[] {
  if (depth > options.maxDepth) {
    throw new Error(`Planning depth exceeded for ${item}. Possible circular dependency.`);
  }

  const plan: PlanAction[] = [];

  // In creative mode, just use creative inventory
  if (state.gameMode === 'creative') {
    plan.push({
      type: 'use_creative',
      description: `Get ${quantity} ${item} from creative inventory`,
      params: { item, quantity },
    });
    return plan;
  }

  // Check if we already have enough
  const have = state.inventory.count(item);
  if (have >= quantity) {
    return []; // Already have it
  }

  const need = quantity - have;

  // Try crafting first
  const recipe = findRecipe(item);
  if (recipe) {
    // Check if we need a crafting table
    if (recipe.tool === 'crafting_table' && !state.hasCraftingTable) {
      if (options.allowCraftingTablePlacement) {
        // Plan to get and place a crafting table
        plan.push(...planToObtain('crafting_table', 1, state, options, depth + 1));
        plan.push({
          type: 'place_crafting_table',
          description: 'Place crafting table',
          params: {},
        });
        state.hasCraftingTable = true;
      } else {
        throw new Error(`Need crafting table to craft ${item} but placement not allowed`);
      }
    }

    // Calculate how many times we need to craft
    const craftCount = Math.ceil(need / recipe.result);

    // Plan to obtain ingredients
    for (const [ingredient, countPerCraft] of Object.entries(recipe.ingredients)) {
      const totalNeeded = countPerCraft * craftCount;
      plan.push(...planToObtain(ingredient, totalNeeded, state, options, depth + 1));

      // Simulate removing ingredients from inventory
      state.inventory.remove(ingredient, totalNeeded);
    }

    // Add crafting action
    plan.push({
      type: 'craft',
      description: `Craft ${craftCount * recipe.result} ${item}`,
      params: { item, quantity: craftCount },
    });

    // Simulate adding crafted items to inventory
    state.inventory.add(item, craftCount * recipe.result);

    return plan;
  }

  // Try smelting
  const smeltingRecipe = findSmeltingRecipe(item);
  if (smeltingRecipe) {
    // Need furnace
    if (!state.hasFurnace) {
      if (options.allowFurnacePlacement) {
        plan.push(...planToObtain('furnace', 1, state, options, depth + 1));
        plan.push({
          type: 'place_furnace',
          description: 'Place furnace',
          params: {},
        });
        state.hasFurnace = true;
      } else {
        throw new Error(`Need furnace to smelt ${item} but placement not allowed`);
      }
    }

    // Get input material
    plan.push(...planToObtain(smeltingRecipe.input, need, state, options, depth + 1));

    // Get fuel (coal or charcoal) - 1 coal smelts 8 items
    const fuelNeeded = Math.ceil(need / 8);
    plan.push(...planToObtain('coal', fuelNeeded, state, options, depth + 1));

    // Add smelting action
    plan.push({
      type: 'smelt',
      description: `Smelt ${need} ${smeltingRecipe.input} into ${item}`,
      params: { item, quantity: need, input: smeltingRecipe.input },
    });

    state.inventory.remove(smeltingRecipe.input, need);
    state.inventory.add(item, need);

    return plan;
  }

  // Try mining
  const blocksThatDrop = findBlocksThatDrop(item);
  if (blocksThatDrop.length > 0) {
    // Find the easiest block to mine
    const block = blocksThatDrop[0];
    const miningInfo = getMiningInfo(block);

    if (miningInfo) {
      // Check if we need a tool
      if (miningInfo.minTier !== 'hand') {
        const toolName = getToolName(miningInfo.minTier, miningInfo.tool);
        if (toolName) {
          // Check if we have a suitable tool
          const hasToolItem = state.inventory.has(toolName);
          if (!hasToolItem) {
            // Plan to get the tool
            plan.push(...planToObtain(toolName, 1, state, options, depth + 1));
          }

          // Add equip action
          plan.push({
            type: 'equip',
            description: `Equip ${toolName}`,
            params: { item: toolName },
          });
        }
      }

      // Calculate how many blocks to mine
      const dropQuantity = miningInfo.dropQuantity || 1;
      const blocksToMine = Math.ceil(need / dropQuantity);

      // Add mining action
      plan.push({
        type: 'mine',
        description: `Mine ${blocksToMine} ${block} to get ${item}`,
        params: { block, quantity: blocksToMine, drops: item },
      });

      state.inventory.add(item, blocksToMine * dropQuantity);

      return plan;
    }
  }

  // Special case: logs can be punched
  if (getLogTypes().includes(item) || item === 'log') {
    plan.push({
      type: 'mine',
      description: `Punch ${need} trees to get logs`,
      params: { block: 'oak_log', quantity: need, drops: item },
    });

    state.inventory.add(item === 'log' ? 'oak_log' : item, need);
    return plan;
  }

  throw new Error(`Don't know how to obtain ${item}`);
}

/**
 * Optimize a plan by combining similar actions
 */
export function optimizePlan(plan: PlanAction[]): PlanAction[] {
  const optimized: PlanAction[] = [];

  for (const action of plan) {
    // Try to combine with previous action of same type
    const lastAction = optimized[optimized.length - 1];

    if (
      lastAction &&
      lastAction.type === action.type &&
      lastAction.params.item === action.params.item
    ) {
      // Combine quantities
      lastAction.params.quantity =
        (lastAction.params.quantity || 1) + (action.params.quantity || 1);
      lastAction.description = `${lastAction.type} ${lastAction.params.quantity} ${lastAction.params.item}`;
    } else {
      optimized.push({ ...action });
    }
  }

  return optimized;
}

/**
 * Estimate time for a plan (rough estimate in seconds)
 */
export function estimatePlanTime(plan: PlanAction[]): number {
  let time = 0;

  for (const action of plan) {
    switch (action.type) {
      case 'mine':
        time += (action.params.quantity || 1) * 3; // ~3 seconds per block
        break;
      case 'craft':
        time += 1; // Crafting is fast
        break;
      case 'smelt':
        time += (action.params.quantity || 1) * 10; // 10 seconds per item
        break;
      case 'build':
        time += (action.params.blockCount || 1) * 2; // 2 seconds per block
        break;
      case 'navigate':
        time += 5; // Assume 5 seconds average
        break;
      case 'equip':
        time += 0.5;
        break;
      default:
        time += 2;
    }
  }

  return time;
}
