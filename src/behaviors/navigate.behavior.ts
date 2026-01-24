import { Behavior, BehaviorContext, BehaviorResult } from './behavior-types.js';
import pathfinderPkg from 'mineflayer-pathfinder';
import minecraftData from 'minecraft-data';
const { goals } = pathfinderPkg;

/**
 * Navigate Behavior
 *
 * Moves the bot to a specific position or near a specific block type
 *
 * Params:
 * - For position: x, y, z (coordinates)
 * - For block: blockType (name), maxDistance (optional)
 * - Optional: sprint (boolean), allowParkour (boolean)
 */
export class NavigateBehavior implements Behavior {
  name = 'navigate';
  description = 'Navigate the bot to a position or near a block';

  async canExecute(ctx: BehaviorContext): Promise<boolean> {
    // Check if we have either position OR blockType
    const hasPosition = 'x' in ctx.params && 'y' in ctx.params && 'z' in ctx.params;
    const hasBlockType = 'blockType' in ctx.params;

    if (!hasPosition && !hasBlockType) {
      return false;
    }

    // Check if pathfinder is available
    if (!ctx.bot.pathfinder) {
      console.error('[NavigateBehavior] Pathfinder plugin not loaded');
      return false;
    }

    return true;
  }

  async execute(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { bot, params, signal } = ctx;

    try {
      let goal: any;
      let targetDescription: string;

      // Determine navigation target
      if ('blockType' in params) {
        // Navigate to nearest block of type
        const blockType = params.blockType as string;
        const maxDistance = (params.maxDistance as number) || 64;

        const mcData = minecraftData(bot.version);
        const blockId = mcData.blocksByName[blockType]?.id;

        if (!blockId) {
          return {
            status: 'failure',
            message: `Unknown block type: ${blockType}`
          };
        }

        const block = bot.findBlock({
          matching: blockId,
          maxDistance
        });

        if (!block) {
          return {
            status: 'failure',
            message: `No ${blockType} found within ${maxDistance} blocks`
          };
        }

        goal = new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1);
        targetDescription = `${blockType} at (${block.position.x}, ${block.position.y}, ${block.position.z})`;
      } else {
        // Navigate to position
        const x = params.x as number;
        const y = params.y as number;
        const z = params.z as number;

        goal = new goals.GoalNear(x, y, z, 1);
        targetDescription = `position (${x}, ${y}, ${z})`;
      }

      // Set pathfinder options
      if (params.sprint) {
        const mcData = minecraftData(bot.version);
        bot.pathfinder.setMovements(new pathfinderPkg.Movements(bot, mcData));
      }

      // Listen for abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          bot.pathfinder.setGoal(null);
        });
      }

      // Execute navigation
      await bot.pathfinder.goto(goal);

      // Check if we were aborted
      if (signal?.aborted) {
        return {
          status: 'failure',
          message: 'Navigation aborted'
        };
      }

      return {
        status: 'success',
        message: `Reached ${targetDescription}`,
        data: {
          finalPosition: {
            x: Math.floor(bot.entity.position.x),
            y: Math.floor(bot.entity.position.y),
            z: Math.floor(bot.entity.position.z)
          }
        }
      };
    } catch (error) {
      return {
        status: 'failure',
        message: `Navigation failed: ${error}`,
        data: { error: String(error) }
      };
    }
  }

  async abort(ctx: BehaviorContext): Promise<void> {
    // Stop pathfinding
    ctx.bot.pathfinder.setGoal(null);
    console.log('[NavigateBehavior] Navigation aborted');
  }
}
