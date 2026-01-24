import { Bot } from 'mineflayer';
import { Goal, GoalResult } from '../goals/goal-types.js';
import { Behavior, BehaviorContext, BehaviorResult, BehaviorName, CreateSubGoalCallback } from './behavior-types.js';
import { GoalProgress } from '../goals/goal-types.js';

/**
 * BehaviorExecutor - Executes behaviors for goals
 *
 * Responsibilities:
 * - Map goals to behaviors
 * - Execute behaviors with proper context
 * - Handle abort signals
 * - Track execution status and progress
 */
export class BehaviorExecutor {
  private behaviors: Map<BehaviorName, Behavior> = new Map();
  private executions: Map<string, ExecutionState> = new Map(); // goalId -> state
  private bots: Map<string, Bot> = new Map(); // botId -> Bot instance

  /**
   * Register a behavior
   */
  registerBehavior(behavior: Behavior): void {
    this.behaviors.set(behavior.name as BehaviorName, behavior);
    console.log(`[BehaviorExecutor] Registered behavior: ${behavior.name}`);
  }

  /**
   * Register a bot instance
   */
  registerBot(botId: string, bot: Bot): void {
    this.bots.set(botId, bot);
  }

  /**
   * Unregister a bot instance
   */
  unregisterBot(botId: string): void {
    this.bots.delete(botId);
  }

  /**
   * Get a registered bot instance
   */
  getBot(botId: string): Bot | undefined {
    return this.bots.get(botId);
  }

  /**
   * Execute a goal
   */
  async execute(botId: string, goal: Goal, createSubGoal?: CreateSubGoalCallback): Promise<void> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot ${botId} not registered with BehaviorExecutor`);
    }

    // Map goal type to behavior name
    const behaviorName = this.mapGoalToBehavior(goal.type);
    const behavior = this.behaviors.get(behaviorName);

    if (!behavior) {
      throw new Error(`No behavior registered for: ${behaviorName}`);
    }

    // Create abort controller
    const abortController = new AbortController();

    // Create execution context
    const context: BehaviorContext = {
      bot,
      goalId: goal.id,
      params: goal.params,
      signal: abortController.signal,
      createSubGoal  // Pass the callback for smart behaviors
    };

    // Check if behavior can execute
    const canExecute = await behavior.canExecute(context);
    if (!canExecute) {
      throw new Error(`Behavior ${behaviorName} cannot execute with current parameters`);
    }

    // Store execution state
    const state: ExecutionState = {
      goalId: goal.id,
      botId,
      behavior,
      context,
      abortController,
      status: 'running',
      startedAt: Date.now()
    };
    this.executions.set(goal.id, state);

    // Execute behavior (non-blocking)
    this.executeAsync(state, behavior, context);
  }

  /**
   * Execute behavior asynchronously
   */
  private async executeAsync(
    state: ExecutionState,
    behavior: Behavior,
    context: BehaviorContext
  ): Promise<void> {
    try {
      const result = await behavior.execute(context);
      state.status = 'completed';
      state.result = result;
      state.completedAt = Date.now();

      console.log(`[BehaviorExecutor] Behavior ${behavior.name} completed for goal ${context.goalId}`);
    } catch (error) {
      if (context.signal.aborted) {
        // Aborted, not an error
        state.status = 'aborted';
        console.log(`[BehaviorExecutor] Behavior ${behavior.name} aborted for goal ${context.goalId}`);
      } else {
        // Real error
        state.status = 'failed';
        state.result = {
          status: 'failure',
          message: `Behavior execution failed: ${error}`,
          data: { error: String(error) }
        };
        console.error(`[BehaviorExecutor] Behavior ${behavior.name} failed for goal ${context.goalId}:`, error);
      }
      state.completedAt = Date.now();
    }
  }

  /**
   * Check execution status and get result if completed
   */
  async checkStatus(botId: string, goalId: string): Promise<BehaviorResult | null> {
    const state = this.executions.get(goalId);
    if (!state) {
      return null;
    }

    if (state.status === 'completed' || state.status === 'failed') {
      // Clean up
      this.executions.delete(goalId);
      return state.result || {
        status: state.status === 'completed' ? 'success' : 'failure',
        message: state.status === 'completed' ? 'Completed' : 'Failed'
      };
    }

    return null; // Still running
  }

  /**
   * Get progress of current execution
   */
  async getProgress(botId: string, goalId: string): Promise<GoalProgress | null> {
    const state = this.executions.get(goalId);
    if (!state || !state.progress) {
      return null;
    }

    return state.progress;
  }

  /**
   * Update progress (called by behaviors)
   */
  updateProgress(goalId: string, progress: GoalProgress): void {
    const state = this.executions.get(goalId);
    if (state) {
      state.progress = progress;
    }
  }

  /**
   * Abort a goal execution
   */
  async abort(botId: string, goalId: string): Promise<void> {
    const state = this.executions.get(goalId);
    if (!state) {
      return;
    }

    // Signal abort
    state.abortController.abort();

    // Call behavior's abort method if available
    if (state.behavior.abort) {
      try {
        await state.behavior.abort(state.context);
      } catch (error) {
        console.error(`[BehaviorExecutor] Error during abort of ${state.behavior.name}:`, error);
      }
    }

    // Clean up
    this.executions.delete(goalId);

    console.log(`[BehaviorExecutor] Aborted goal ${goalId}`);
  }

  /**
   * Map goal type to behavior name
   */
  private mapGoalToBehavior(goalType: string): BehaviorName {
    const mapping: Record<string, BehaviorName> = {
      'navigate_to_position': 'navigate',
      'navigate_to_block': 'navigate',
      'mine_block': 'mine_block',
      'mine_blocks': 'mine_block',
      'craft_item': 'craft',
      'place_block': 'place_block',
      'place_blocks': 'place_block',
      'build_structure': 'build_structure',
      'eat_food': 'eat',
      'flee_danger': 'flee',
      'equip_item': 'equip',
      'drop_items': 'drop_items',
      'collect_items': 'collect_items'
    };

    const behaviorName = mapping[goalType];
    if (!behaviorName) {
      throw new Error(`Unknown goal type: ${goalType}`);
    }

    return behaviorName;
  }

  /**
   * Get all active executions (for debugging)
   */
  getActiveExecutions(): ExecutionState[] {
    return Array.from(this.executions.values());
  }
}

/**
 * Execution state tracking
 */
interface ExecutionState {
  goalId: string;
  botId: string;
  behavior: Behavior;
  context: BehaviorContext;
  abortController: AbortController;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  startedAt: number;
  completedAt?: number;
  result?: BehaviorResult;
  progress?: GoalProgress;
}
