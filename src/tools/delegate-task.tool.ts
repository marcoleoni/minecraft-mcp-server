import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import { GoalManager } from '../goals/goal-manager.js';
import { BehaviorExecutor } from '../behaviors/behavior-executor.js';
import { GoalType, GoalPriority, GOAL_CONFIGS } from '../goals/goal-types.js';

/**
 * Delegate Task Tool
 *
 * Submits a goal for autonomous execution
 * This is the primary tool for delegating work to the bot
 */
export function registerDelegateTaskTool(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot,
  goalManager: GoalManager,
  behaviorExecutor: BehaviorExecutor
): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  factory.registerTool(
    "delegate-task",
    "Delegate a task to the bot for autonomous execution. The bot will execute the goal using its behavior system without requiring further LLM involvement. Use this to reduce round-trips and let the bot work autonomously. Returns a goal ID for tracking.",
    {
      goalType: z.enum([
        'navigate_to_position',
        'navigate_to_block',
        'mine_block',
        'mine_blocks',
        'craft_item',
        'place_block',
        'place_blocks',
        'build_structure',
        'eat_food',
        'flee_danger',
        'equip_item',
        'drop_items',
        'collect_items'
      ]).describe("Type of goal to execute"),
      params: z.record(z.unknown()).describe("Parameters for the goal (see list-capabilities for required params)"),
      priority: z.enum(['critical', 'high', 'normal', 'low']).optional().describe("Priority level (default: normal)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { goalType, params, priority } = args as {
        goalType: GoalType;
        params: Record<string, unknown>;
        priority?: GoalPriority;
      };

      // Get bot ID from bot manager
      const botId = (bot as any).__botId || 'default';

      // Register bot with behavior executor if not already registered
      if (!(bot as any).__botId) {
        (bot as any).__botId = botId;
      }
      behaviorExecutor.registerBot(botId, bot);

      try {
        // Validate goal type
        const config = GOAL_CONFIGS[goalType];
        if (!config) {
          return factory.createErrorResponse(`Unknown goal type: ${goalType}`);
        }

        // Validate required params
        const missingParams = config.requiredParams.filter(p => !(p in params));
        if (missingParams.length > 0) {
          return factory.createErrorResponse(
            `Missing required parameters: ${missingParams.join(', ')}\n\n` +
            `Required: ${config.requiredParams.join(', ')}\n` +
            `Optional: ${config.optionalParams.join(', ')}`
          );
        }

        // Add goal to manager
        const goal = goalManager.addGoal(bot, botId, goalType, params, priority);

        return factory.createResponse(
          `✓ Task delegated successfully\n\n` +
          `Goal ID: ${goal.id}\n` +
          `Type: ${config.name}\n` +
          `Priority: ${goal.priority}\n` +
          `Status: ${goal.status}\n\n` +
          `The bot will execute this task autonomously. Use 'get-status' to monitor progress.`
        );
      } catch (error) {
        return factory.createErrorResponse(`Failed to delegate task: ${error}`);
      }
    },
    true
  );
}
