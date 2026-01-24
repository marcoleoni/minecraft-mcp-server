import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import { GoalManager } from '../goals/goal-manager.js';

/**
 * Cancel Task Tool
 *
 * Cancels a delegated goal
 */
export function registerCancelTaskTool(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot,
  goalManager: GoalManager
): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  factory.registerTool(
    "cancel-task",
    "Cancel a specific goal or all pending goals. Use this to stop autonomous execution if plans change or errors occur.",
    {
      goalId: z.string().optional().describe("Specific goal ID to cancel (if not provided, cancels all pending goals)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { goalId } = args as { goalId?: string };

      const botId = (bot as any).__botId || 'default';

      try {
        if (goalId) {
          // Cancel specific goal
          const success = await goalManager.cancelGoal(botId, goalId);

          if (success) {
            return factory.createResponse(
              `✓ Goal ${goalId} cancelled successfully\n\n` +
              `The goal has been stopped and removed from the queue.`
            );
          } else {
            return factory.createErrorResponse(
              `Goal ${goalId} not found or already completed`
            );
          }
        } else {
          // Cancel all pending goals
          const status = goalManager.getStatus(botId);
          let cancelledCount = 0;

          // Cancel active goal
          if (status.activeGoal) {
            await goalManager.cancelGoal(botId, status.activeGoal.id);
            cancelledCount++;
          }

          // Cancel all pending goals
          for (const goal of status.pendingGoals) {
            await goalManager.cancelGoal(botId, goal.id);
            cancelledCount++;
          }

          if (cancelledCount > 0) {
            return factory.createResponse(
              `✓ Cancelled ${cancelledCount} goal(s)\n\n` +
              `All active and pending goals have been stopped.`
            );
          } else {
            return factory.createResponse(`No active or pending goals to cancel.`);
          }
        }
      } catch (error) {
        return factory.createErrorResponse(`Failed to cancel task: ${error}`);
      }
    },
    true
  );
}
