import { Bot } from 'mineflayer';
import { v4 as uuidv4 } from 'uuid';
import { Goal, GoalType, GoalStatus, GoalPriority, GoalResult, GOAL_CONFIGS } from './goal-types.js';
import { EventQueue } from '../events/event-queue.js';
import { BehaviorExecutor } from '../behaviors/behavior-executor.js';

/**
 * GoalManager - Manages goal execution for multiple bots
 *
 * Responsibilities:
 * - Maintain goal stacks per bot
 * - Handle goal prioritization and preemption
 * - Execute goals via BehaviorExecutor
 * - Emit events to EventQueue
 * - Run tick loop at 10 tick/sec
 */
export class GoalManager {
  private goalStacks: Map<string, Goal[]> = new Map(); // botId -> goals
  private activeGoals: Map<string, Goal> = new Map(); // botId -> currently executing goal
  private eventQueue: EventQueue;
  private behaviorExecutor: BehaviorExecutor;
  private tickInterval: NodeJS.Timeout | null = null;
  private tickRate: number = 100; // 10 tick/sec = 100ms per tick

  constructor(eventQueue: EventQueue, behaviorExecutor: BehaviorExecutor) {
    this.eventQueue = eventQueue;
    this.behaviorExecutor = behaviorExecutor;
  }

  /**
   * Start the tick loop
   */
  start(): void {
    if (this.tickInterval) {
      return; // Already running
    }

    this.tickInterval = setInterval(() => {
      this.tick();
    }, this.tickRate);

    console.log(`[GoalManager] Started tick loop at ${1000 / this.tickRate} tick/sec`);
  }

  /**
   * Stop the tick loop
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      console.log('[GoalManager] Stopped tick loop');
    }
  }

  /**
   * Add a new goal for a bot
   */
  addGoal(
    bot: Bot,
    botId: string,
    type: GoalType,
    params: Record<string, unknown>,
    priority?: GoalPriority,
    parentGoalId?: string
  ): Goal {
    const config = GOAL_CONFIGS[type];

    // Validate required params
    for (const param of config.requiredParams) {
      if (!(param in params)) {
        throw new Error(`Missing required parameter: ${param} for goal type ${type}`);
      }
    }

    const goal: Goal = {
      id: uuidv4(),
      type,
      params,
      priority: priority || config.defaultPriority,
      status: 'pending',
      progress: {
        percentage: 0,
        currentStep: 'Pending',
        stepsCompleted: 0,
        totalSteps: 1
      },
      createdAt: new Date(),
      parentGoalId,
      subGoals: [],
      botId
    };

    // Get or create goal stack for this bot
    let stack = this.goalStacks.get(botId);
    if (!stack) {
      stack = [];
      this.goalStacks.set(botId, stack);
    }

    // Insert goal based on priority
    this.insertGoalByPriority(stack, goal);

    // Emit event
    this.eventQueue.push({
      type: 'goal_queued',
      severity: 'info',
      botId,
      goalId: goal.id,
      message: `Goal queued: ${config.name}`,
      data: { type, priority: goal.priority }
    });

    console.log(`[GoalManager] Added goal ${goal.id} (${type}) for bot ${botId} with priority ${goal.priority}`);

    return goal;
  }

  /**
   * Insert goal into stack based on priority
   */
  private insertGoalByPriority(stack: Goal[], goal: Goal): void {
    const priorityOrder: GoalPriority[] = ['critical', 'high', 'normal', 'low'];
    const goalPriorityIndex = priorityOrder.indexOf(goal.priority);

    // Find insertion point
    let insertIndex = stack.length;
    for (let i = 0; i < stack.length; i++) {
      const stackPriorityIndex = priorityOrder.indexOf(stack[i].priority);
      if (goalPriorityIndex < stackPriorityIndex) {
        insertIndex = i;
        break;
      }
    }

    stack.splice(insertIndex, 0, goal);
  }

