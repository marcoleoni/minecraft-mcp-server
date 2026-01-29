/**
 * Plan Executor
 * Executes planned actions on the Mineflayer bot
 */

import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import pathfinderPkg from 'mineflayer-pathfinder';
import minecraftData from 'minecraft-data';
import { PlanAction } from '../planner/types.js';
import {
  generateHousePositions,
  generateWallPositions,
  generateFloorPositions,
  generateTowerPositions,
  generateBridgePositions,
  sortBlocksForBuilding,
} from '../knowledge/building.js';

const { goals, Movements } = pathfinderPkg;

export interface ExecutionResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface ExecutionProgress {
  action: string;
  progress: number;  // 0-100
  message: string;
}

export type ProgressCallback = (progress: ExecutionProgress) => void;

/**
 * Execute a single action
 */
async function executeAction(
  bot: mineflayer.Bot,
  action: PlanAction,
  mcData: any,
  onProgress?: ProgressCallback
): Promise<ExecutionResult> {
  const report = (progress: number, message: string) => {
    if (onProgress) {
      onProgress({
        action: action.type,
        progress,
        message,
      });
    }
  };

  try {
    switch (action.type) {
      case 'mine':
        return await executeMine(bot, action.params, mcData, report);

      case 'craft':
        return await executeCraft(bot, action.params, mcData, report);

      case 'smelt':
        return await executeSmelt(bot, action.params, mcData, report);

      case 'build':
        return await executeBuild(bot, action.params, mcData, report);

      case 'navigate':
        return await executeNavigate(bot, action.params, report);

      case 'equip':
        return await executeEquip(bot, action.params, mcData, report);

      case 'place_crafting_table':
        return await placeCraftingTable(bot, mcData, report);

      case 'place_furnace':
        return await placeFurnace(bot, mcData, report);

      case 'collect':
        return await executeCollect(bot, action.params, report);

      case 'attack':
        return await executeAttack(bot, action.params, report);

      case 'eat':
        return await executeEat(bot, action.params, mcData, report);

      case 'use_creative':
        return await executeCreativeGive(bot, action.params, mcData, report);

      default:
        return {
          success: false,
          message: `Unknown action type: ${action.type}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Action failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Execute mining action
 */
async function executeMine(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { block: blockName, quantity } = params;
  let mined = 0;

  const blockType = mcData.blocksByName[blockName];
  if (!blockType) {
    return { success: false, message: `Unknown block: ${blockName}` };
  }

  report(0, `Starting to mine ${quantity} ${blockName}`);

  while (mined < quantity) {
    const block = bot.findBlock({
      matching: blockType.id,
      maxDistance: 64,
    });

    if (!block) {
      return {
        success: mined > 0,
        message: `Mined ${mined}/${quantity} ${blockName}. No more found.`,
        details: { mined },
      };
    }

    // Navigate to block
    try {
      const goal = new goals.GoalNear(
        block.position.x,
        block.position.y,
        block.position.z,
        4
      );
      await bot.pathfinder.goto(goal);
    } catch (e) {
      // Continue even if pathfinding fails - might be close enough
    }

    // Mine the block
    try {
      await bot.dig(block);
      mined++;
      report(
        Math.floor((mined / quantity) * 100),
        `Mined ${mined}/${quantity} ${blockName}`
      );
    } catch (e) {
      // Block might have been mined by someone else, continue
    }

    // Small delay to prevent spam
    await sleep(100);
  }

  return {
    success: true,
    message: `Successfully mined ${mined} ${blockName}`,
    details: { mined },
  };
}

/**
 * Execute crafting action
 */
async function executeCraft(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { item: itemName, quantity } = params;

  const item = mcData.itemsByName[itemName];
  if (!item) {
    return { success: false, message: `Unknown item: ${itemName}` };
  }

  report(0, `Crafting ${quantity} ${itemName}`);

  // Find crafting table if needed
  const craftingTable = bot.findBlock({
    matching: mcData.blocksByName['crafting_table'].id,
    maxDistance: 32,
  });

  // Get recipes
  const recipes = bot.recipesFor(item.id, null, 1, craftingTable);
  if (recipes.length === 0) {
    return {
      success: false,
      message: `No recipe found for ${itemName}`,
    };
  }

  try {
    // Navigate to crafting table if needed
    if (craftingTable) {
      const goal = new goals.GoalNear(
        craftingTable.position.x,
        craftingTable.position.y,
        craftingTable.position.z,
        3
      );
      await bot.pathfinder.goto(goal);
    }

    await bot.craft(recipes[0], quantity, craftingTable || undefined);

    report(100, `Crafted ${quantity} ${itemName}`);
    return {
      success: true,
      message: `Successfully crafted ${quantity} ${itemName}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to craft ${itemName}: ${error}`,
    };
  }
}

/**
 * Execute smelting action (simplified - just adds to todo)
 */
async function executeSmelt(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { item, quantity, input } = params;

  // Find furnace
  const furnace = bot.findBlock({
    matching: mcData.blocksByName['furnace'].id,
    maxDistance: 32,
  });

  if (!furnace) {
    return { success: false, message: 'No furnace found nearby' };
  }

  report(0, `Smelting ${quantity} ${input} into ${item}`);

  try {
    // Navigate to furnace
    const goal = new goals.GoalNear(
      furnace.position.x,
      furnace.position.y,
      furnace.position.z,
      3
    );
    await bot.pathfinder.goto(goal);

    // Open furnace
    const furnaceBlock = await bot.openFurnace(furnace);

    // Put input and fuel
    const inputItem = bot.inventory.items().find(i => i.name === input);
    const fuelItem = bot.inventory.items().find(i =>
      i.name === 'coal' || i.name === 'charcoal'
    );

    if (inputItem) {
      await furnaceBlock.putInput(inputItem.type, null, Math.min(inputItem.count, quantity));
    }
    if (fuelItem) {
      await furnaceBlock.putFuel(fuelItem.type, null, Math.ceil(quantity / 8));
    }

    // Wait for smelting (simplified - just wait a bit)
    await sleep(quantity * 1000); // 1 second per item (simplified)

    // Take output
    await furnaceBlock.takeOutput();
    furnaceBlock.close();

    report(100, `Smelted ${quantity} ${item}`);
    return {
      success: true,
      message: `Successfully smelted ${quantity} ${item}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to smelt: ${error}`,
    };
  }
}

/**
 * Execute building action
 */
async function executeBuild(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { structure, material, width, depth, height, length, quantity } = params;

  report(0, `Building ${structure} with ${material}`);

  // Generate block positions based on structure type
  let blocks;
  const startPos = bot.entity.position.floored().offset(2, 0, 2); // Start a bit away from bot

  switch (structure) {
    case 'house':
      blocks = generateHousePositions(width || 5, depth || 5, height || 3, material);
      break;
    case 'wall':
      blocks = generateWallPositions(length || 5, height || 3, material);
      break;
    case 'floor':
    case 'platform':
      blocks = generateFloorPositions(width || 5, depth || 5, material);
      break;
    case 'tower':
      blocks = generateTowerPositions(height || 5, material);
      break;
    case 'bridge':
      blocks = generateBridgePositions(length || 10, width || 3, material);
      break;
    case 'custom':
      // Just place quantity blocks in a line
      blocks = [];
      for (let i = 0; i < (quantity || 1); i++) {
        blocks.push({ offset: new Vec3(i, 0, 0), block: material });
      }
      break;
    default:
      return { success: false, message: `Unknown structure: ${structure}` };
  }

  // Sort blocks for optimal building order
  const sortedBlocks = sortBlocksForBuilding(blocks, new Vec3(0, 0, 0));

  let placed = 0;
  const total = sortedBlocks.length;

  // Find the material item
  const materialItem = mcData.itemsByName[material];
  if (!materialItem) {
    return { success: false, message: `Unknown material: ${material}` };
  }

  for (const blockSpec of sortedBlocks) {
    const targetPos = startPos.plus(blockSpec.offset);

    // Check if we have the material
    const invItem = bot.inventory.items().find(i => i.type === materialItem.id);
    if (!invItem) {
      return {
        success: placed > 0,
        message: `Ran out of ${material}. Placed ${placed}/${total} blocks.`,
        details: { placed, total },
      };
    }

    try {
      // Navigate close
      const goal = new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 4);
      await bot.pathfinder.goto(goal);

      // Find reference block
      const refBlock = bot.blockAt(targetPos.offset(0, -1, 0));
      if (!refBlock || refBlock.name === 'air') {
        // Try other directions
        const directions = [
          new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
          new Vec3(0, 0, 1), new Vec3(0, 0, -1),
          new Vec3(0, 1, 0),
        ];
        let foundRef = false;
        for (const dir of directions) {
          const altRef = bot.blockAt(targetPos.plus(dir));
          if (altRef && altRef.name !== 'air') {
            await bot.equip(invItem, 'hand');
            await bot.placeBlock(altRef, dir.scaled(-1));
            foundRef = true;
            break;
          }
        }
        if (!foundRef) continue; // Skip this block
      } else {
        await bot.equip(invItem, 'hand');
        await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
      }

      placed++;
      report(
        Math.floor((placed / total) * 100),
        `Placed ${placed}/${total} blocks`
      );
    } catch (e) {
      // Continue on error
    }

    await sleep(200);
  }

  return {
    success: placed > 0,
    message: `Built ${structure}: placed ${placed}/${total} blocks`,
    details: { placed, total },
  };
}

/**
 * Execute navigation action
 */
async function executeNavigate(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { x, y, z, toPlayer } = params;

  let targetPos: Vec3;

  if (toPlayer) {
    // Find nearest player
    const player = bot.nearestEntity(e => e.type === 'player' && e !== bot.entity);
    if (!player) {
      return { success: false, message: 'No player found nearby' };
    }
    targetPos = player.position;
    report(0, `Navigating to player`);
  } else {
    targetPos = new Vec3(x, y, z);
    report(0, `Navigating to (${x}, ${y}, ${z})`);
  }

  try {
    const goal = new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 2);
    await bot.pathfinder.goto(goal);

    report(100, 'Arrived at destination');
    return {
      success: true,
      message: `Arrived at (${Math.floor(targetPos.x)}, ${Math.floor(targetPos.y)}, ${Math.floor(targetPos.z)})`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Navigation failed: ${error}`,
    };
  }
}

/**
 * Execute equip action
 */
async function executeEquip(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { item: itemName } = params;

  const item = bot.inventory.items().find(i => i.name === itemName);
  if (!item) {
    return { success: false, message: `${itemName} not in inventory` };
  }

  try {
    await bot.equip(item, 'hand');
    report(100, `Equipped ${itemName}`);
    return {
      success: true,
      message: `Equipped ${itemName}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to equip ${itemName}: ${error}`,
    };
  }
}

/**
 * Place a crafting table
 */
async function placeCraftingTable(
  bot: mineflayer.Bot,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const item = bot.inventory.items().find(i => i.name === 'crafting_table');
  if (!item) {
    return { success: false, message: 'No crafting table in inventory' };
  }

  try {
    const pos = bot.entity.position.floored().offset(1, 0, 0);
    const refBlock = bot.blockAt(pos.offset(0, -1, 0));

    if (refBlock && refBlock.name !== 'air') {
      await bot.equip(item, 'hand');
      await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
      report(100, 'Placed crafting table');
      return { success: true, message: 'Placed crafting table' };
    }

    return { success: false, message: 'No suitable place for crafting table' };
  } catch (error) {
    return { success: false, message: `Failed to place crafting table: ${error}` };
  }
}

/**
 * Place a furnace
 */
async function placeFurnace(
  bot: mineflayer.Bot,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const item = bot.inventory.items().find(i => i.name === 'furnace');
  if (!item) {
    return { success: false, message: 'No furnace in inventory' };
  }

  try {
    const pos = bot.entity.position.floored().offset(1, 0, 1);
    const refBlock = bot.blockAt(pos.offset(0, -1, 0));

    if (refBlock && refBlock.name !== 'air') {
      await bot.equip(item, 'hand');
      await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
      report(100, 'Placed furnace');
      return { success: true, message: 'Placed furnace' };
    }

    return { success: false, message: 'No suitable place for furnace' };
  } catch (error) {
    return { success: false, message: `Failed to place furnace: ${error}` };
  }
}

/**
 * Execute collect action
 */
async function executeCollect(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  report(0, 'Looking for items to collect');

  const item = bot.nearestEntity(e => e.name === 'item');
  if (!item) {
    return { success: false, message: 'No items nearby' };
  }

  try {
    const goal = new goals.GoalNear(item.position.x, item.position.y, item.position.z, 1);
    await bot.pathfinder.goto(goal);
    await sleep(500);
    report(100, 'Collected item');
    return { success: true, message: 'Collected item' };
  } catch (error) {
    return { success: false, message: `Failed to collect: ${error}` };
  }
}

/**
 * Execute attack action
 */
async function executeAttack(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { target, all } = params;
  let killed = 0;

  report(0, `Attacking ${target}`);

  const attackOnce = async () => {
    const entity = bot.nearestEntity(e =>
      e.name?.toLowerCase() === target.toLowerCase() ||
      e.displayName?.toLowerCase() === target.toLowerCase()
    );

    if (!entity) return false;

    try {
      const goal = new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 2);
      await bot.pathfinder.goto(goal);

      // Attack until dead
      while (entity.isValid && bot.entity.position.distanceTo(entity.position) < 4) {
        await bot.attack(entity);
        await sleep(500);
      }

      killed++;
      return true;
    } catch (e) {
      return false;
    }
  };

  if (all) {
    while (await attackOnce()) {
      report(50, `Killed ${killed} ${target}`);
    }
  } else {
    await attackOnce();
  }

  return {
    success: killed > 0,
    message: `Killed ${killed} ${target}`,
    details: { killed },
  };
}

