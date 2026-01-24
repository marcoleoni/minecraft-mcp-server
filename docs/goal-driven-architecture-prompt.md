# Minecraft MCP Server - Goal-Driven Architecture Refactor

## Overview

Questo documento descrive le modifiche da apportare al fork di `yuniko-software/minecraft-mcp-server` per implementare un'architettura Goal-Driven con sub-agent specializzato Minecraft.

**Obiettivi:**
1. Ridurre drasticamente i round-trip LLM (da 50+ a 3-5 per task complesso)
2. Permettere al bot Mineflayer di operare in autonomia su goal complessi
3. Implementare un sub-agent specializzato per la decomposizione dei task Minecraft
4. Mantenere compatibilità con l'architettura multi-bot già implementata

**Repository base:** https://github.com/marcoleoni/minecraft-mcp-server

---

## Architettura Target

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LLM Principale (Claude)                         │
│                    Riceve richieste utente ad alto livello              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ MCP Tools: delegate_task, get_status,
                                 │            cancel_task, list_capabilities
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          MCP Server (Node.js)                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      Task Orchestrator                            │  │
│  │  - Riceve task ad alto livello dall'LLM principale                │  │
│  │  - Invoca Sub-Agent per decomposizione                            │  │
│  │  - Gestisce la coda eventi per reporting                          │  │
│  └──────────────────────────────┬────────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────▼────────────────────────────────────┐  │
│  │                   Minecraft Sub-Agent                             │  │
│  │  - System prompt specializzato MC + Mineflayer                    │  │
│  │  - Decompone task in goal atomici                                 │  │
│  │  - Conosce crafting recipes, strategie, meccaniche                │  │
│  │  - Può essere modello più economico (Haiku/Sonnet)                │  │
│  └──────────────────────────────┬────────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────▼────────────────────────────────────┐  │
│  │                      Goal Manager                                 │  │
│  │  - Mantiene Goal Stack per ogni bot                               │  │
│  │  - Gestisce priorità e preemption                                 │  │
│  │  - Esegue behavior loop (~20 tick/sec)                            │  │
│  │  - Emette eventi su completamento/fallimento/eccezioni            │  │
│  └──────────────────────────────┬────────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────▼────────────────────────────────────┐  │
│  │                    Behavior Library                               │  │
│  │  Behavior atomici eseguibili localmente senza LLM:                │  │
│  │  - navigate_to, mine_block, place_block, craft_item               │  │
│  │  - attack_entity, flee_from, follow_entity                        │  │
│  │  - collect_items, store_items, equip_item                         │  │
│  │  - eat_food, sleep, wait_until                                    │  │
│  └──────────────────────────────┬────────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────▼────────────────────────────────────┐  │
│  │              Mineflayer Bot Instance(s)                           │  │
│  │  - pathfinder plugin                                              │  │
│  │  - pvp plugin                                                     │  │
│  │  - collectblock plugin                                            │  │
│  │  - auto-eat plugin (opzionale)                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Struttura File da Creare/Modificare

```
src/
├── index.ts                      # MODIFICARE: registrare nuovi tool MCP
├── bot/
│   └── bot-manager.ts            # ESISTENTE: gestione multi-bot (già implementato da Marco)
├── goals/                        # NUOVO: sistema goal-driven
│   ├── goal-manager.ts           # Goal stack e orchestrazione
│   ├── goal-types.ts             # Definizione tipi goal
│   └── goals/                    # Goal implementations
│       ├── mine-resource.goal.ts
│       ├── build-structure.goal.ts
│       ├── navigate.goal.ts
│       ├── craft-item.goal.ts
│       ├── survive.goal.ts
│       └── gather-materials.goal.ts
├── behaviors/                    # NUOVO: behavior atomici
│   ├── behavior-executor.ts      # Loop esecuzione behavior
│   ├── behavior-types.ts         # Interfacce behavior
│   └── behaviors/
│       ├── navigate.behavior.ts
│       ├── mine.behavior.ts
│       ├── place.behavior.ts
│       ├── craft.behavior.ts
│       ├── combat.behavior.ts
│       ├── inventory.behavior.ts
│       └── survival.behavior.ts
├── sub-agent/                    # NUOVO: sub-agent Minecraft
│   ├── minecraft-agent.ts        # Logica invocazione sub-agent
│   ├── agent-prompts.ts          # System prompt e templates
│   └── task-decomposer.ts        # Parsing output sub-agent
├── events/                       # NUOVO: sistema eventi
│   ├── event-queue.ts            # Coda eventi per reporting
│   └── event-types.ts            # Tipi eventi
├── tools/                        # MODIFICARE: nuovi tool MCP
│   ├── delegate-task.tool.ts     # NUOVO
│   ├── get-status.tool.ts        # NUOVO
│   ├── cancel-task.tool.ts       # NUOVO
│   ├── get-events.tool.ts        # NUOVO
│   ├── list-capabilities.tool.ts # NUOVO
│   └── ... (tool esistenti, mantenerli per retrocompatibilità)
└── knowledge/                    # NUOVO: knowledge base Minecraft
    ├── crafting-recipes.ts
    ├── block-properties.ts
    └── game-mechanics.ts
```

---

## Fase 1: Definizione Tipi e Interfacce

### File: `src/goals/goal-types.ts`

