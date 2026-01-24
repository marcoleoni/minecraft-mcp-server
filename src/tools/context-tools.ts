import { z } from "zod";
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';

/**
 * Context tools - Return rich information in a single call
 * Significantly reduces round-trips by providing comprehensive context
 */
export function registerContextTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  // get-full-context: Get comprehensive bot and environment information
  factory.registerTool(
    "get-full-context",
    "Get comprehensive context about the bot's current state and environment in a single call. Includes position, health, hunger, nearby entities, blocks, inventory, and more. Use this to reduce multiple tool calls.",
    {
      includeInventory: z.boolean().optional().describe("Include full inventory details (default: true)"),
      includeNearbyBlocks: z.boolean().optional().describe("Include nearby interesting blocks (default: true)"),
      includeNearbyEntities: z.boolean().optional().describe("Include nearby entities (default: true)"),
      blockRadius: z.number().optional().describe("Radius for nearby blocks search (default: 16)"),
      entityRadius: z.number().optional().describe("Radius for nearby entities search (default: 16)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const {
        includeInventory = true,
        includeNearbyBlocks = true,
        includeNearbyEntities = true,
        blockRadius = 16,
        entityRadius = 16
      } = args;

      const context: any = {
        timestamp: new Date().toISOString(),
        position: {
          x: Math.floor(bot.entity.position.x),
          y: Math.floor(bot.entity.position.y),
          z: Math.floor(bot.entity.position.z),
          yaw: bot.entity.yaw,
          pitch: bot.entity.pitch
        },
        status: {
          health: bot.health,
          food: bot.food,
          saturation: bot.foodSaturation,
          oxygen: bot.oxygenLevel,
          isRaining: bot.isRaining,
          isInWater: (bot.blockAt(bot.entity.position)?.name === 'water') || false,
          isInLava: (bot.blockAt(bot.entity.position)?.name === 'lava') || false,
          isOnGround: bot.entity.onGround || false
        },
        world: {
          time: bot.time.timeOfDay,
          age: bot.time.age,
          biome: bot.blockAt(bot.entity.position)?.biome?.name || 'unknown',
          dimension: bot.game.dimension,
          difficulty: bot.game.difficulty,
          gameMode: bot.game.gameMode
        }
      };

      // Inventory
      if (includeInventory) {
        const inventoryItems = bot.inventory.items().map(item => ({
          name: item.name,
          count: item.count,
          slot: item.slot
        }));

        context.inventory = {
          itemCount: inventoryItems.length,
          emptySlots: 36 - inventoryItems.length,
          items: inventoryItems
        };

        // Quick counts of important resources
        const resourceCounts: { [key: string]: number } = {};
        inventoryItems.forEach(item => {
          resourceCounts[item.name] = (resourceCounts[item.name] || 0) + item.count;
        });
        context.inventory.resourceSummary = resourceCounts;
      }

      // Nearby blocks (interesting ones like ores, trees, etc.)
      if (includeNearbyBlocks) {
        const interestingBlockTypes = [
          'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'emerald_ore', 'lapis_ore', 'redstone_ore',
          'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_gold_ore', 'deepslate_diamond_ore',
          'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
          'crafting_table', 'furnace', 'chest', 'bed'
        ];

        const mcData = require('minecraft-data')(bot.version);
        const nearbyBlocks: any[] = [];

        for (const blockName of interestingBlockTypes) {
          const blockType = mcData.blocksByName[blockName];
          if (blockType) {
            const block = bot.findBlock({
              matching: blockType.id,
              maxDistance: blockRadius,
              count: 5 // Limit to 5 per type
            });

            if (block) {
              nearbyBlocks.push({
                type: blockName,
                position: {
                  x: block.position.x,
                  y: block.position.y,
                  z: block.position.z
                },
                distance: bot.entity.position.distanceTo(block.position).toFixed(1)
              });
            }
          }
        }

        context.nearbyBlocks = {
          searchRadius: blockRadius,
          found: nearbyBlocks
        };
      }

      // Nearby entities
      if (includeNearbyEntities) {
        const entities = Object.values(bot.entities)
          .filter((entity: any) => {
            if (entity === bot.entity) return false;
            const distance = entity.position.distanceTo(bot.entity.position);
            return distance <= entityRadius;
          })
          .map((entity: any) => ({
            type: entity.type,
            name: entity.name || entity.displayName || 'unknown',
            position: {
              x: Math.floor(entity.position.x),
              y: Math.floor(entity.position.y),
              z: Math.floor(entity.position.z)
            },
            distance: entity.position.distanceTo(bot.entity.position).toFixed(1),
            health: entity.health,
            isHostile: entity.type === 'mob' && ['zombie', 'skeleton', 'creeper', 'spider', 'enderman'].includes(entity.name)
          }))
          .sort((a: any, b: any) => parseFloat(a.distance) - parseFloat(b.distance))
          .slice(0, 20); // Limit to 20 nearest

        const entitySummary: { [key: string]: number } = {};
        entities.forEach((e: any) => {
          entitySummary[e.name] = (entitySummary[e.name] || 0) + 1;
        });

        context.nearbyEntities = {
          searchRadius: entityRadius,
          totalCount: entities.length,
          summary: entitySummary,
          entities: entities
        };
      }

      // Equipment
      const equipment: any = {};
      const slots = ['head', 'torso', 'legs', 'feet', 'hand', 'off-hand'];
      for (const slot of slots) {
        const item = bot.inventory.slots[bot.getEquipmentDestSlot(slot as any)];
        equipment[slot] = item ? { name: item.name, durability: item.durabilityUsed } : null;
      }
      context.equipment = equipment;

      // Format as readable text
      let response = `=== BOT CONTEXT ===\n\n`;

      // Position and orientation
      response += `📍 Position: (${context.position.x}, ${context.position.y}, ${context.position.z})\n`;
      response += `   Facing: yaw=${context.position.yaw.toFixed(2)}, pitch=${context.position.pitch.toFixed(2)}\n\n`;

      // Status
      response += `❤️  Status:\n`;
      response += `   Health: ${context.status.health}/20\n`;
      response += `   Hunger: ${context.status.food}/20 (saturation: ${context.status.saturation.toFixed(1)})\n`;
      response += `   Oxygen: ${context.status.oxygen}/20\n`;
      if (context.status.isInWater) response += `   ⚠️ In water\n`;
      if (context.status.isInLava) response += `   ⚠️ IN LAVA!\n`;
      response += `\n`;

      // World
      response += `🌍 World:\n`;
      response += `   Time: ${context.world.time} (age: ${context.world.age})\n`;
      response += `   Biome: ${context.world.biome}\n`;
      response += `   Weather: ${context.status.isRaining ? 'Raining' : 'Clear'}\n`;
      response += `   Game mode: ${context.world.gameMode}\n\n`;

      // Inventory
      if (includeInventory && context.inventory) {
        response += `🎒 Inventory: ${context.inventory.itemCount} items (${context.inventory.emptySlots} empty slots)\n`;
        const topResources = Object.entries(context.inventory.resourceSummary)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 10);
        topResources.forEach(([name, count]) => {
          response += `   - ${name}: ${count}\n`;
        });
        response += `\n`;
      }

      // Equipment
      response += `⚔️  Equipment:\n`;
      Object.entries(equipment).forEach(([slot, item]: [string, any]) => {
        response += `   ${slot}: ${item ? `${item.name} (durability: ${item.durability || 0})` : 'empty'}\n`;
      });
      response += `\n`;

      // Nearby entities
      if (includeNearbyEntities && context.nearbyEntities.totalCount > 0) {
        response += `👥 Nearby Entities (within ${entityRadius} blocks):\n`;
        Object.entries(context.nearbyEntities.summary).forEach(([name, count]) => {
          response += `   - ${name}: ${count}\n`;
        });
        const hostileCount = context.nearbyEntities.entities.filter((e: any) => e.isHostile).length;
        if (hostileCount > 0) {
          response += `   ⚠️ ${hostileCount} hostile mobs nearby!\n`;
        }
        response += `\n`;
      }

      // Nearby blocks
      if (includeNearbyBlocks && context.nearbyBlocks.found.length > 0) {
        response += `🪨 Nearby Interesting Blocks (within ${blockRadius} blocks):\n`;
        const grouped: { [key: string]: any[] } = {};
        context.nearbyBlocks.found.forEach((block: any) => {
          if (!grouped[block.type]) grouped[block.type] = [];
          grouped[block.type].push(block);
        });

        Object.entries(grouped).forEach(([type, blocks]) => {
          const nearest = blocks[0];
          response += `   - ${type}: ${blocks.length} found, nearest at (${nearest.position.x}, ${nearest.position.y}, ${nearest.position.z}) - ${nearest.distance}m\n`;
        });
        response += `\n`;
      }

      response += `\n💡 Tip: Use composite tools (collect-nearest-item, gather-resources) or sequences (execute-sequence) for faster operations.`;

      return factory.createResponse(response);
    },
    true
  );

  // scan-area: Detailed scan of a specific area
  factory.registerTool(
    "scan-area",
    "Perform a detailed scan of blocks in a specific area. Returns a complete breakdown of block types and their positions.",
    {
      centerX: z.number().describe("Center X coordinate"),
      centerY: z.number().describe("Center Y coordinate"),
      centerZ: z.number().describe("Center Z coordinate"),
      radius: z.number().describe("Scan radius (max 16)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { centerX, centerY, centerZ, radius } = args;

      if (radius > 16) {
        return factory.createErrorResponse("Maximum scan radius is 16 blocks");
      }

      const blockCounts: { [key: string]: number } = {};
      const interestingBlocks: any[] = [];
      let totalBlocks = 0;

      for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
          for (let z = centerZ - radius; z <= centerZ + radius; z++) {
            const block = bot.blockAt(new (require('vec3').Vec3)(x, y, z));
            if (block) {
              totalBlocks++;
              blockCounts[block.name] = (blockCounts[block.name] || 0) + 1;

              // Track interesting blocks
              if (block.name.includes('ore') || block.name.includes('log') ||
                  ['chest', 'crafting_table', 'furnace', 'bed'].includes(block.name)) {
                interestingBlocks.push({
                  type: block.name,
                  position: { x, y, z }
                });
              }
            }
          }
        }
      }

      let response = `=== AREA SCAN ===\n\n`;
      response += `Center: (${centerX}, ${centerY}, ${centerZ})\n`;
      response += `Radius: ${radius} blocks\n`;
      response += `Total blocks scanned: ${totalBlocks}\n\n`;

      response += `Block Distribution:\n`;
      const sorted = Object.entries(blockCounts).sort((a, b) => b[1] - a[1]);
      sorted.slice(0, 15).forEach(([name, count]) => {
        const percentage = ((count / totalBlocks) * 100).toFixed(1);
        response += `  - ${name}: ${count} (${percentage}%)\n`;
      });

      if (interestingBlocks.length > 0) {
        response += `\n🎯 Interesting blocks found:\n`;
        interestingBlocks.forEach(block => {
          response += `  - ${block.type} at (${block.position.x}, ${block.position.y}, ${block.position.z})\n`;
        });
      }

      return factory.createResponse(response);
    },
    true
  );
}