/**
 * Execute eat action
 */
async function executeEat(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { food: specificFood } = params;

  // Find food in inventory
  const foodItem = bot.inventory.items().find(item => {
    if (specificFood && item.name !== specificFood) return false;
    const itemData = mcData.items[item.type] as any;
    return itemData?.foodPoints > 0;
  });

  if (!foodItem) {
    return { success: false, message: 'No food in inventory' };
  }

  try {
    report(0, `Eating ${foodItem.name}`);
    await bot.equip(foodItem, 'hand');
    await bot.consume();
    report(100, `Ate ${foodItem.name}`);
    return {
      success: true,
      message: `Ate ${foodItem.name}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to eat: ${error}`,
    };
  }
}

/**
 * Execute creative mode give
 * Uses mineflayer's creative fly to get items from creative inventory
 */
async function executeCreativeGive(
  bot: mineflayer.Bot,
  params: Record<string, any>,
  mcData: any,
  report: (progress: number, message: string) => void
): Promise<ExecutionResult> {
  const { item, quantity } = params;

  // Verify creative mode
  if (bot.game.gameMode !== 'creative') {
    return {
      success: false,
      message: `Not in creative mode. Current mode: ${bot.game.gameMode}`,
    };
  }

  // Normalize item name
  const itemData = mcData.itemsByName[item];
  if (!itemData) {
    return { success: false, message: `Unknown item: ${item}` };
  }

  report(0, `Giving ${quantity} ${item} via creative mode`);

  // Check if we already have enough
  const existingItem = bot.inventory.items().find(i => i.name === item);
  if (existingItem && existingItem.count >= quantity) {
    return {
      success: true,
      message: `Already have ${existingItem.count} ${item} in inventory`,
      details: { existing: existingItem.count },
    };
  }

  try {
    // Use mineflayer's creative.setInventorySlot with a simple item object
    const emptySlot = bot.inventory.firstEmptyInventorySlot(false);
    if (emptySlot !== null) {
      // Create a simple item-like object that setInventorySlot can use
      const itemToAdd = {
        type: itemData.id,
        count: quantity,
        metadata: 0,
        nbt: null,
      };

      // Use setInventorySlot - mineflayer converts this to proper format
      await bot.creative.setInventorySlot(emptySlot, itemToAdd as any);
      await sleep(300); // Wait for server

      // Verify it worked
      const newItem = bot.inventory.items().find(i => i.name === item);
      if (newItem) {
        report(100, `Added ${newItem.count} ${item} to inventory`);
        return {
          success: true,
          message: `Added ${newItem.count} ${item} to inventory`,
          details: { slot: emptySlot, count: newItem.count },
        };
      }
    }

    // If creative API didn't work, inventory might be full
    return {
      success: false,
      message: `Could not add ${item} to inventory. Slot: ${emptySlot}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Creative give failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Execute a full plan
 */
export async function executePlan(
  bot: mineflayer.Bot,
  plan: PlanAction[],
  onProgress?: ProgressCallback
): Promise<{ success: boolean; results: ExecutionResult[] }> {
  const mcData = minecraftData(bot.version);
  const results: ExecutionResult[] = [];

  // Set up pathfinder
  const movements = new Movements(bot, mcData);
  bot.pathfinder.setMovements(movements);

  for (let i = 0; i < plan.length; i++) {
    const action = plan[i];

    if (onProgress) {
      onProgress({
        action: action.type,
        progress: 0,
        message: `Starting: ${action.description}`,
      });
    }

    const result = await executeAction(bot, action, mcData, onProgress);
    results.push(result);

    if (!result.success) {
      return { success: false, results };
    }
  }

  return { success: true, results };
}

/**
 * Helper sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
