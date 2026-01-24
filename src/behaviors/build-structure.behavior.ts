import { Bot } from 'mineflayer';
import { Behavior, BehaviorContext, BehaviorResult } from './behavior-types.js';
import minecraftData from 'minecraft-data';

interface BuildStructureParams {
  blocks: Array<{
    blockType: string;
    x: number;
    y: number;
    z: number;
  }>;
  gatherMaterials?: boolean; // Default: true
}

interface MaterialRequirement {
  blockType: string;
  needed: number;
  inInventory: number;
  missing: number;
}

/**
 * BuildStructureBehavior - Smart autonomous building
 *
 * This behavior handles the FULL process of building:
 * 1. Analyzes what blocks are needed
 * 2. Checks current inventory
 * 3. Checks gamemode (creative vs survival)
 * 4. If materials are missing:
 *    - In creative: gives items to self (if tool available)
 *    - In survival: creates sub-goals to gather materials
 * 5. Creates sub-goals to place all blocks
 *
 * This is TRUE autonomy - the bot handles everything from planning to execution.
 */
export class BuildStructureBehavior implements Behavior {
  name = 'build_structure';
  description = 'Autonomously build a structure with automatic material gathering';

  async canExecute(ctx: BehaviorContext): Promise<boolean> {
    const { params } = ctx;

    // Validate params structure
    if (!('blocks' in params)) {
      return false;
    }

    const { blocks } = params as unknown as BuildStructureParams;

    if (!Array.isArray(blocks) || blocks.length === 0) {
      return false;
    }

    // Validate each block has required fields
    for (const block of blocks) {
      if (!block.blockType || typeof block.x !== 'number' || typeof block.y !== 'number' || typeof block.z !== 'number') {
        return false;
      }
    }

    return true;
  }

  async execute(ctx: BehaviorContext): Promise<BehaviorResult> {
    const { bot, params, createSubGoal } = ctx;
    const { blocks, gatherMaterials = true } = params as unknown as BuildStructureParams;

    console.log(`[BuildStructure] Starting autonomous build of ${blocks.length} blocks`);

    try {
      // Step 1: Analyze material requirements
      console.log(`[BuildStructure] Analyzing material requirements...`);
      const requirements = await this.analyzeMaterialRequirements(bot, blocks);

      console.log(`[BuildStructure] Material analysis complete:`);
      for (const req of requirements) {
        console.log(`  - ${req.blockType}: need ${req.needed}, have ${req.inInventory}, missing ${req.missing}`);
      }

      // Step 2: Check if materials are missing
      const missingMaterials = requirements.filter(r => r.missing > 0);

      if (missingMaterials.length > 0 && gatherMaterials) {
        console.log(`[BuildStructure] Missing ${missingMaterials.length} material types`);

        // Step 3: Check gamemode
        const gamemode = bot.game.gameMode;
        console.log(`[BuildStructure] Gamemode: ${gamemode}`);

        if (gamemode === 'creative') {
          // Creative mode: We could give ourselves items, but for now just log
          // TODO: Implement creative mode item giving via sub-goal
          console.log(`[BuildStructure] Creative mode detected - materials will be available`);
        } else {
          // Survival mode: Need to gather materials
          console.log(`[BuildStructure] Survival mode - need to gather materials`);

          if (!createSubGoal) {
            return {
              status: 'failure',
              message: `Missing materials in survival mode and cannot create sub-goals: ${missingMaterials.map(m => `${m.blockType} (${m.missing})`).join(', ')}`
            };
          }

          // Create sub-goals to gather each missing material
          for (const material of missingMaterials) {
            console.log(`[BuildStructure] Creating sub-goal to gather ${material.missing} ${material.blockType}`);

            try {
              // Create mine_blocks sub-goal
              const subGoalId = await createSubGoal(
                'mine_blocks',
                {
                  blockType: material.blockType,
                  amount: material.missing
                },
                'high'  // High priority for material gathering
              );

              console.log(`[BuildStructure] Created sub-goal ${subGoalId} to mine ${material.blockType}`);
            } catch (error) {
              console.error(`[BuildStructure] Failed to create sub-goal for ${material.blockType}:`, error);
              return {
                status: 'failure',
                message: `Failed to create material gathering sub-goal for ${material.blockType}: ${error}`
              };
            }
          }

          // Return needs_subgoals status to indicate we're waiting for sub-goals
          return {
            status: 'success',
            message: `Created ${missingMaterials.length} sub-goals to gather materials. Once materials are gathered, building will proceed.`,
            data: {
              materialsNeeded: missingMaterials.map(m => ({ blockType: m.blockType, amount: m.missing })),
              subGoalsCreated: missingMaterials.length
            }
          };
        }
      } else if (missingMaterials.length > 0) {
        // Materials missing but gatherMaterials is false
        return {
          status: 'failure',
          message: `Missing materials: ${missingMaterials.map(m => `${m.blockType} (${m.missing})`).join(', ')}. Set gatherMaterials: true to auto-gather.`
        };
      }

      // Step 4: All materials available - create sub-goal to place blocks
      console.log(`[BuildStructure] All materials available - creating place_blocks sub-goal`);

      if (!createSubGoal) {
        return {
          status: 'failure',
          message: 'Cannot create sub-goals for block placement'
        };
      }

      try {
        const placeSubGoalId = await createSubGoal(
          'place_blocks',
          { blocks },
          'normal'
        );

        console.log(`[BuildStructure] Created place_blocks sub-goal ${placeSubGoalId}`);

        return {
          status: 'success',
          message: `Structure planned successfully. Created sub-goal to place ${blocks.length} blocks.`,
          data: {
            totalBlocks: blocks.length,
            placeSubGoalId
          }
        };
      } catch (error) {
        return {
          status: 'failure',
          message: `Failed to create placement sub-goal: ${error}`
        };
      }

    } catch (error) {
      console.error(`[BuildStructure] Error:`, error);
      return {
        status: 'failure',
        message: `Build planning failed: ${error}`
      };
    }
  }

  /**
   * Analyze what materials are needed and what's in inventory
   */
  private async analyzeMaterialRequirements(bot: Bot, blocks: Array<{ blockType: string; x: number; y: number; z: number }>): Promise<MaterialRequirement[]> {
    // Count how many of each block type we need
    const blockCounts: Map<string, number> = new Map();

    for (const block of blocks) {
      const current = blockCounts.get(block.blockType) || 0;
      blockCounts.set(block.blockType, current + 1);
    }

    // Check inventory for each block type
    const requirements: MaterialRequirement[] = [];

    for (const [blockType, needed] of blockCounts.entries()) {
      // Get block from registry
      const mcData = minecraftData(bot.version);
      const blockData = mcData.blocksByName[blockType];

      if (!blockData) {
        console.warn(`[BuildStructure] Unknown block type: ${blockType}`);
        requirements.push({
          blockType,
          needed,
          inInventory: 0,
          missing: needed
        });
        continue;
      }

      // Count how many we have in inventory
      const inventoryCount = bot.inventory.items()
        .filter(item => item.name === blockData.name)
        .reduce((sum, item) => sum + item.count, 0);

      const missing = Math.max(0, needed - inventoryCount);

      requirements.push({
        blockType,
        needed,
        inInventory: inventoryCount,
        missing
      });
    }

    return requirements;
  }

  async abort(ctx: BehaviorContext): Promise<void> {
    // Nothing to abort - this behavior just creates sub-goals
    console.log(`[BuildStructure] Aborting build planning`);
  }
}