```typescript
export type GoalPriority = 'critical' | 'high' | 'normal' | 'low';

export type GoalStatus = 
  | 'pending'      // In attesa di esecuzione
  | 'active'       // In esecuzione
  | 'paused'       // Sospeso per goal prioritario
  | 'completed'    // Completato con successo
  | 'failed'       // Fallito
  | 'cancelled';   // Cancellato dall'utente

export interface GoalResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface GoalProgress {
  percentage: number;        // 0-100
  currentStep: string;       // Descrizione step corrente
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
  parentGoalId?: string;     // Per sub-goal
  subGoals: string[];        // IDs dei sub-goal
  result?: GoalResult;
  botId: string;             // Per multi-bot support
}

// Goal types disponibili
export type GoalType =
  // Navigazione
  | 'navigate_to_position'
  | 'navigate_to_entity'
  | 'explore_area'
  
  // Mining e risorse
  | 'mine_resource'
  | 'gather_wood'
  | 'gather_stone'
  | 'mine_ore'
  
  // Crafting
  | 'craft_item'
  | 'craft_tool'
  | 'craft_armor'
  
  // Costruzione
  | 'build_structure'
  | 'build_shelter'
  | 'place_blocks'
  | 'clear_area'
  
  // Survival
  | 'survive'              // Goal sempre attivo, priorità critica
  | 'eat_food'
  | 'find_shelter'
  | 'flee_danger'
  
  // Combat
  | 'attack_entity'
  | 'defend_position'
  | 'hunt_animals'
  
  // Inventory
  | 'organize_inventory'
  | 'store_items'
  | 'retrieve_items'
  
  // Composite/High-level
  | 'establish_base'
  | 'prepare_for_night'
  | 'gear_up';

// Configurazione per ogni tipo di goal
export interface GoalConfig {
  type: GoalType;
  name: string;
  description: string;
  requiredParams: string[];
  optionalParams: string[];
  defaultPriority: GoalPriority;
  canBeInterrupted: boolean;
  estimatedDuration: string;   // "30s", "5m", "unknown"
  decomposable: boolean;       // Se richiede sub-agent per decomposizione
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
    estimatedDuration: '30s',
    decomposable: false
  },
  
  mine_resource: {
    type: 'mine_resource',
    name: 'Mine Resource',
    description: 'Mine a specific resource type until target amount reached',
    requiredParams: ['resourceType', 'amount'],
    optionalParams: ['maxDistance', 'returnToStart'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '5m',
    decomposable: false
  },
  
  craft_item: {
    type: 'craft_item',
    name: 'Craft Item',
    description: 'Craft a specific item, gathering materials if needed',
    requiredParams: ['itemName', 'amount'],
    optionalParams: ['gatherMaterials'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '2m',
    decomposable: true  // Sub-agent calcola materiali necessari
  },
  
  build_structure: {
    type: 'build_structure',
    name: 'Build Structure',
    description: 'Build a structure based on description or blueprint',
    requiredParams: ['description'],
    optionalParams: ['position', 'materials', 'blueprint'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: 'unknown',
    decomposable: true  // Sub-agent crea piano costruzione
  },
  
  survive: {
    type: 'survive',
    name: 'Survive',
    description: 'Background goal: eat when hungry, flee danger, avoid death',
    requiredParams: [],
    optionalParams: ['aggressiveness'],
    defaultPriority: 'critical',
    canBeInterrupted: false,
    estimatedDuration: 'continuous',
    decomposable: false
  },
  
  establish_base: {
    type: 'establish_base',
    name: 'Establish Base',
    description: 'Find good location, build shelter, set up basic infrastructure',
    requiredParams: [],
    optionalParams: ['location', 'size', 'features'],
    defaultPriority: 'normal',
    canBeInterrupted: true,
    estimatedDuration: '30m',
    decomposable: true  // Sub-agent decompone in sub-goals
  },
  
  // ... definire altri goal configs
};
```

### File: `src/behaviors/behavior-types.ts`

```typescript
import { Bot } from 'mineflayer';

export type BehaviorStatus = 'idle' | 'running' | 'success' | 'failure';

export interface BehaviorContext {
  bot: Bot;
  goalId: string;
  params: Record<string, unknown>;
  signal: AbortSignal;  // Per cancellazione
}

export interface BehaviorResult {
  status: BehaviorStatus;
  message?: string;
  data?: Record<string, unknown>;
}

export interface Behavior {
  name: string;
  description: string;
  
  // Verifica se il behavior può essere eseguito
  canExecute(ctx: BehaviorContext): Promise<boolean>;
  
  // Esegue il behavior (può essere async/long-running)
  execute(ctx: BehaviorContext): Promise<BehaviorResult>;
  
  // Chiamato ogni tick mentre il behavior è attivo
  tick?(ctx: BehaviorContext): Promise<void>;
  
  // Cleanup quando il behavior viene interrotto
  abort?(ctx: BehaviorContext): Promise<void>;
}

// Registry dei behavior disponibili
export type BehaviorName =
  | 'navigate'
  | 'mine_block'
  | 'place_block'
  | 'craft'
  | 'smelt'
  | 'attack'
  | 'flee'
  | 'follow'
  | 'collect_items'
  | 'equip'
  | 'eat'
  | 'sleep'
  | 'wait'
  | 'look_at'
  | 'interact';
```

### File: `src/events/event-types.ts`

```typescript
export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

export type EventType =
  // Goal events
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
```

---

## Fase 2: Goal Manager

### File: `src/goals/goal-manager.ts`

