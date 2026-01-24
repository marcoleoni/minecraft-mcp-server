export type GoalPriority = 'critical' | 'high' | 'normal' | 'low';

export type GoalStatus =
  | 'pending'      // Waiting to be executed
  | 'active'       // Currently executing
  | 'paused'       // Paused for higher priority goal
  | 'completed'    // Completed successfully
  | 'failed'       // Failed
  | 'cancelled';   // Cancelled by user

export interface GoalResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface GoalProgress {
  percentage: number;        // 0-100
  currentStep: string;       // Current step description
  stepsCompleted: number;
  totalSteps: number;
}

export interface Goal {
  id: string;
  type: GoalType;
  params: Record<string, unknown>;
  priority: GoalPriority;
  status: GoalStatus;
  progress: GoalProgress;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  parentGoalId?: string;     // For sub-goals
  subGoals: string[];        // IDs of sub-goals
  result?: GoalResult;
  botId: string;             // For multi-bot support
}

// Available goal types (atomic operations)
export type GoalType =
  // Navigation
  | 'navigate_to_position'
  | 'navigate_to_block'

  // Mining
  | 'mine_block'
  | 'mine_blocks'

  // Crafting
  | 'craft_item'

  // Building
  | 'place_block'
  | 'place_blocks'
  | 'build_structure'  // Smart autonomous building with material gathering

  // Survival
  | 'eat_food'
  | 'flee_danger'

  // Inventory
  | 'equip_item'
  | 'drop_items'
  | 'collect_items';

// Configuration for each goal type
export interface GoalConfig {
  type: GoalType;
  name: string;
  description: string;
  requiredParams: string[];
  optionalParams: string[];
  defaultPriority: GoalPriority;
  canBeInterrupted: boolean;
  estimatedDuration: string;
}

export const GOAL_CONFIGS: Record<GoalType, GoalConfig> = {
  navigate_to_position: {
    type: 'navigate_to_position',
    name: 'Navigate to Position',
    description: 'Move the bot to specific x, y, z coordinates',
    requiredParams: ['x', 'y', 'z'],
    optionalParams: ['sprint', 'allowParkour'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '30s'
  },

  navigate_to_block: {
    type: 'navigate_to_block',
    name: 'Navigate to Block',
    description: 'Move to the nearest block of specified type',
    requiredParams: ['blockType'],
    optionalParams: ['maxDistance'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '1m'
  },

  mine_block: {
    type: 'mine_block',
    name: 'Mine Block',
    description: 'Mine a single block at specified coordinates',
    requiredParams: ['x', 'y', 'z'],
    optionalParams: [],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '10s'
  },

  mine_blocks: {
    type: 'mine_blocks',
    name: 'Mine Blocks',
    description: 'Mine multiple blocks of a specific type',
    requiredParams: ['blockType', 'amount'],
    optionalParams: ['maxDistance'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '5m'
  },

  craft_item: {
    type: 'craft_item',
    name: 'Craft Item',
    description: 'Craft a specific item (materials must be in inventory)',
    requiredParams: ['itemName', 'amount'],
    optionalParams: [],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '1m'
  },

  place_block: {
    type: 'place_block',
    name: 'Place Block',
    description: 'Place a single block at specified coordinates',
    requiredParams: ['blockType', 'x', 'y', 'z'],
    optionalParams: [],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '5s'
  },

  place_blocks: {
    type: 'place_blocks',
    name: 'Place Blocks',
    description: 'Place multiple blocks at specified positions',
    requiredParams: ['blocks'],
    optionalParams: [],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '2m'
  },

  build_structure: {
    type: 'build_structure',
    name: 'Build Structure (Smart)',
    description: 'Autonomously build a structure: checks inventory, gathers materials if needed, and places blocks. Handles both creative and survival mode.',
    requiredParams: ['blocks'],
    optionalParams: ['gatherMaterials'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '10m'
  },

  eat_food: {
    type: 'eat_food',
    name: 'Eat Food',
    description: 'Eat food to restore hunger',
    requiredParams: [],
    optionalParams: ['minHunger'],
    defaultPriority: 'high',
    canBeInterrupted: false,
    estimatedDuration: '3s'
  },

  flee_danger: {
    type: 'flee_danger',
    name: 'Flee Danger',
    description: 'Run away from hostile mobs',
    requiredParams: [],
    optionalParams: ['distance'],
    defaultPriority: 'critical',
    canBeInterrupted: false,
    estimatedDuration: '10s'
  },

  equip_item: {
    type: 'equip_item',
    name: 'Equip Item',
    description: 'Equip an item from inventory',
    requiredParams: ['itemName'],
    optionalParams: ['destination'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '1s'
  },

  drop_items: {
    type: 'drop_items',
    name: 'Drop Items',
    description: 'Drop items from inventory',
    requiredParams: ['itemName'],
    optionalParams: ['amount'],
    defaultPriority: 'low',
    canBeInterrupted: true,
    estimatedDuration: '2s'
  },

  collect_items: {
    type: 'collect_items',
    name: 'Collect Items',
    description: 'Collect dropped items nearby',
    requiredParams: ['itemName'],
    optionalParams: ['maxDistance'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '30s'
  }
};
