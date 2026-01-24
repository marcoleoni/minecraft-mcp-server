import { v4 as uuidv4 } from 'uuid';
import { BotEvent, EventType, EventSeverity, EventFilter } from './event-types.js';

export class EventQueue {
  private events: BotEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;
  }

  /**
   * Add an event to the queue
   */
  push(event: Omit<BotEvent, 'id' | 'timestamp' | 'acknowledged'>): BotEvent {
    const fullEvent: BotEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date(),
      acknowledged: false
    };

    this.events.push(fullEvent);

    // Remove old events if we exceed the limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    return fullEvent;
  }

  /**
   * Get events with optional filters
   */
  getEvents(filter?: EventFilter): BotEvent[] {
    let result = [...this.events];

    if (filter?.types) {
      result = result.filter(e => filter.types!.includes(e.type));
    }

    if (filter?.severity) {
      result = result.filter(e => filter.severity!.includes(e.severity));
    }

    if (filter?.botId) {
      result = result.filter(e => e.botId === filter.botId);
    }

    if (filter?.goalId) {
      result = result.filter(e => e.goalId === filter.goalId);
    }

    if (filter?.since) {
      result = result.filter(e => e.timestamp >= filter.since!);
    }

    if (filter?.unacknowledgedOnly) {
      result = result.filter(e => !e.acknowledged);
    }

    // Sort by timestamp descending (most recent first)
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Mark events as acknowledged
   */
  acknowledge(eventIds: string[]): number {
    let count = 0;
    for (const event of this.events) {
      if (eventIds.includes(event.id)) {
        event.acknowledged = true;
        count++;
      }
    }
    return count;
  }

  /**
   * Remove all acknowledged events
   */
  clearAcknowledged(): number {
    const before = this.events.length;
    this.events = this.events.filter(e => !e.acknowledged);
    return before - this.events.length;
  }

  /**
   * Get unacknowledged event counts by severity
   */
  getUnacknowledgedCounts(): Record<EventSeverity, number> {
    const counts: Record<EventSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0
    };

    for (const event of this.events) {
      if (!event.acknowledged) {
        counts[event.severity]++;
      }
    }

    return counts;
  }
}