```typescript
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Bot } from 'mineflayer';
import { 
  Goal, 
  GoalType, 
  GoalPriority, 
  GoalStatus, 
  GoalResult,
  GOAL_CONFIGS 
} from './goal-types';
import { BehaviorExecutor } from '../behaviors/behavior-executor';
import { EventQueue } from '../events/event-queue';
import { MinecraftSubAgent } from '../sub-agent/minecraft-agent';

interface BotGoalState {
  bot: Bot;
  goalStack: Goal[];
  activeGoal: Goal | null;
  behaviorExecutor: BehaviorExecutor;
}

export class GoalManager extends EventEmitter {
  private botStates: Map<string, BotGoalState> = new Map();
  private eventQueue: EventQueue;
  private subAgent: MinecraftSubAgent;
  private tickInterval: NodeJS.Timeout | null = null;
  private readonly TICK_RATE = 50; // 20 ticks/sec
  
  constructor(eventQueue: EventQueue, subAgent: MinecraftSubAgent) {
    super();
    this.eventQueue = eventQueue;
    this.subAgent = subAgent;
  }
  
  /**
   * Registra un bot nel goal manager
   */
  registerBot(botId: string, bot: Bot): void {
    if (this.botStates.has(botId)) {
      throw new Error(`Bot ${botId} already registered`);
    }
    
    this.botStates.set(botId, {
      bot,
      goalStack: [],
      activeGoal: null,
      behaviorExecutor: new BehaviorExecutor(bot)
    });
    
    // Setup event listeners per il bot
    this.setupBotEventListeners(botId, bot);
    
    // Aggiungi goal "survive" come default
    this.pushGoal(botId, 'survive', {}, 'critical');
  }
  
  /**
   * Rimuove un bot dal goal manager
   */
  unregisterBot(botId: string): void {
    const state = this.botStates.get(botId);
    if (state) {
      // Cancella tutti i goal
      state.goalStack.forEach(g => this.cancelGoal(botId, g.id));
      this.botStates.delete(botId);
    }
  }
  
  /**
   * Aggiunge un nuovo goal allo stack
   */
  async pushGoal(
    botId: string,
    goalType: GoalType,
    params: Record<string, unknown>,
    priority?: GoalPriority
  ): Promise<Goal> {
    const state = this.botStates.get(botId);
    if (!state) {
      throw new Error(`Bot ${botId} not registered`);
    }
    
    const config = GOAL_CONFIGS[goalType];
    if (!config) {
      throw new Error(`Unknown goal type: ${goalType}`);
    }
    
    // Valida parametri richiesti
    for (const param of config.requiredParams) {
      if (!(param in params)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
    
    const goal: Goal = {
      id: uuidv4(),
      type: goalType,
      params,
      priority: priority || config.defaultPriority,
      status: 'pending',
      progress: {
        percentage: 0,
        currentStep: 'Initializing',
        stepsCompleted: 0,
        totalSteps: 0
      },
      createdAt: new Date(),
      subGoals: [],
      botId
    };
    
    // Se il goal è decomposable, usa il sub-agent
    if (config.decomposable) {
      const subGoals = await this.subAgent.decomposeGoal(goal, state.bot);
      goal.subGoals = subGoals.map(sg => sg.id);
      
      // Aggiungi sub-goals allo stack
      for (const subGoal of subGoals) {
        subGoal.parentGoalId = goal.id;
        state.goalStack.push(subGoal);
      }
    }
    
    // Inserisci goal nello stack in base alla priorità
    this.insertGoalByPriority(state, goal);
    
    this.eventQueue.push({
      type: 'goal_started',
      severity: 'info',
      botId,
      goalId: goal.id,
      message: `Goal ${goalType} added to stack`,
      data: { params }
    });
    
    return goal;
  }
  
  /**
   * Inserisce un goal nello stack rispettando le priorità
   */
  private insertGoalByPriority(state: BotGoalState, goal: Goal): void {
    const priorityOrder: GoalPriority[] = ['critical', 'high', 'normal', 'low'];
    const goalPriorityIndex = priorityOrder.indexOf(goal.priority);
    
    // Trova la posizione corretta
    let insertIndex = state.goalStack.length;
    for (let i = 0; i < state.goalStack.length; i++) {
      const existingPriorityIndex = priorityOrder.indexOf(state.goalStack[i].priority);
      if (goalPriorityIndex < existingPriorityIndex) {
        insertIndex = i;
        break;
      }
    }
    
    state.goalStack.splice(insertIndex, 0, goal);
  }
  
  /**
   * Cancella un goal
   */
  async cancelGoal(botId: string, goalId: string): Promise<boolean> {
    const state = this.botStates.get(botId);
    if (!state) return false;
    
    const goalIndex = state.goalStack.findIndex(g => g.id === goalId);
    if (goalIndex === -1) return false;
    
    const goal = state.goalStack[goalIndex];
    
    // Cancella anche i sub-goals
    for (const subGoalId of goal.subGoals) {
      await this.cancelGoal(botId, subGoalId);
    }
    
    // Se è il goal attivo, abort il behavior
    if (state.activeGoal?.id === goalId) {
      await state.behaviorExecutor.abort();
      state.activeGoal = null;
    }
    
    goal.status = 'cancelled';
    goal.completedAt = new Date();
    state.goalStack.splice(goalIndex, 1);
    
    this.eventQueue.push({
      type: 'goal_cancelled',
      severity: 'info',
      botId,
      goalId,
      message: `Goal ${goal.type} cancelled`
    });
    
    return true;
  }
  
  /**
   * Ottiene lo stato attuale di un bot
   */
  getStatus(botId: string): {
    activeGoal: Goal | null;
    queuedGoals: Goal[];
    recentEvents: any[];
  } | null {
    const state = this.botStates.get(botId);
    if (!state) return null;
    
    return {
      activeGoal: state.activeGoal,
      queuedGoals: state.goalStack.filter(g => g.status === 'pending'),
      recentEvents: this.eventQueue.getEvents({ botId, limit: 10 })
    };
  }
  
  /**
   * Avvia il loop principale
   */
  start(): void {
    if (this.tickInterval) return;
    
    this.tickInterval = setInterval(() => {
      this.tick();
    }, this.TICK_RATE);
  }
  
  /**
   * Ferma il loop principale
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
  
  /**
   * Tick principale - eseguito 20 volte al secondo
   */
  private async tick(): Promise<void> {
    for (const [botId, state] of this.botStates) {
      try {
        await this.tickBot(botId, state);
      } catch (error) {
        console.error(`Error in tick for bot ${botId}:`, error);
        this.eventQueue.push({
          type: 'action_failed',
          severity: 'error',
          botId,
          message: `Tick error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
  }
  
  /**
   * Tick per un singolo bot
   */
  private async tickBot(botId: string, state: BotGoalState): Promise<void> {
    // 1. Check survival conditions (sempre, priorità massima)
    await this.checkSurvivalConditions(botId, state);
    
    // 2. Se non c'è goal attivo, prendi il prossimo dallo stack
    if (!state.activeGoal && state.goalStack.length > 0) {
      const nextGoal = state.goalStack.find(g => g.status === 'pending');
      if (nextGoal) {
        await this.activateGoal(botId, state, nextGoal);
      }
    }
    
    // 3. Se c'è un goal attivo, esegui tick del behavior
    if (state.activeGoal) {
      const result = await state.behaviorExecutor.tick();
      
      if (result.status === 'success') {
        await this.completeGoal(botId, state, state.activeGoal, {
          success: true,
          message: result.message || 'Goal completed'
        });
      } else if (result.status === 'failure') {
        await this.failGoal(botId, state, state.activeGoal, 
          result.message || 'Goal failed');
      }
      // Se running, continua al prossimo tick
    }
    
    // 4. Check se un goal a priorità più alta deve interrompere quello corrente
    await this.checkPreemption(botId, state);
  }
  
  /**
   * Controlla condizioni di sopravvivenza
   */
  private async checkSurvivalConditions(botId: string, state: BotGoalState): Promise<void> {
    const bot = state.bot;
    
    // Health check
    if (bot.health <= 6) { // 3 cuori
      this.eventQueue.push({
        type: 'health_critical',
        severity: 'critical',
        botId,
        message: `Health critical: ${bot.health}/20`
      });
    } else if (bot.health <= 10) {
      this.eventQueue.push({
        type: 'health_low',
        severity: 'warning',
        botId,
        message: `Health low: ${bot.health}/20`
      });
    }
    
    // Food check
    if (bot.food <= 6) {
      this.eventQueue.push({
        type: 'hunger_low',
        severity: 'warning',
        botId,
        message: `Hunger low: ${bot.food}/20`
      });
    }
    
    // Hostile mob nearby check
    const hostileMobs = Object.values(bot.entities).filter(e => 
      e.type === 'hostile' && 
      e.position.distanceTo(bot.entity.position) < 16
    );
    
    if (hostileMobs.length > 0) {
      this.eventQueue.push({
        type: 'mob_nearby',
        severity: 'warning',
        botId,
        message: `${hostileMobs.length} hostile mob(s) nearby`,
        data: { mobs: hostileMobs.map(m => m.name) }
      });
    }
  }
  
  /**
   * Attiva un goal
   */
  private async activateGoal(botId: string, state: BotGoalState, goal: Goal): Promise<void> {
    goal.status = 'active';
    goal.startedAt = new Date();
    state.activeGoal = goal;
    
    // Inizializza il behavior executor per questo goal
    await state.behaviorExecutor.startGoal(goal);
    
    this.eventQueue.push({
      type: 'goal_started',
      severity: 'info',
      botId,
      goalId: goal.id,
      message: `Started executing goal: ${goal.type}`
    });
  }
  
  /**
   * Completa un goal con successo
   */
  private async completeGoal(
    botId: string, 
    state: BotGoalState, 
    goal: Goal, 
    result: GoalResult
  ): Promise<void> {
    goal.status = 'completed';
    goal.completedAt = new Date();
    goal.result = result;
    goal.progress.percentage = 100;
    
    // Rimuovi dallo stack
    const index = state.goalStack.indexOf(goal);
    if (index > -1) {
      state.goalStack.splice(index, 1);
    }
    
    state.activeGoal = null;
    
    this.eventQueue.push({
      type: 'goal_completed',
      severity: 'info',
      botId,
      goalId: goal.id,
      message: result.message,
      data: result.data
    });
    
    // Se era un sub-goal, aggiorna il parent
    if (goal.parentGoalId) {
      await this.updateParentGoalProgress(botId, state, goal.parentGoalId);
    }
  }
  
  /**
   * Fallisce un goal
   */
  private async failGoal(
    botId: string, 
    state: BotGoalState, 
    goal: Goal, 
    errorMessage: string
  ): Promise<void> {
    goal.status = 'failed';
    goal.completedAt = new Date();
    goal.result = {
      success: false,
      message: errorMessage,
      error: errorMessage
    };
    
    // Rimuovi dallo stack
    const index = state.goalStack.indexOf(goal);
    if (index > -1) {
      state.goalStack.splice(index, 1);
    }
    
    state.activeGoal = null;
    
    this.eventQueue.push({
      type: 'goal_failed',
      severity: 'error',
      botId,
      goalId: goal.id,
      message: errorMessage
    });
  }
  
  /**
   * Verifica se un goal prioritario deve interrompere quello corrente
   */
  private async checkPreemption(botId: string, state: BotGoalState): Promise<void> {
    if (!state.activeGoal) return;
    
    const activeConfig = GOAL_CONFIGS[state.activeGoal.type];
    if (!activeConfig.canBeInterrupted) return;
    
    // Cerca goal con priorità più alta
    const higherPriorityGoal = state.goalStack.find(g => 
      g.status === 'pending' && 
      this.comparePriority(g.priority, state.activeGoal!.priority) > 0
    );
    
    if (higherPriorityGoal) {
      // Pausa goal corrente
      state.activeGoal.status = 'paused';
      await state.behaviorExecutor.pause();
      
      this.eventQueue.push({
        type: 'goal_paused',
        severity: 'info',
        botId,
        goalId: state.activeGoal.id,
        message: `Paused for higher priority goal: ${higherPriorityGoal.type}`
      });
      
      state.activeGoal = null;
    }
  }
  
  /**
   * Compara priorità (ritorna >0 se a > b)
   */
  private comparePriority(a: GoalPriority, b: GoalPriority): number {
    const order: GoalPriority[] = ['low', 'normal', 'high', 'critical'];
    return order.indexOf(a) - order.indexOf(b);
  }
  
  /**
   * Aggiorna il progresso di un parent goal
   */
  private async updateParentGoalProgress(
    botId: string, 
    state: BotGoalState, 
    parentGoalId: string
  ): Promise<void> {
    const parentGoal = state.goalStack.find(g => g.id === parentGoalId);
    if (!parentGoal) return;
    
    const completedSubGoals = parentGoal.subGoals.filter(subId => {
      const sub = state.goalStack.find(g => g.id === subId);
      return sub?.status === 'completed';
    });
    
    parentGoal.progress.stepsCompleted = completedSubGoals.length;
    parentGoal.progress.totalSteps = parentGoal.subGoals.length;
    parentGoal.progress.percentage = Math.round(
      (completedSubGoals.length / parentGoal.subGoals.length) * 100
    );
    
    // Se tutti i sub-goal sono completati, completa il parent
    if (completedSubGoals.length === parentGoal.subGoals.length) {
      await this.completeGoal(botId, state, parentGoal, {
        success: true,
        message: 'All sub-goals completed'
      });
    }
  }
  
  /**
   * Setup event listeners per il bot Mineflayer
   */
  private setupBotEventListeners(botId: string, bot: Bot): void {
    bot.on('health', () => {
      // Gestito in checkSurvivalConditions
    });
    
    bot.on('death', () => {
      this.eventQueue.push({
        type: 'bot_died',
        severity: 'critical',
        botId,
        message: 'Bot died'
      });
    });
    
    bot.on('spawn', () => {
      this.eventQueue.push({
        type: 'bot_respawned',
        severity: 'info',
        botId,
        message: 'Bot respawned'
      });
    });
    
    bot.on('entityHurt', (entity) => {
      if (entity === bot.entity) {
        this.eventQueue.push({
          type: 'took_damage',
          severity: 'warning',
          botId,
          message: `Took damage, health: ${bot.health}`,
          data: { health: bot.health }
        });
      }
    });
    
    bot.on('chat', (username, message) => {
      if (username !== bot.username) {
        this.eventQueue.push({
          type: 'player_message',
          severity: 'info',
          botId,
          message: `${username}: ${message}`,
          data: { username, message }
        });
      }
    });
  }
}
```

---

## Fase 3: Sub-Agent Minecraft

### File: `src/sub-agent/agent-prompts.ts`

```typescript
export const MINECRAFT_EXPERT_SYSTEM_PROMPT = `You are a Minecraft Expert Sub-Agent specialized in task decomposition and game strategy.

## Your Role
You receive high-level tasks from the main AI and decompose them into atomic, executable goals that a Mineflayer bot can perform.

## Your Knowledge
You have deep knowledge of:
- Minecraft game mechanics (survival, crafting, combat, farming, redstone)
- Crafting recipes and their dependencies
- Block properties and tool requirements
- Mob behavior and combat strategies
- Efficient resource gathering strategies
- Building techniques and patterns
- Biome characteristics and resources

## Available Goal Types
You can only output goals of these types:
- navigate_to_position: {x, y, z, sprint?, allowParkour?}
- mine_resource: {resourceType, amount, maxDistance?}
- gather_wood: {amount, woodType?}
- gather_stone: {amount}
- craft_item: {itemName, amount}
- place_block: {blockType, x, y, z}
- clear_area: {x1, y1, z1, x2, y2, z2}
- attack_entity: {entityType, count?}
- eat_food: {}
- equip_item: {itemName, destination}
- store_items: {itemTypes?, chestPosition?}

## Output Format
Always respond with a JSON array of goals in execution order:
\`\`\`json
{
  "analysis": "Brief analysis of the task",
  "goals": [
    {
      "type": "goal_type",
      "params": {...},
      "priority": "normal|high|critical",
      "description": "Human readable description",
      "estimatedTime": "30s|2m|5m|etc"
    }
  ],
  "notes": "Any important notes or warnings"
}
\`\`\`

## Crafting Knowledge (partial list)
- wooden_pickaxe: 3 planks + 2 sticks -> need 1 log minimum (4 planks, 2 for sticks)
- stone_pickaxe: 3 cobblestone + 2 sticks
- iron_pickaxe: 3 iron_ingot + 2 sticks
- furnace: 8 cobblestone
- crafting_table: 4 planks
- chest: 8 planks
- torch: 1 coal + 1 stick -> 4 torches
- iron_ingot: smelt iron_ore (need furnace + fuel)

## Mining Requirements
- wood: any tool or hand
- stone/cobblestone: wooden_pickaxe or better
- iron_ore: stone_pickaxe or better
- gold_ore: iron_pickaxe or better
- diamond_ore: iron_pickaxe or better
- obsidian: diamond_pickaxe

## Strategy Guidelines
1. Always check if prerequisites are met (tools, materials)
2. Prioritize getting basic tools early (wooden -> stone -> iron)
3. Consider efficiency: batch similar operations
4. Account for inventory space limitations (36 slots)
5. For building tasks, calculate exact material requirements
6. Add survival sub-goals if the task is long (food, shelter)`;

