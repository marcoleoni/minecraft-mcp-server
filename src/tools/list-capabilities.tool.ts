import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import { GOAL_CONFIGS, GoalType } from '../goals/goal-types.js';

/**
 * List Capabilities Tool
 *
 * Shows all available goal types and their parameters
 */
export function registerListCapabilitiesTool(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot
): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  factory.registerTool(
    "list-capabilities",
    "List all available goal types that can be delegated to the bot. Shows the parameters required for each goal type and estimated execution times.",
    {
      category: z.enum(['all', 'navigation', 'mining', 'crafting', 'building', 'survival', 'inventory'])
        .optional()
        .describe("Filter by goal category (default: all)")
    },
    async (args) => {
      const { category = 'all' } = args as { category?: string };

      try {
        let response = `=== BOT CAPABILITIES ===\n\n`;
        response += `The bot can autonomously execute the following types of goals:\n\n`;

        // Group goals by category
        const categories: Record<string, GoalType[]> = {
          'Navigation': ['navigate_to_position', 'navigate_to_block'],
          'Mining': ['mine_block', 'mine_blocks'],
          'Crafting': ['craft_item'],
          'Building': ['place_block', 'place_blocks'],
          'Survival': ['eat_food', 'flee_danger'],
          'Inventory': ['equip_item', 'drop_items', 'collect_items']
        };

        for (const [cat, goalTypes] of Object.entries(categories)) {
          // Filter by category if specified
          if (category !== 'all' && cat.toLowerCase() !== category.toLowerCase()) {
            continue;
          }

          response += `━━━ ${cat.toUpperCase()} ━━━\n\n`;

          for (const goalType of goalTypes) {
            const config = GOAL_CONFIGS[goalType];

            response += `▸ ${config.name}\n`;
            response += `  Type: ${goalType}\n`;
            response += `  Description: ${config.description}\n`;

            if (config.requiredParams.length > 0) {
              response += `  Required params: ${config.requiredParams.join(', ')}\n`;
            }

            if (config.optionalParams.length > 0) {
              response += `  Optional params: ${config.optionalParams.join(', ')}\n`;
            }

            response += `  Default priority: ${config.defaultPriority}\n`;
            response += `  Can be interrupted: ${config.canBeInterrupted ? 'Yes' : 'No'}\n`;
            response += `  Estimated duration: ${config.estimatedDuration}\n`;
            response += `\n`;
          }
        }

        response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        response += `💡 USAGE:\n`;
        response += `1. Choose a goal type from above\n`;
        response += `2. Use 'delegate-task' with the goal type and required parameters\n`;
        response += `3. Monitor progress with 'get-status' and 'get-events'\n\n`;
        response += `Example:\n`;
        response += `  delegate-task(\n`;
        response += `    goalType: "mine_blocks",\n`;
        response += `    params: { blockType: "oak_log", quantity: 10 },\n`;
        response += `    priority: "normal"\n`;
        response += `  )\n\n`;
        response += `📊 PRIORITIES:\n`;
        response += `  • critical: Interrupts all other goals (e.g., flee from danger)\n`;
        response += `  • high: Interrupts normal/low priority goals\n`;
        response += `  • normal: Standard execution priority (default)\n`;
        response += `  • low: Only executes when no other goals are pending\n`;

        return factory.createResponse(response);
      } catch (error) {
        return factory.createErrorResponse(`Failed to list capabilities: ${error}`);
      }
    },
    true
  );
}
