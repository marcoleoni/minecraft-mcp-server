import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import { EventQueue } from '../events/event-queue.js';
import { EventSeverity, EventType } from '../events/event-types.js';

/**
 * Get Events Tool
 *
 * Retrieves events from the event queue
 */
export function registerGetEventsTool(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot,
  eventQueue: EventQueue
): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  factory.registerTool(
    "get-events",
    "Get recent events from the bot's event log. Shows goal completions, errors, discoveries, and other important events. Use this to monitor what the bot has been doing autonomously.",
    {
      severity: z.enum(['info', 'warning', 'error', 'critical']).optional().describe("Filter by severity level"),
      eventType: z.string().optional().describe("Filter by event type (e.g., 'goal_completed', 'health_low')"),
      goalId: z.string().optional().describe("Filter by specific goal ID"),
      limit: z.number().optional().describe("Maximum number of events to return (default: 20)"),
      unacknowledgedOnly: z.boolean().optional().describe("Only show unacknowledged events (default: false)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { severity, eventType, goalId, limit = 20, unacknowledgedOnly = false } = args as {
        severity?: EventSeverity;
        eventType?: EventType;
        goalId?: string;
        limit?: number;
        unacknowledgedOnly?: boolean;
      };

      const botId = (bot as any).__botId || 'default';

      try {
        // Build filter
        const filter: any = {
          botId,
          limit
        };

        if (severity) filter.severity = severity;
        if (eventType) filter.types = [eventType as EventType];
        if (goalId) filter.goalId = goalId;
        if (unacknowledgedOnly) filter.acknowledged = false;

        // Get events
        const events = eventQueue.getEvents(filter);

        if (events.length === 0) {
          return factory.createResponse(
            `No events found matching the criteria.\n\n` +
            `Tip: Events are generated when goals start, complete, fail, or when important bot state changes occur.`
          );
        }

        // Get unacknowledged counts
        const unackCounts = eventQueue.getUnacknowledgedCounts();

        let response = `=== BOT EVENTS ===\n\n`;

        // Unacknowledged summary
        const totalUnack = unackCounts.info + unackCounts.warning + unackCounts.error + unackCounts.critical;
        if (totalUnack > 0) {
          response += `⚠️  Unacknowledged: ${totalUnack} events\n`;
          if (unackCounts.critical > 0) response += `   🔴 Critical: ${unackCounts.critical}\n`;
          if (unackCounts.error > 0) response += `   🟠 Error: ${unackCounts.error}\n`;
          if (unackCounts.warning > 0) response += `   🟡 Warning: ${unackCounts.warning}\n`;
          if (unackCounts.info > 0) response += `   🔵 Info: ${unackCounts.info}\n`;
          response += `\n`;
        }

        // Event list
        response += `Showing ${events.length} most recent events:\n\n`;

        events.forEach((event, index) => {
          const severityEmoji = {
            info: '🔵',
            warning: '🟡',
            error: '🟠',
            critical: '🔴'
          }[event.severity];

          const ackStatus = event.acknowledged ? '' : ' [NEW]';
          const timestamp = event.timestamp.toISOString().substr(11, 8); // HH:MM:SS

          response += `${index + 1}. ${severityEmoji} [${timestamp}] ${event.type}${ackStatus}\n`;
          response += `   ${event.message}\n`;

          if (event.goalId) {
            response += `   Goal: ${event.goalId}\n`;
          }

          if (event.data && Object.keys(event.data).length > 0) {
            const dataStr = JSON.stringify(event.data, null, 2)
              .split('\n')
              .map(line => `   ${line}`)
              .join('\n');
            response += `   Data: ${dataStr}\n`;
          }

          response += `\n`;
        });

        response += `\n💡 Tip: Events are automatically cleared after acknowledgment to keep the log clean.`;

        // Auto-acknowledge info events older than 5 minutes
        const oldInfoEvents = events
          .filter(e => e.severity === 'info' && !e.acknowledged)
          .filter(e => Date.now() - e.timestamp.getTime() > 5 * 60 * 1000)
          .map(e => e.id);

        if (oldInfoEvents.length > 0) {
          eventQueue.acknowledge(oldInfoEvents);
        }

        return factory.createResponse(response);
      } catch (error) {
        return factory.createErrorResponse(`Failed to get events: ${error}`);
      }
    },
    true
  );
}