export const TASK_DECOMPOSITION_PROMPT = `
## Current Task
{task_description}

## Task Parameters
{task_params}

## Current Bot State
- Position: {position}
- Health: {health}/20
- Hunger: {food}/20
- Inventory: {inventory_summary}
- Nearby blocks: {nearby_blocks}
- Time of day: {time_of_day}
- Biome: {biome}

## Instructions
Decompose this task into atomic goals. Consider:
1. What materials/tools are needed?
2. What order should steps be executed?
3. Are there any prerequisites missing?
4. What could go wrong and how to handle it?

Respond with the JSON goal list.`;

export const BUILD_DECOMPOSITION_PROMPT = `
## Building Task
{building_description}

## Available Materials
{available_materials}

## Build Location
{location}

## Instructions
Create a building plan with:
1. Material requirements (be specific with quantities)
2. Build order (foundation first, then walls, then roof)
3. Block placement coordinates relative to starting position

Output goals for gathering materials (if needed) and placing each block.`;
```

### File: `src/sub-agent/minecraft-agent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Bot } from 'mineflayer';
import { Goal, GoalType, GoalPriority } from '../goals/goal-types';
import { v4 as uuidv4 } from 'uuid';
import { 
  MINECRAFT_EXPERT_SYSTEM_PROMPT, 
  TASK_DECOMPOSITION_PROMPT 
} from './agent-prompts';

