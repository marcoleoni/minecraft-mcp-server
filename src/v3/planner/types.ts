/**
 * Planner types and interfaces
 */

export type ActionType =
  | 'mine'
  | 'craft'
  | 'smelt'
  | 'build'
  | 'navigate'
  | 'equip'
  | 'place_crafting_table'
  | 'place_furnace'
  | 'collect'
  | 'attack'
  | 'eat'
  | 'use_creative';

export interface PlanAction {
  type: ActionType;
  description: string;
  params: Record<string, any>;
}

export interface Plan {
  goal: string;
  actions: PlanAction[];
  estimatedTime: number;  // rough seconds estimate
  requiredItems: Record<string, number>;  // final items needed
}

export interface Inventory {
  items: Map<string, number>;

  count(item: string): number;
  has(item: string, quantity?: number): boolean;
  add(item: string, quantity: number): void;
  remove(item: string, quantity: number): boolean;
  getAll(): { name: string; count: number }[];
  clone(): Inventory;
}

export interface BotState {
  position: { x: number; y: number; z: number };
  health: number;
  food: number;
  gameMode: 'survival' | 'creative' | 'adventure' | 'spectator';
  inventory: Inventory;
  nearbyBlocks: Map<string, { x: number; y: number; z: number }[]>;
  hasCraftingTable: boolean;
  hasFurnace: boolean;
}

export interface PlannerOptions {
  maxDepth: number;  // Maximum recursion depth for planning
  allowCraftingTablePlacement: boolean;  // Can we place a crafting table if needed?
  allowFurnacePlacement: boolean;  // Can we place a furnace if needed?
}

export const DEFAULT_PLANNER_OPTIONS: PlannerOptions = {
  maxDepth: 10,
  allowCraftingTablePlacement: true,
  allowFurnacePlacement: true,
};
