import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import minecraftData from 'minecraft-data';

/**
 * Composite tools - High-level operations that combine multiple actions
 * These tools reduce the number of round-trips by doing complex operations in one call
 */
export function registerCompositeTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  // collect-nearest-item: Find and collect the nearest item
  factory.registerTool(
    "collect-nearest-item",
    "Find the nearest dropped item of a specific type and collect it. Combines finding, pathfinding, and collection in one operation.",
    {
      itemName: z.string().describe("Name of the item to collect (e.g., 'dirt', 'stone', 'diamond')"),
      maxDistance: z.number().optional().describe("Maximum search distance in blocks (default: 32)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { itemName, maxDistance = 32 } = args;

      // Find nearest item
      const item = bot.nearestEntity((entity: any) => {
        return entity.name === 'item' &&
               entity.getDroppedItem?.()?.name === itemName &&
               entity.position.distanceTo(bot.entity.position) <= maxDistance;
      });

      if (!item) {
        return factory.createResponse(`No ${itemName} found within ${maxDistance} blocks`);
      }

      const distance = item.position.distanceTo(bot.entity.position);

      // Move to item
      try {
        const goal = new goals.GoalNear(item.position.x, item.position.y, item.position.z, 1);
        await bot.pathfinder.goto(goal);

        // Wait a bit for collection
        await new Promise(resolve => setTimeout(resolve, 500));

        return factory.createResponse(`Successfully collected ${itemName} (was ${distance.toFixed(1)} blocks away)`);
      } catch (error) {
        return factory.createErrorResponse(`Failed to collect ${itemName}: ${error}`);
      }
    },
    true
  );

  // mine-block-at: Go to location and mine the block
  factory.registerTool(
    "mine-block-at",
    "Move to a specific location and mine the block there. Combines movement, looking, and mining.",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { x, y, z } = args;

      const targetPos = new Vec3(x, y, z);
      const block = bot.blockAt(targetPos);

      if (!block) {
        return factory.createErrorResponse(`No block found at (${x}, ${y}, ${z})`);
      }

      const blockName = block.name;

      try {
        // Move close to the block
        const goal = new goals.GoalNear(x, y, z, 4);
        await bot.pathfinder.goto(goal);

        // Look at the block
        await bot.lookAt(targetPos, true);

        // Mine the block
        await bot.dig(block);

        return factory.createResponse(`Successfully mined ${blockName} at (${x}, ${y}, ${z})`);
      } catch (error) {
        return factory.createErrorResponse(`Failed to mine block: ${error}`);
      }
    },
    true
  );

  // attack-nearest-entity: Find and attack the nearest entity of a type
  factory.registerTool(
    "attack-nearest-entity",
    "Find and attack the nearest entity of a specific type. Combines finding, pathfinding, and attacking.",
    {
      entityType: z.string().describe("Type of entity to attack (e.g., 'zombie', 'skeleton', 'cow')"),
      maxDistance: z.number().optional().describe("Maximum search distance in blocks (default: 16)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { entityType, maxDistance = 16 } = args;

      const target = bot.nearestEntity((entity: any) => {
        return entity.name === entityType &&
               entity.position.distanceTo(bot.entity.position) <= maxDistance;
      });

      if (!target) {
        return factory.createResponse(`No ${entityType} found within ${maxDistance} blocks`);
      }

      const distance = target.position.distanceTo(bot.entity.position);

      try {
        // Move closer if needed
        if (distance > 3) {
          const goal = new goals.GoalNear(target.position.x, target.position.y, target.position.z, 3);
          await bot.pathfinder.goto(goal);
        }

        // Attack
        await bot.attack(target);

        return factory.createResponse(`Attacked ${entityType} at distance ${distance.toFixed(1)} blocks`);
      } catch (error) {
        return factory.createErrorResponse(`Failed to attack ${entityType}: ${error}`);
      }
    },
    true
  );

  // gather-resources: Collect a specific quantity of a resource
  factory.registerTool(
    "gather-resources",
    "Gather a specific quantity of a resource by repeatedly mining blocks. High-level operation for resource collection.",
    {
      blockType: z.string().describe("Type of block to mine (e.g., 'oak_log', 'stone', 'iron_ore')"),
      quantity: z.number().describe("Quantity to gather"),
      searchRadius: z.number().optional().describe("Search radius in blocks (default: 32)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { blockType, quantity, searchRadius = 32 } = args;

      const mcData = minecraftData(bot.version);
      const blockId = mcData.blocksByName[blockType]?.id;

      if (!blockId) {
        return factory.createErrorResponse(`Unknown block type: ${blockType}`);
      }

      let gathered = 0;
      const startTime = Date.now();
      const maxAttempts = quantity * 3; // Avoid infinite loops
      let attempts = 0;

      try {
        while (gathered < quantity && attempts < maxAttempts) {
          attempts++;

          // Find nearest block of this type
          const block = bot.findBlock({
            matching: blockId,
            maxDistance: searchRadius
          });

          if (!block) {
            break; // No more blocks found
          }

          // Move to block
          const goal = new goals.GoalNear(block.position.x, block.position.y, block.position.z, 4);
          await bot.pathfinder.goto(goal);

          // Look at and mine block
          await bot.lookAt(block.position, true);
          await bot.dig(block);

          gathered++;
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (gathered >= quantity) {
          return factory.createResponse(`Successfully gathered ${gathered} ${blockType} in ${elapsed}s`);
        } else {
          return factory.createResponse(`Gathered ${gathered}/${quantity} ${blockType} in ${elapsed}s. No more blocks found within ${searchRadius} blocks.`);
        }
      } catch (error) {
        return factory.createErrorResponse(`Failed while gathering ${blockType}: ${error}. Gathered ${gathered}/${quantity}`);
      }
    },
    true
  );

  // place-and-build: Place multiple blocks in a pattern
  factory.registerTool(
    "place-and-build",
    "Place multiple blocks at specified positions. Useful for building structures quickly.",
    {
      blocks: z.array(z.object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
        blockType: z.string()
      })).describe("Array of blocks to place with their positions and types")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { blocks } = args;

      const mcData = minecraftData(bot.version);
      let placed = 0;
      const errors: string[] = [];

      try {
        for (const blockSpec of blocks) {
          const { x, y, z, blockType } = blockSpec;

          // Check if bot has the block in inventory
          const item = mcData.itemsByName[blockType];
          if (!item) {
            errors.push(`Unknown block type: ${blockType}`);
            continue;
          }

          const inventoryItem = bot.inventory.items().find(i => i.type === item.id);
          if (!inventoryItem) {
            errors.push(`Missing ${blockType} in inventory`);
            continue;
          }

          // Move close to the target position
          const goal = new goals.GoalNear(x, y, z, 4);
          await bot.pathfinder.goto(goal);

          // Find reference block (block to place against)
          const targetPos = new Vec3(x, y, z);
          const referenceBlock = bot.blockAt(targetPos.offset(0, -1, 0)); // Try below first

          if (!referenceBlock || referenceBlock.name === 'air') {
            errors.push(`No reference block to place ${blockType} at (${x}, ${y}, ${z})`);
            continue;
          }

          // Equip and place block
          await bot.equip(inventoryItem, 'hand');
          await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
          placed++;
        }

        let response = `Placed ${placed}/${blocks.length} blocks`;
        if (errors.length > 0) {
          response += `\n\nErrors:\n${errors.join('\n')}`;
        }

        return factory.createResponse(response);
      } catch (error) {
        return factory.createErrorResponse(`Failed while placing blocks: ${error}. Placed ${placed}/${blocks.length}`);
      }
    },
    true
  );
}