interface DecomposedGoal {
  type: GoalType;
  params: Record<string, unknown>;
  priority: GoalPriority;
  description: string;
  estimatedTime: string;
}

interface DecompositionResult {
  analysis: string;
  goals: DecomposedGoal[];
  notes: string;
}

export class MinecraftSubAgent {
  private client: Anthropic;
  private model: string;
  
  constructor(apiKey?: string, model: string = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY
    });
    this.model = model;
  }
  
  /**
   * Decompone un goal complesso in sub-goals atomici
   */
  async decomposeGoal(goal: Goal, bot: Bot): Promise<Goal[]> {
    const botState = this.getBotStateForPrompt(bot);
    
    const prompt = TASK_DECOMPOSITION_PROMPT
      .replace('{task_description}', `${goal.type}: ${JSON.stringify(goal.params)}`)
      .replace('{task_params}', JSON.stringify(goal.params, null, 2))
      .replace('{position}', `${Math.floor(bot.entity.position.x)}, ${Math.floor(bot.entity.position.y)}, ${Math.floor(bot.entity.position.z)}`)
      .replace('{health}', String(bot.health))
      .replace('{food}', String(bot.food))
      .replace('{inventory_summary}', botState.inventorySummary)
      .replace('{nearby_blocks}', botState.nearbyBlocks)
      .replace('{time_of_day}', botState.timeOfDay)
      .replace('{biome}', botState.biome);
    
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: MINECRAFT_EXPERT_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }
      
      const result = this.parseDecompositionResult(content.text);
      
      return result.goals.map(dg => this.createGoalFromDecomposed(dg, goal.botId));
      
    } catch (error) {
      console.error('Sub-agent decomposition failed:', error);
      // Fallback: ritorna il goal originale senza decomposizione
      return [];
    }
  }
  
  /**
   * Ottiene lo stato del bot formattato per il prompt
   */
  private getBotStateForPrompt(bot: Bot): {
    inventorySummary: string;
    nearbyBlocks: string;
    timeOfDay: string;
    biome: string;
  } {
    // Inventory summary
    const items: Record<string, number> = {};
    for (const item of bot.inventory.items()) {
      items[item.name] = (items[item.name] || 0) + item.count;
    }
    const inventorySummary = Object.entries(items)
      .map(([name, count]) => `${name}: ${count}`)
      .join(', ') || 'empty';
    
    // Nearby blocks (simplified)
    const nearbyBlocks: string[] = [];
    const pos = bot.entity.position;
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -4; dz <= 4; dz++) {
          const block = bot.blockAt(pos.offset(dx, dy, dz));
          if (block && block.name !== 'air' && !nearbyBlocks.includes(block.name)) {
            nearbyBlocks.push(block.name);
          }
        }
      }
    }
    
    // Time of day
    const time = bot.time.timeOfDay;
    let timeOfDay: string;
    if (time < 6000) timeOfDay = 'morning';
    else if (time < 12000) timeOfDay = 'day';
    else if (time < 13000) timeOfDay = 'sunset';
    else if (time < 23000) timeOfDay = 'night';
    else timeOfDay = 'sunrise';
    
    // Biome (se disponibile)
    const biome = 'unknown'; // bot.world.biome potrebbe non essere disponibile
    
    return {
      inventorySummary,
      nearbyBlocks: nearbyBlocks.slice(0, 20).join(', '),
      timeOfDay,
      biome
    };
  }
  
  /**
   * Parsing della risposta del sub-agent
   */
  private parseDecompositionResult(text: string): DecompositionResult {
    // Estrai JSON dalla risposta
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    
    // Prova a parsare direttamente
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Failed to parse sub-agent response');
    }
  }
  
  /**
   * Crea un Goal object da un DecomposedGoal
   */
  private createGoalFromDecomposed(dg: DecomposedGoal, botId: string): Goal {
    return {
      id: uuidv4(),
      type: dg.type,
      params: dg.params,
      priority: dg.priority,
      status: 'pending',
      progress: {
        percentage: 0,
        currentStep: dg.description,
        stepsCompleted: 0,
        totalSteps: 1
      },
      createdAt: new Date(),
      subGoals: [],
      botId
    };
  }
}
```

---

## Fase 4: Event Queue

### File: `src/events/event-queue.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import { BotEvent, EventType, EventSeverity, EventFilter } from './event-types';

