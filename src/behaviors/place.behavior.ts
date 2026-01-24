import { Bot } from 'mineflayer';
import { Behavior, BehaviorContext, BehaviorResult } from './behavior-types.js';
import pathfinderPkg from 'mineflayer-pathfinder';
import minecraftData from 'minecraft-data';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';

interface PlaceBlockParams {
  blockType: string;
  x: number;
  y: number;
  z: number;
}

interface PlaceBlocksParams {
  blocks: Array<{
    blockType: string;
    x: number;
    y: number;
    z: number;
  }>;
}

/**
 * PlaceBehavior - Handles placing blocks
 *
 * Supports:
 * - Placing a single block at specified coordinates
 * - Placing multiple blocks for construction
 * - Automatic navigation to placement location
 * - Inventory management (ensuring block is equipped)
 */
export class PlaceBehavior implements Behavior {
  name = 'place_block';
  description = 'Place blocks at specified positions';

  async canExecute(ctx: BehaviorContext): Promise<boolean> {
    const { bot, params } = ctx;

    // Check if this is single or multiple placement
    if ('blocks' in params) {
      const { blocks } = params as unknown as PlaceBlocksParams;

      if (!Array.isArray(blocks) || blocks.length === 0) {
        return false;
      }

      // Check if bot has at least one of the required block types
      for (const block of blocks) {
        const blockType = this.getBlockType(bot, block.blockType);
        if (blockType && bot.inventory.items().some(item => item.name === blockType.name)) {
          return true;
        }
      }
      return false;
    } else {
      const { blockType } = params as unknown as PlaceBlockParams;
      const block = this.getBlockType(bot, blockType);

      if (!block) {
        return false;
      }

      // Check if bot has the block in inventory
      return bot.inventory.items().some(item => item.name === block.name);
    }
  }

  async execute(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { params } = ctx;

    if ('blocks' in params) {
      return await this.placeMultiple(ctx);
    } else {
      return await this.placeSingle(ctx);
    }
  }

  /**
   * Place a single block at specified coordinates
   */
  private async placeSingle(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { bot, params, signal } = ctx;
    const { blockType, x, y, z } = params as unknown as PlaceBlockParams;

    try {
      // Get block type from registry
      const blockItem = this.getBlockType(bot, blockType);
      if (!blockItem) {
        return {
          status: 'failure',
          message: `Unknown block type: ${blockType}`
        };
      }

      // Check if bot has the block
      const inventoryItem = bot.inventory.items().find(item => item.name === blockItem.name);
      if (!inventoryItem) {
        return {
          status: 'failure',
          message: `Block ${blockType} not found in inventory`
        };
      }

      // Navigate near the placement position
      const targetPos = new Vec3(x, y, z);
      const currentPos = bot.entity.position;
      const distance = currentPos.distanceTo(targetPos);

      if (distance > 4) {
        if (signal.aborted) return { status: 'failure', message: 'Aborted' };

        // Navigate close to placement position
        const goal = new goals.GoalNear(x, y, z, 3);
        await bot.pathfinder.goto(goal);
      }

      if (signal.aborted) return { status: 'failure', message: 'Aborted' };

      // Equip the block
      await bot.equip(inventoryItem, 'hand');

      if (signal.aborted) return { status: 'failure', message: 'Aborted' };

      // Find a reference block to place against
      const referenceBlock = this.findReferenceBlock(bot, targetPos);
      if (!referenceBlock) {
        return {
          status: 'failure',
          message: `No reference block found to place ${blockType} at (${x}, ${y}, ${z})`
        };
      }

      // Place the block
      await bot.placeBlock(referenceBlock.block, referenceBlock.face);

      return {
        status: 'success',
        message: `Placed ${blockType} at (${x}, ${y}, ${z})`,
        data: { blockType, position: { x, y, z } }
      };

    } catch (error) {
      return {
        status: 'failure',
        message: `Failed to place block: ${error}`
      };
    }
  }

