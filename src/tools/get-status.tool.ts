import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import { GoalManager } from '../goals/goal-manager.js';
import { GOAL_CONFIGS } from '../goals/goal-types.js';

/**
 * Get Status Tool
 *
 * Retrieves the current status of goals for a bot
 */
export function registerGetStatusTool(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot,
  goalManager: GoalManager
): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  factory.registerTool(
    "get-status",
    "Get the current status of all goals and tasks for the bot. Shows active goal, pending goals, and overall progress. Use this to monitor autonomous task execution.",
    {
      goalId: z.string().optional().describe("Specific goal ID to get detailed status for (optional)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { goalId } = args as { goalId?: string };

      const botId = (bot as any).__botId || 'default';

      try {
        if (goalId) {
          // Get specific goal status
          const goal = goalManager.getGoal(botId, goalId);

          if (!goal) {
            return factory.createErrorResponse(`Goal ${goalId} not found`);
          }

          const config = GOAL_CONFIGS[goal.type];
          let response = `=== GOAL STATUS ===\n\n`;
          response += `ID: ${goal.id}\n`;
          response += `Type: ${config.name}\n`;
          response += `Description: ${config.description}\n`;
          response += `Status: ${goal.status}\n`;
          response += `Priority: ${goal.priority}\n`;
          response += `Progress: ${goal.progress.percentage.toFixed(1)}% (${goal.progress.stepsCompleted}/${goal.progress.totalSteps})\n`;
          response += `Current step: ${goal.progress.currentStep}\n`;
          response += `Created: ${goal.createdAt.toISOString()}\n`;

          if (goal.startedAt) {
            response += `Started: ${goal.startedAt.toISOString()}\n`;
            const elapsed = ((new Date().getTime() - goal.startedAt.getTime()) / 1000).toFixed(1);
            response += `Elapsed: ${elapsed}s\n`;
          }

          if (goal.completedAt) {
            response += `Completed: ${goal.completedAt.toISOString()}\n`;
            const duration = ((goal.completedAt.getTime() - (goal.startedAt?.getTime() || goal.createdAt.getTime())) / 1000).toFixed(1);
            response += `Duration: ${duration}s\n`;
          }

          if (goal.result) {
            response += `\nResult:\n`;
            response += `  Success: ${goal.result.success}\n`;
            if (goal.result.message) {
              response += `  Message: ${goal.result.message}\n`;
            }
            if (goal.result.error) {
              response += `  Error: ${goal.result.error}\n`;
            }
          }

          response += `\nParameters:\n`;
          Object.entries(goal.params).forEach(([key, value]) => {
            response += `  ${key}: ${JSON.stringify(value)}\n`;
          });

          return factory.createResponse(response);
        } else {
          // Get overall status
          const status = goalManager.getStatus(botId);

          let response = `=== BOT TASK STATUS ===\n\n`;

          // Active goal
          if (status.activeGoal) {
            const config = GOAL_CONFIGS[status.activeGoal.type];
            response += `🔄 ACTIVE GOAL:\n`;
            response += `  ID: ${status.activeGoal.id}\n`;
            response += `  Type: ${config.name}\n`;
            response += `  Priority: ${status.activeGoal.priority}\n`;
            response += `  Progress: ${status.activeGoal.progress.percentage.toFixed(1)}%\n`;

            if (status.activeGoal.startedAt) {
              const elapsed = ((new Date().getTime() - status.activeGoal.startedAt.getTime()) / 1000).toFixed(1);
              response += `  Running for: ${elapsed}s\n`;
            }

            response += `\n`;
          } else {
            response += `🔄 ACTIVE GOAL: None\n\n`;
          }

          // Pending goals
          if (status.pendingGoals.length > 0) {
            response += `📋 PENDING GOALS (${status.pendingGoals.length}):\n`;

            status.pendingGoals.slice(0, 5).forEach((goal, index) => {
              const config = GOAL_CONFIGS[goal.type];
              response += `  ${index + 1}. [${goal.priority}] ${config.name}\n`;
              response += `     ID: ${goal.id}\n`;
              response += `     Status: ${goal.status}\n`;
            });

            if (status.pendingGoals.length > 5) {
              response += `  ... and ${status.pendingGoals.length - 5} more\n`;
            }

            response += `\n`;
          } else {
            response += `📋 PENDING GOALS: None\n\n`;
          }

          // Summary
          response += `📊 SUMMARY:\n`;
          response += `  Total goals: ${status.totalGoals}\n`;
          response += `  Active: ${status.activeGoal ? 1 : 0}\n`;
          response += `  Pending: ${status.pendingGoals.length}\n`;

          if (status.totalGoals === 0) {
            response += `\n💡 No active tasks. Use 'delegate-task' to assign work to the bot.`;
          }

          return factory.createResponse(response);
        }
      } catch (error) {
        return factory.createErrorResponse(`Failed to get status: ${error}`);
      }
    },
    true
  );
}
