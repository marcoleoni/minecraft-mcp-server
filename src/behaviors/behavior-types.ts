import { Bot } from 'mineflayer';
import type { GoalType, GoalPriority } from '../goals/goal-types.js';

export type BehaviorStatus = 'idle' | 'running' | 'success' | 'failure' | 'needs_subgoals';

// Callback for creating sub-goals
export type CreateSubGoalCallback = (
  goalType: GoalType,
  params: Record<string, unknown>,
  priority?: GoalPriority
) => Promise<string>; // Returns sub-goal ID

export interface BehaviorContext {
  bot: Bot;
  goalId: string;
  params: Record<string, unknown>;
  signal: AbortSignal;  // For cancellation
  createSubGoal?: CreateSubGoalCallback;  // Optional: for smart behaviors
}

export interface BehaviorResult {
  status: BehaviorStatus;
  message?: string;
  data?: Record<string, unknown>;
  subGoals?: Array<{  // Optional: sub-goals to create
    goalType: GoalType;
    params: Record<string, unknown>;
    priority?: GoalPriority;
  }>;
}

export interface Behavior {
  name: string;
  description: string;

  // Check if the behavior can be executed
  canExecute(ctx: BehaviorContext): Promise<boolean>;

  // Execute the behavior (can be async/long-running)
  execute(ctx: BehaviorContext): Promise<BehaviorResult>;

  // Called every tick while the behavior is active
  tick?(ctx: BehaviorContext): Promise<void>;

  // Cleanup when the behavior is interrupted
  abort?(ctx: BehaviorContext): Promise<void>;
}

// Registry of available behaviors
export type BehaviorName =
  | 'navigate'
  | 'mine_block'
  | 'place_block'
  | 'build_structure'  // Smart behavior for autonomous building
  | 'craft'
  | 'equip'
  | 'eat'
  | 'collect_items'
  | 'drop_items'
  | 'flee';