  /**
   * Place multiple blocks for construction
   */
  private async placeMultiple(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { bot, params, signal } = ctx;
    const { blocks } = params as unknown as PlaceBlocksParams;

    const placed: Array<{ blockType: string; position: Vec3 }> = [];
    const failed: Array<{ blockType: string; position: Vec3; reason: string }> = [];

    try {
      for (const blockData of blocks) {
        if (signal.aborted) {
          return {
            status: 'failure',
            message: `Aborted after placing ${placed.length}/${blocks.length} blocks`,
            data: { placed: placed.length, failed: failed.length }
          };
        }

        const { blockType, x, y, z } = blockData;
        const targetPos = new Vec3(x, y, z);

        // Get block type
        const blockItem = this.getBlockType(bot, blockType);
        if (!blockItem) {
          failed.push({ blockType, position: targetPos, reason: 'Unknown block type' });
          continue;
        }

        // Check inventory
        const inventoryItem = bot.inventory.items().find(item => item.name === blockItem.name);
        if (!inventoryItem) {
          failed.push({ blockType, position: targetPos, reason: 'Not in inventory' });
          continue;
        }

        // Navigate if needed
        const currentPos = bot.entity.position;
        const distance = currentPos.distanceTo(targetPos);

        if (distance > 4) {
          try {
            const goal = new goals.GoalNear(x, y, z, 3);
            await bot.pathfinder.goto(goal);
          } catch (error) {
            failed.push({ blockType, position: targetPos, reason: 'Navigation failed' });
            continue;
          }
        }

        // Equip block
        try {
          await bot.equip(inventoryItem, 'hand');
        } catch (error) {
          failed.push({ blockType, position: targetPos, reason: 'Failed to equip' });
          continue;
        }

        // Find reference block
        const referenceBlock = this.findReferenceBlock(bot, targetPos);
        if (!referenceBlock) {
          failed.push({ blockType, position: targetPos, reason: 'No reference block' });
          continue;
        }

        // Place block
        try {
          await bot.placeBlock(referenceBlock.block, referenceBlock.face);
          placed.push({ blockType, position: targetPos });
        } catch (error) {
          failed.push({ blockType, position: targetPos, reason: `Placement failed: ${error}` });
        }
      }

      if (placed.length === blocks.length) {
        return {
          status: 'success',
          message: `Successfully placed all ${placed.length} blocks`,
          data: { placed: placed.length, failed: 0 }
        };
      } else if (placed.length > 0) {
        return {
          status: 'success',
          message: `Placed ${placed.length}/${blocks.length} blocks (${failed.length} failed)`,
          data: { placed: placed.length, failed: failed.length }
        };
      } else {
        return {
          status: 'failure',
          message: `Failed to place any blocks (${failed.length} attempts)`,
          data: { placed: 0, failed: failed.length }
        };
      }

    } catch (error) {
      return {
        status: 'failure',
        message: `Failed to place blocks: ${error}`,
        data: { placed: placed.length, failed: failed.length }
      };
    }
  }

  /**
   * Find a reference block adjacent to target position to place against
   */
  private findReferenceBlock(bot: Bot, targetPos: Vec3): { block: any; face: Vec3 } | null {
    // Check all 6 adjacent positions (down, up, north, south, west, east)
    const offsets = [
      { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) },   // Down
      { offset: new Vec3(0, 1, 0), face: new Vec3(0, -1, 0) },   // Up
      { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },   // North
      { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) },   // South
      { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },   // West
      { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) }    // East
    ];

    for (const { offset, face } of offsets) {
      const refPos = targetPos.plus(offset);
      const block = bot.blockAt(refPos);

      // Check if block exists and is solid
      if (block && block.name !== 'air' && block.boundingBox === 'block') {
        return { block, face };
      }
    }

    return null;
  }

  /**
   * Get block type from registry by name or ID
   */
  private getBlockType(bot: Bot, blockType: string): any | null {
    const mcData = minecraftData(bot.version);

    // Try by name first
    let block = mcData.blocksByName[blockType];
    if (block) return block;

    // Try by ID if it's a number
    const id = parseInt(blockType);
    if (!isNaN(id)) {
      block = mcData.blocks[id];
      if (block) return block;
    }

    return null;
  }

  async abort(ctx: BehaviorContext): Promise<void> {
    const { bot } = ctx;
    // Stop pathfinding if in progress
    bot.pathfinder.setGoal(null);
  }
}
