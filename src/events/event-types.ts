export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export type EventType =
  // Goal events
  | 'goal_queued'
  | 'goal_started'
  | 'goal_progress'
  | 'goal_completed'
  | 'goal_failed'
  | 'goal_cancelled'
  | 'goal_paused'
  | 'goal_resumed'

  // Bot state events
  | 'health_low'
  | 'health_critical'
  | 'bot_died'
  | 'bot_respawned'
  | 'hunger_low'
  | 'took_damage'

  // Discovery events
  | 'found_resource'
  | 'found_structure'
  | 'found_entity'
  | 'entered_biome'

  // Interaction events
  | 'player_nearby'
  | 'player_message'
  | 'mob_nearby'
  | 'attacked_by'

  // Inventory events
  | 'inventory_full'
  | 'item_obtained'
  | 'item_used'
  | 'tool_broken'

  // Error events
  | 'pathfinding_failed'
  | 'action_failed'
  | 'stuck_detected';

export interface BotEvent {
  id: string;
  type: EventType;
  severity: EventSeverity;
  timestamp: Date;
  botId: string;
  goalId?: string;
  message: string;
  data?: Record<string, unknown>;
  acknowledged: boolean;
}

export interface EventFilter {
  types?: EventType[];
  severity?: EventSeverity[];
  botId?: string;
  goalId?: string;
  since?: Date;
  limit?: number;
  unacknowledgedOnly?: boolean;
}
