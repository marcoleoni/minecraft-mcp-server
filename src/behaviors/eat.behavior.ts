import { Behavior, BehaviorContext, BehaviorResult } from './behavior-types.js';
import minecraftData from 'minecraft-data';

/**
 * Eat Behavior
 *
 * Makes the bot eat food to restore hunger
 *
 * Params:
 * - foodName (optional): Specific food item to eat
 * - If not specified, eats the best available food
 */
export class EatBehavior implements Behavior {
  name = 'eat';
  description = 'Eat food to restore hunger';

  async canExecute(ctx: BehaviorContext): Promise<boolean> {
    // Check if bot has food in inventory
    const food = this.findBestFood(ctx);
    return food !== null;
  }

  async execute(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { bot, params, signal } = ctx;

    try {
      // Find food to eat
      const foodName = params.foodName as string | undefined;
      let foodItem;

      if (foodName) {
        // Specific food requested
        const mcData = minecraftData(bot.version);
        const itemId = mcData.itemsByName[foodName]?.id;

        if (!itemId) {
          return {
            status: 'failure',
            message: `Unknown food item: ${foodName}`
          };
        }

        foodItem = bot.inventory.items().find(item => item.type === itemId);

        if (!foodItem) {
          return {
            status: 'failure',
            message: `${foodName} not in inventory`
          };
        }
      } else {
        // Find best available food
        foodItem = this.findBestFood(ctx);

        if (!foodItem) {
          return {
            status: 'failure',
            message: 'No food available in inventory'
          };
        }
      }

      // Check if we're already eating
      if (bot.isSleeping) {
        return {
          status: 'failure',
          message: 'Cannot eat while sleeping'
        };
      }

      const initialHunger = bot.food;
      const foodItemName = foodItem.name;

      // Equip food
      await bot.equip(foodItem, 'hand');

      if (signal?.aborted) {
        return { status: 'failure', message: 'Eating aborted' };
      }

      // Consume food
      await bot.consume();

      const hungerRestored = bot.food - initialHunger;

      return {
        status: 'success',
        message: `Ate ${foodItemName}, restored ${hungerRestored} hunger`,
        data: {
          foodName: foodItemName,
          hungerRestored,
          currentHunger: bot.food,
          currentSaturation: bot.foodSaturation
        }
      };
    } catch (error) {
      if (signal?.aborted) {
        return { status: 'failure', message: 'Eating aborted' };
      }

      return {
        status: 'failure',
        message: `Failed to eat: ${error}`,
        data: { error: String(error) }
      };
    }
  }

  /**
   * Find the best food item in inventory
   * Prioritizes by foodPoints (saturation value)
   */
  private findBestFood(ctx: BehaviorContext): any | null {
    const { bot } = ctx;
    const mcData = minecraftData(bot.version);

    const foodItems = bot.inventory.items().filter(item => {
      const itemData = mcData.items[item.type] as any;
      return itemData && itemData.foodPoints !== undefined && itemData.foodPoints > 0;
    });

    if (foodItems.length === 0) {
      return null;
    }

    // Sort by food points (descending)
    foodItems.sort((a, b) => {
      const aPoints = (mcData.items[a.type] as any).foodPoints || 0;
      const bPoints = (mcData.items[b.type] as any).foodPoints || 0;
      return bPoints - aPoints;
    });

    return foodItems[0];
  }

  async abort(ctx: BehaviorContext): Promise<void> {
    // Stop eating if currently eating
    if (ctx.bot.usingHeldItem) {
      ctx.bot.deactivateItem();
    }
    console.log('[EatBehavior] Eating aborted');
  }
}