export class EventQueue {
  private events: BotEvent[] = [];
  private maxEvents: number;
  
  constructor(maxEvents: number = 1000) {
    this.maxEvents = maxEvents;
  }
  
  /**
   * Aggiunge un evento alla coda
   */
  push(event: Omit<BotEvent, 'id' | 'timestamp' | 'acknowledged'>): BotEvent {
    const fullEvent: BotEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date(),
      acknowledged: false
    };
    
    this.events.push(fullEvent);
    
    // Rimuovi eventi vecchi se superiamo il limite
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    
    return fullEvent;
  }
  
  /**
   * Ottiene eventi con filtri opzionali
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
    
    // Ordina per timestamp decrescente (più recenti prima)
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }
    
    return result;
  }
  
  /**
   * Marca eventi come acknowledged
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
   * Rimuove tutti gli eventi acknowledged
   */
  clearAcknowledged(): number {
    const before = this.events.length;
    this.events = this.events.filter(e => !e.acknowledged);
    return before - this.events.length;
  }
  
  /**
   * Conta eventi non acknowledged per severità
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
```

---

## Fase 5: Nuovi Tool MCP

### File: `src/tools/delegate-task.tool.ts`

```typescript
import { z } from 'zod';
import { GoalManager } from '../goals/goal-manager';
import { GoalType, GOAL_CONFIGS } from '../goals/goal-types';

export const DelegateTaskSchema = z.object({
  botId: z.string().optional().describe('ID del bot (opzionale se single-bot)'),
  goalType: z.string().describe('Tipo di goal da eseguire'),
  params: z.record(z.unknown()).describe('Parametri del goal'),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional()
    .describe('Priorità del goal (default: normal)')
});

export type DelegateTaskInput = z.infer<typeof DelegateTaskSchema>;

export function createDelegateTaskTool(goalManager: GoalManager, defaultBotId: string) {
  return {
    name: 'delegate_task',
    description: `Delegate a complex task to the Minecraft bot. The bot will execute it autonomously.
    
Available goal types:
${Object.entries(GOAL_CONFIGS).map(([type, config]) => 
  `- ${type}: ${config.description} (params: ${config.requiredParams.join(', ')})`
).join('\n')}

The bot will decompose complex tasks into sub-goals automatically and execute them.
Use get_status to monitor progress and get_events to see what happened.`,
    
    inputSchema: DelegateTaskSchema,
    
    handler: async (input: DelegateTaskInput) => {
      const botId = input.botId || defaultBotId;
      const goalType = input.goalType as GoalType;
      
      if (!GOAL_CONFIGS[goalType]) {
        return {
          success: false,
          error: `Unknown goal type: ${goalType}. Available: ${Object.keys(GOAL_CONFIGS).join(', ')}`
        };
      }
      
      try {
        const goal = await goalManager.pushGoal(
          botId,
          goalType,
          input.params,
          input.priority
        );
        
        return {
          success: true,
          goalId: goal.id,
          message: `Task delegated: ${goalType}`,
          tip: 'Use get_status to monitor progress or get_events to see what happens'
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  };
}
```

### File: `src/tools/get-status.tool.ts`

```typescript
import { z } from 'zod';
import { GoalManager } from '../goals/goal-manager';

export const GetStatusSchema = z.object({
  botId: z.string().optional().describe('ID del bot (opzionale se single-bot)'),
  includeEvents: z.boolean().optional().default(true)
    .describe('Include recent events in response')
});

export type GetStatusInput = z.infer<typeof GetStatusSchema>;

export function createGetStatusTool(goalManager: GoalManager, defaultBotId: string) {
  return {
    name: 'get_status',
    description: `Get the current status of a bot including:
- Active goal and its progress
- Queued goals
- Recent events (completions, failures, warnings)

Use this to check on delegated tasks without interrupting execution.`,
    
    inputSchema: GetStatusSchema,
    
    handler: async (input: GetStatusInput) => {
      const botId = input.botId || defaultBotId;
      const status = goalManager.getStatus(botId);
      
      if (!status) {
        return {
          success: false,
          error: `Bot ${botId} not found`
        };
      }
      
      return {
        success: true,
        botId,
        activeGoal: status.activeGoal ? {
          id: status.activeGoal.id,
          type: status.activeGoal.type,
          status: status.activeGoal.status,
          progress: status.activeGoal.progress
        } : null,
        queuedGoals: status.queuedGoals.map(g => ({
          id: g.id,
          type: g.type,
          priority: g.priority
        })),
        recentEvents: input.includeEvents ? status.recentEvents : []
      };
    }
  };
}
```

### File: `src/tools/get-events.tool.ts`

```typescript
import { z } from 'zod';
import { EventQueue } from '../events/event-queue';

export const GetEventsSchema = z.object({
  botId: z.string().optional().describe('Filter by bot ID'),
  goalId: z.string().optional().describe('Filter by goal ID'),
  types: z.array(z.string()).optional().describe('Filter by event types'),
  severity: z.array(z.enum(['info', 'warning', 'error', 'critical'])).optional()
    .describe('Filter by severity'),
  limit: z.number().optional().default(20).describe('Max events to return'),
  unacknowledgedOnly: z.boolean().optional().default(false)
    .describe('Only return unacknowledged events'),
  acknowledge: z.boolean().optional().default(false)
    .describe('Mark returned events as acknowledged')
});

export type GetEventsInput = z.infer<typeof GetEventsSchema>;

export function createGetEventsTool(eventQueue: EventQueue) {
  return {
    name: 'get_events',
    description: `Get events from the bot's event queue.

Event types include:
- goal_started, goal_completed, goal_failed, goal_cancelled
- health_low, health_critical, bot_died, took_damage
- found_resource, found_structure, mob_nearby
- player_message, inventory_full, tool_broken

Use this to understand what happened while the bot was working autonomously.`,
    
    inputSchema: GetEventsSchema,
    
    handler: async (input: GetEventsInput) => {
      const events = eventQueue.getEvents({
        botId: input.botId,
        goalId: input.goalId,
        types: input.types as any,
        severity: input.severity,
        limit: input.limit,
        unacknowledgedOnly: input.unacknowledgedOnly
      });
      
      if (input.acknowledge && events.length > 0) {
        eventQueue.acknowledge(events.map(e => e.id));
      }
      
      const counts = eventQueue.getUnacknowledgedCounts();
      
      return {
        success: true,
        events: events.map(e => ({
          id: e.id,
          type: e.type,
          severity: e.severity,
          message: e.message,
          timestamp: e.timestamp.toISOString(),
          data: e.data
        })),
        unacknowledgedCounts: counts,
        total: events.length
      };
    }
  };
}
```

### File: `src/tools/cancel-task.tool.ts`

```typescript
import { z } from 'zod';
import { GoalManager } from '../goals/goal-manager';

export const CancelTaskSchema = z.object({
  botId: z.string().optional().describe('ID del bot'),
  goalId: z.string().describe('ID del goal da cancellare')
});

export type CancelTaskInput = z.infer<typeof CancelTaskSchema>;

export function createCancelTaskTool(goalManager: GoalManager, defaultBotId: string) {
  return {
    name: 'cancel_task',
    description: 'Cancel a running or queued task/goal. This will also cancel all sub-goals.',
    
    inputSchema: CancelTaskSchema,
    
    handler: async (input: CancelTaskInput) => {
      const botId = input.botId || defaultBotId;
      const cancelled = await goalManager.cancelGoal(botId, input.goalId);
      
      return {
        success: cancelled,
        message: cancelled 
          ? `Goal ${input.goalId} cancelled` 
          : `Goal ${input.goalId} not found`
      };
    }
  };
}
```

### File: `src/tools/list-capabilities.tool.ts`

```typescript
import { z } from 'zod';
import { GOAL_CONFIGS } from '../goals/goal-types';

export const ListCapabilitiesSchema = z.object({
  category: z.string().optional().describe('Filter by category (movement, mining, building, etc.)')
});

export function createListCapabilitiesTool() {
  return {
    name: 'list_capabilities',
    description: 'List all available goal types the bot can execute with their parameters.',
    
    inputSchema: ListCapabilitiesSchema,
    
    handler: async (input: { category?: string }) => {
      const capabilities = Object.entries(GOAL_CONFIGS).map(([type, config]) => ({
        type,
        name: config.name,
        description: config.description,
        requiredParams: config.requiredParams,
        optionalParams: config.optionalParams,
        defaultPriority: config.defaultPriority,
        estimatedDuration: config.estimatedDuration,
        decomposable: config.decomposable
      }));
      
      return {
        success: true,
        capabilities,
        count: capabilities.length
      };
    }
  };
}
```

---

## Fase 6: Integrazione in index.ts

### Modifiche a `src/index.ts`

```typescript
// Aggiungi questi import
import { GoalManager } from './goals/goal-manager';
import { EventQueue } from './events/event-queue';
import { MinecraftSubAgent } from './sub-agent/minecraft-agent';
import { createDelegateTaskTool } from './tools/delegate-task.tool';
import { createGetStatusTool } from './tools/get-status.tool';
import { createGetEventsTool } from './tools/get-events.tool';
import { createCancelTaskTool } from './tools/cancel-task.tool';
import { createListCapabilitiesTool } from './tools/list-capabilities.tool';

// Nella funzione di setup del server MCP, dopo la creazione del bot:

// Inizializza i nuovi componenti
const eventQueue = new EventQueue(1000);
const subAgent = new MinecraftSubAgent(
  process.env.ANTHROPIC_API_KEY,
  'claude-sonnet-4-20250514' // Modello per il sub-agent
);
const goalManager = new GoalManager(eventQueue, subAgent);

// Registra il bot nel goal manager
goalManager.registerBot('default', bot);

// Avvia il goal manager loop
goalManager.start();

// Registra i nuovi tool MCP
server.tool(createDelegateTaskTool(goalManager, 'default'));
server.tool(createGetStatusTool(goalManager, 'default'));
server.tool(createGetEventsTool(eventQueue));
server.tool(createCancelTaskTool(goalManager, 'default'));
server.tool(createListCapabilitiesTool());

// IMPORTANTE: Mantieni anche i tool esistenti per retrocompatibilità
// I tool come move-to-position, dig-block etc. rimangono disponibili
// per quando l'LLM vuole controllo diretto
```

---

## Fase 7: Behavior Executor (Implementazione Base)

### File: `src/behaviors/behavior-executor.ts`

```typescript
import { Bot } from 'mineflayer';
import { Goal } from '../goals/goal-types';
import { Behavior, BehaviorResult, BehaviorStatus } from './behavior-types';
import { pathfinder, Movements, goals as pathfinderGoals } from 'mineflayer-pathfinder';

// Import dei behavior specifici
import { NavigateBehavior } from './behaviors/navigate.behavior';
import { MineBehavior } from './behaviors/mine.behavior';
import { CraftBehavior } from './behaviors/craft.behavior';
// ... altri behavior

export class BehaviorExecutor {
  private bot: Bot;
  private currentBehavior: Behavior | null = null;
  private currentGoal: Goal | null = null;
  private abortController: AbortController | null = null;
  private behaviors: Map<string, Behavior> = new Map();
  
  constructor(bot: Bot) {
    this.bot = bot;
    this.initializeBehaviors();
  }
  
  private initializeBehaviors(): void {
    // Registra tutti i behavior disponibili
    this.behaviors.set('navigate', new NavigateBehavior());
    this.behaviors.set('mine', new MineBehavior());
    this.behaviors.set('craft', new CraftBehavior());
    // ... altri behavior
  }
  
  /**
   * Avvia l'esecuzione di un goal
   */
  async startGoal(goal: Goal): Promise<void> {
    this.currentGoal = goal;
    this.abortController = new AbortController();
    
    // Mappa goal type -> behavior
    const behaviorName = this.mapGoalToBehavior(goal.type);
    this.currentBehavior = this.behaviors.get(behaviorName) || null;
    
    if (this.currentBehavior) {
      const ctx = {
        bot: this.bot,
        goalId: goal.id,
        params: goal.params,
        signal: this.abortController.signal
      };
      
      const canExecute = await this.currentBehavior.canExecute(ctx);
      if (!canExecute) {
        throw new Error(`Cannot execute behavior ${behaviorName}: preconditions not met`);
      }
      
      // Avvia l'esecuzione (non awaita, il tick gestirà il progresso)
      this.currentBehavior.execute(ctx).catch(err => {
        console.error(`Behavior execution error:`, err);
      });
    }
  }
  
  /**
   * Tick chiamato dal goal manager
   */
  async tick(): Promise<BehaviorResult> {
    if (!this.currentBehavior || !this.currentGoal) {
      return { status: 'idle' };
    }
    
    const ctx = {
      bot: this.bot,
      goalId: this.currentGoal.id,
      params: this.currentGoal.params,
      signal: this.abortController!.signal
    };
    
    if (this.currentBehavior.tick) {
      await this.currentBehavior.tick(ctx);
    }
    
    // Verifica stato (da implementare nel behavior specifico)
    return { status: 'running' };
  }
  
  /**
   * Pausa l'esecuzione corrente
   */
  async pause(): Promise<void> {
    // Stop pathfinding se attivo
    if (this.bot.pathfinder) {
      this.bot.pathfinder.stop();
    }
  }
  
  /**
   * Abort completo
   */
  async abort(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    if (this.currentBehavior?.abort) {
      await this.currentBehavior.abort({
        bot: this.bot,
        goalId: this.currentGoal?.id || '',
        params: {},
        signal: new AbortController().signal
      });
    }
    
    this.bot.pathfinder?.stop();
    this.currentBehavior = null;
    this.currentGoal = null;
  }
  
  /**
   * Mappa goal type a behavior name
   */
  private mapGoalToBehavior(goalType: string): string {
    const mapping: Record<string, string> = {
      'navigate_to_position': 'navigate',
      'navigate_to_entity': 'navigate',
      'mine_resource': 'mine',
      'gather_wood': 'mine',
      'gather_stone': 'mine',
      'craft_item': 'craft',
      // ... altre mappature
    };
    
    return mapping[goalType] || goalType;
  }
}
```

---

## Piano di Implementazione

### Step 1: Setup Base (1-2 ore)
- [ ] Creare la struttura directory
- [ ] Implementare `goal-types.ts` con tutti i tipi
- [ ] Implementare `event-types.ts`
- [ ] Implementare `EventQueue`

### Step 2: Goal Manager Core (2-3 ore)
- [ ] Implementare `GoalManager` base (senza sub-agent)
- [ ] Testare push/cancel goal
- [ ] Implementare tick loop
- [ ] Testare priorità e preemption

### Step 3: Behavior Executor (3-4 ore)
- [ ] Implementare `BehaviorExecutor`
- [ ] Implementare `NavigateBehavior` (usa pathfinder)
- [ ] Implementare `MineBehavior`
- [ ] Implementare `CraftBehavior`
- [ ] Testare esecuzione behavior base

### Step 4: Sub-Agent (2-3 ore)
- [ ] Implementare `MinecraftSubAgent`
- [ ] Testare decomposizione goal semplici
- [ ] Raffinare prompt per building tasks
- [ ] Testare decomposizione goal complessi

### Step 5: Tool MCP (1-2 ore)
- [ ] Implementare `delegate_task`
- [ ] Implementare `get_status`
- [ ] Implementare `get_events`
- [ ] Implementare `cancel_task`
- [ ] Implementare `list_capabilities`

### Step 6: Integrazione (1-2 ore)
- [ ] Modificare `index.ts`
- [ ] Integrare con gestione multi-bot esistente
- [ ] Testare end-to-end con Claude Desktop

### Step 7: Testing & Refinement (ongoing)
- [ ] Testare scenari complessi (build house)
- [ ] Ottimizzare prompt sub-agent
- [ ] Aggiungere più behavior
- [ ] Documentare API

---

## Note per Claude Code

1. **Non rimuovere i tool esistenti** - Mantienili per retrocompatibilità
2. **Usa i plugin Mineflayer esistenti** - pathfinder, pvp, etc.
3. **Gestisci errori gracefully** - Il bot non deve crashare
4. **Log tutto** - Aiuta il debugging
5. **Testa incrementalmente** - Un componente alla volta
6. **La API key Anthropic** è necessaria per il sub-agent, deve essere passata come env var

## Dipendenze da Aggiungere

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0"
  }
}
```

---

## Esempio di Utilizzo Finale

**Prima (Yuniko originale):**
```
User: "Costruisci una casa di legno"
LLM: [chiama move-to-position 50 volte, dig-block 200 volte, place-block 300 volte...]
Tempo: 20+ minuti di round-trip
```

**Dopo (con questo refactor):**
```
User: "Costruisci una casa di legno"
LLM: [chiama delegate_task con goal_type="build_structure", params={description: "wooden house 5x5"}]
Bot: [sub-agent decompone, bot esegue autonomamente]
LLM: [ogni tanto chiama get_status per vedere progresso]
LLM: [riceve goal_completed event]
Tempo: 5-10 minuti di esecuzione effettiva, 3-5 round-trip LLM
```