  /**
   * Cancel a goal
   */
  async cancelGoal(botId: string, goalId: string): Promise<boolean> {
    const stack = this.goalStacks.get(botId);
    if (!stack) {
      return false;
    }

    const goalIndex = stack.findIndex(g => g.id === goalId);
    if (goalIndex === -1) {
      return false;
    }

    const goal = stack[goalIndex];

    // If goal is active, abort it
    if (goal.status === 'active') {
      await this.behaviorExecutor.abort(botId, goalId);
    }

    // Update status
    goal.status = 'cancelled';
    goal.completedAt = new Date();

    // Remove from stack
    stack.splice(goalIndex, 1);

    // Emit event
    this.eventQueue.push({
      type: 'goal_cancelled',
      severity: 'warning',
      botId,
      goalId: goal.id,
      message: `Goal cancelled: ${GOAL_CONFIGS[goal.type].name}`,
      data: { type: goal.type }
    });

    console.log(`[GoalManager] Cancelled goal ${goalId} for bot ${botId}`);

    return true;
  }

  /**
   * Pause a goal
   */
  async pauseGoal(botId: string, goalId: string): Promise<boolean> {
    const activeGoal = this.activeGoals.get(botId);
    if (!activeGoal || activeGoal.id !== goalId) {
      return false;
    }

    await this.behaviorExecutor.abort(botId, goalId);
    activeGoal.status = 'paused';
    this.activeGoals.delete(botId);

    this.eventQueue.push({
      type: 'goal_paused',
      severity: 'info',
      botId,
      goalId,
      message: `Goal paused: ${GOAL_CONFIGS[activeGoal.type].name}`
    });

    return true;
  }

  /**
   * Resume a paused goal
   */
  resumeGoal(botId: string, goalId: string): boolean {
    const stack = this.goalStacks.get(botId);
    if (!stack) {
      return false;
    }

    const goal = stack.find(g => g.id === goalId && g.status === 'paused');
    if (!goal) {
      return false;
    }

    goal.status = 'pending';

    this.eventQueue.push({
      type: 'goal_resumed',
      severity: 'info',
      botId,
      goalId,
      message: `Goal resumed: ${GOAL_CONFIGS[goal.type].name}`
    });

    return true;
  }

  /**
   * Get status of all goals for a bot
   */
  getStatus(botId: string): {
    activeGoal: Goal | null;
    pendingGoals: Goal[];
    totalGoals: number;
  } {
    const stack = this.goalStacks.get(botId) || [];
    const activeGoal = this.activeGoals.get(botId) || null;

    return {
      activeGoal,
      pendingGoals: stack.filter(g => g.status === 'pending' || g.status === 'paused'),
      totalGoals: stack.length + (activeGoal ? 1 : 0)
    };
  }

  /**
   * Get a specific goal by ID
   */
  getGoal(botId: string, goalId: string): Goal | null {
    // Check active goal first
    const activeGoal = this.activeGoals.get(botId);
    if (activeGoal && activeGoal.id === goalId) {
      return activeGoal;
    }

    // Check stack
    const stack = this.goalStacks.get(botId);
    if (!stack) {
      return null;
    }

    return stack.find(g => g.id === goalId) || null;
  }

  /**
   * Main tick function - executes for all bots
   */
  private async tick(): Promise<void> {
    for (const [botId, stack] of this.goalStacks.entries()) {
      await this.tickBot(botId, stack);
    }
  }

