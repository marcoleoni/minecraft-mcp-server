import { Behavior, BehaviorContext, BehaviorResult } from './behavior-types.js';
import pathfinderPkg from 'mineflayer-pathfinder';
import minecraftData from 'minecraft-data';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import { Block } from 'prismarine-block';

/**
 * Mine Behavior
 *
 * Mines one or more blocks
 *
 * Params:
 * - For single block: x, y, z (coordinates)
 * - For multiple blocks: blockType (name), quantity (number), searchRadius (optional)
 */
export class MineBehavior implements Behavior {
  name = 'mine_block';
  description = 'Mine blocks at specific positions or gather resources';

  async canExecute(ctx: BehaviorContext): Promise<boolean> {
    // Check if we have either position OR (blockType + quantity)
    const hasPosition = 'x' in ctx.params && 'y' in ctx.params && 'z' in ctx.params;
    const hasQuantity = 'blockType' in ctx.params && 'quantity' in ctx.params;

    return hasPosition || hasQuantity;
  }

  async execute(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { bot, params, signal } = ctx;

    try {
      if ('quantity' in params) {
        // Mine multiple blocks
        return await this.mineMultiple(ctx);
      } else {
        // Mine single block
        return await this.mineSingle(ctx);
      }
    } catch (error) {
      if (signal?.aborted) {
        return {
          status: 'failure',
          message: 'Mining aborted'
        };
      }

      return {
        status: 'failure',
        message: `Mining failed: ${error}`,
        data: { error: String(error) }
      };
    }
  }

  /**
   * Mine a single block at specific coordinates
   */
  private async mineSingle(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { bot, params, signal } = ctx;
    const x = params.x as number;
    const y = params.y as number;
    const z = params.z as number;

    const targetPos = new Vec3(x, y, z);
    const block = bot.blockAt(targetPos);

    if (!block || block.name === 'air') {
      return {
        status: 'failure',
        message: `No block at (${x}, ${y}, ${z})`
      };
    }

    const blockName = block.name;

    // Move close to the block
    const goal = new goals.GoalNear(x, y, z, 4);
    await bot.pathfinder.goto(goal);

    if (signal?.aborted) {
      return { status: 'failure', message: 'Aborted during navigation' };
    }

    // Look at and mine the block
    await bot.lookAt(targetPos, true);
    await bot.dig(block);

    return {
      status: 'success',
      message: `Mined ${blockName} at (${x}, ${y}, ${z})`,
      data: { blockType: blockName, position: { x, y, z } }
    };
  }

  /**
   * Mine multiple blocks of a specific type
   */
  private async mineMultiple(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { bot, params, signal } = ctx;
    const blockType = params.blockType as string;
    const quantity = params.quantity as number;
    const searchRadius = (params.searchRadius as number) || 32;

    const mcData = minecraftData(bot.version);
    const blockId = mcData.blocksByName[blockType]?.id;

    if (!blockId) {
      return {
        status: 'failure',
        message: `Unknown block type: ${blockType}`
      };
    }

    let mined = 0;
    const maxAttempts = quantity * 3;
    let attempts = 0;

    while (mined < quantity && attempts < maxAttempts) {
      if (signal?.aborted) {
        return {
          status: 'failure',
          message: `Mining aborted after ${mined}/${quantity} blocks`,
          data: { mined, target: quantity }
        };
      }

      attempts++;

      // Find nearest block
      const block = bot.findBlock({
        matching: blockId,
        maxDistance: searchRadius
      });

      if (!block) {
        // No more blocks found
        break;
      }

      try {
        // Move to block
        const goal = new goals.GoalNear(block.position.x, block.position.y, block.position.z, 4);
        await bot.pathfinder.goto(goal);

        if (signal?.aborted) {
          return {
            status: 'failure',
            message: `Mining aborted after ${mined}/${quantity} blocks`,
            data: { mined, target: quantity }
          };
        }

        // Look at and mine
        await bot.lookAt(block.position, true);
        await bot.dig(block);

        mined++;

        // Update progress
        if (ctx.params.__progressCallback) {
          (ctx.params.__progressCallback as Function)({
            current: mined,
            total: quantity,
            percentage: (mined / quantity) * 100
          });
        }
      } catch (error) {
        console.warn(`[MineBehavior] Failed to mine block at ${block.position}:`, error);
        // Continue with next block
      }
    }

    if (mined >= quantity) {
      return {
        status: 'success',
        message: `Successfully mined ${mined} ${blockType}`,
        data: { blockType, mined, target: quantity }
      };
    } else {
      return {
        status: 'success',
        message: `Mined ${mined}/${quantity} ${blockType}. No more blocks found within ${searchRadius} blocks`,
        data: { blockType, mined, target: quantity, searchRadius }
      };
    }
  }

  async abort(ctx: BehaviorContext): Promise<void> {
    // Stop pathfinding
    ctx.bot.pathfinder.setGoal(null);

    // Stop digging if currently digging
    if (ctx.bot.targetDigBlock) {
      ctx.bot.stopDigging();
    }

    console.log('[MineBehavior] Mining aborted');
  }
}