  /**
   * Tick for a specific bot
   */
  private async tickBot(botId: string, stack: Goal[]): Promise<void> {
    const activeGoal = this.activeGoals.get(botId);

    // If there's an active goal, check if it's still running
    if (activeGoal) {
      const result = await this.behaviorExecutor.checkStatus(botId, activeGoal.id);

      if (result) {
        // Goal completed or failed
        activeGoal.status = result.status === 'success' ? 'completed' : 'failed';
        activeGoal.completedAt = new Date();
        activeGoal.result = {
          success: result.status === 'success',
          message: result.message || (result.status === 'success' ? 'Completed successfully' : 'Failed'),
          data: result.data
        };

        // Emit event
        this.eventQueue.push({
          type: activeGoal.status === 'completed' ? 'goal_completed' : 'goal_failed',
          severity: activeGoal.status === 'completed' ? 'info' : 'error',
          botId,
          goalId: activeGoal.id,
          message: result.message || `Goal ${activeGoal.status}`,
          data: { type: activeGoal.type, result }
        });

        console.log(`[GoalManager] Goal ${activeGoal.id} ${activeGoal.status}: ${result.message}`);

        // Remove from active goals
        this.activeGoals.delete(botId);

        // If this goal had a parent, update parent's subGoals
        if (activeGoal.parentGoalId) {
          const parentGoal = this.getGoal(botId, activeGoal.parentGoalId);
          if (parentGoal) {
            const subGoalIndex = parentGoal.subGoals.indexOf(activeGoal.id);
            if (subGoalIndex !== -1) {
              parentGoal.subGoals.splice(subGoalIndex, 1);
            }
          }
        }
      } else {
        // Still running, update progress if available
        const progress = await this.behaviorExecutor.getProgress(botId, activeGoal.id);
        if (progress) {
          activeGoal.progress = progress;

          // Emit progress event (throttled to avoid spam)
          const now = Date.now();
          const lastProgressEvent = (activeGoal as any).__lastProgressEvent || 0;
          if (now - lastProgressEvent > 5000) { // Max once per 5 seconds
            this.eventQueue.push({
              type: 'goal_progress',
              severity: 'info',
              botId,
              goalId: activeGoal.id,
              message: `Progress: ${progress.percentage.toFixed(0)}%`,
              data: { progress }
            });
            (activeGoal as any).__lastProgressEvent = now;
          }
        }
      }

      return; // Don't start new goal while one is active
    }

    // No active goal, try to start next pending goal
    if (stack.length === 0) {
      return; // No pending goals
    }

    // Get highest priority pending goal
    const nextGoal = stack.find(g => g.status === 'pending');
    if (!nextGoal) {
      return; // No pending goals
    }

    // Start the next goal
    await this.startGoal(botId, nextGoal);
  }

  /**
   * Start executing a goal
   */
  private async startGoal(botId: string, goal: Goal): Promise<void> {
    goal.status = 'active';
    goal.startedAt = new Date();
    this.activeGoals.set(botId, goal);

    // Remove from stack
    const stack = this.goalStacks.get(botId);
    if (stack) {
      const index = stack.indexOf(goal);
      if (index !== -1) {
        stack.splice(index, 1);
      }
    }

    // Emit event
    this.eventQueue.push({
      type: 'goal_started',
      severity: 'info',
      botId,
      goalId: goal.id,
      message: `Started: ${GOAL_CONFIGS[goal.type].name}`,
      data: { type: goal.type, params: goal.params }
    });

    console.log(`[GoalManager] Starting goal ${goal.id} (${goal.type}) for bot ${botId}`);

    // Create callback for sub-goal creation (for smart behaviors)
    const createSubGoal = async (goalType: any, params: Record<string, unknown>, priority?: any) => {
      const bot = this.behaviorExecutor.getBot(botId);
      if (!bot) {
        throw new Error(`Bot ${botId} not found`);
      }
      const subGoal = this.addGoal(
        bot,
        botId,
        goalType,
        params,
        priority,
        goal.id  // Set parent goal ID
      );
      return subGoal.id;
    };

    // Execute via BehaviorExecutor
    try {
      await this.behaviorExecutor.execute(botId, goal, createSubGoal);
    } catch (error) {
      // Execution failed to start
      goal.status = 'failed';
      goal.completedAt = new Date();
      goal.result = {
        success: false,
        message: `Failed to start: ${error}`,
        error: String(error),
        data: {}
      };

      this.activeGoals.delete(botId);

      this.eventQueue.push({
        type: 'goal_failed',
        severity: 'error',
        botId,
        goalId: goal.id,
        message: `Failed to start goal: ${error}`,
        data: { type: goal.type, error: String(error) }
      });

      console.error(`[GoalManager] Failed to start goal ${goal.id}:`, error);
    }
  }

  /**
   * Clear all completed/failed goals for a bot
   */
  clearCompleted(botId: string): number {
    const stack = this.goalStacks.get(botId);
    if (!stack) {
      return 0;
    }

    const initialLength = stack.length;
    this.goalStacks.set(
      botId,
      stack.filter(g => g.status !== 'completed' && g.status !== 'failed')
    );

    return initialLength - (this.goalStacks.get(botId)?.length || 0);
  }

  /**
   * Get all goals for a bot (for debugging/monitoring)
   */
  getAllGoals(botId: string): Goal[] {
    const stack = this.goalStacks.get(botId) || [];
    const activeGoal = this.activeGoals.get(botId);

    return activeGoal ? [activeGoal, ...stack] : stack;
  }
}
