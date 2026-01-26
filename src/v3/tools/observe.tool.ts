/**
 * Observe Tool
 * Get comprehensive information about the bot and environment
 */

import { z } from 'zod';
import mineflayer from 'mineflayer';
import minecraftData from 'minecraft-data';
import { ToolFactory } from '../../tool-factory.js';

export function registerObserveTool(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot
): void {
  factory.registerTool(
    'observe',
    `Get comprehensive information about the bot's state and environment.
Returns position, health, inventory, nearby entities/blocks, and smart suggestions.
Use this to understand the current situation before taking action.`,
    {
      focus: z.enum(['all', 'inventory', 'nearby', 'status']).optional()
        .describe('What to focus on (default: all)'),
      radius: z.number().optional()
        .describe('Search radius for nearby things (default: 32)'),
    },
    async (args) => {
      const bot = getBot();
      const { focus = 'all', radius = 32 } = args;
      const mcData = minecraftData(bot.version);

      const lines: string[] = [];

      // Position & Status (always include basic info)
      const pos = bot.entity.position;
      lines.push('=== BOT STATUS ===');
      lines.push(`Position: (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`);
      lines.push(`Health: ${bot.health}/20 | Food: ${bot.food}/20`);
      lines.push(`Game Mode: ${bot.game.gameMode}`);
      lines.push(`Time: ${bot.time.timeOfDay} (${bot.time.timeOfDay < 12000 ? 'day' : 'night'})`);
      lines.push('');

      // Inventory
      if (focus === 'all' || focus === 'inventory') {
        lines.push('=== INVENTORY ===');
        const items = bot.inventory.items();

        if (items.length === 0) {
          lines.push('Empty');
        } else {
          // Group and count items
          const counts: Record<string, number> = {};
          for (const item of items) {
            counts[item.name] = (counts[item.name] || 0) + item.count;
          }

          // Sort by count
          const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
          for (const [name, count] of sorted.slice(0, 15)) {
            lines.push(`  ${name}: ${count}`);
          }
          if (sorted.length > 15) {
            lines.push(`  ... and ${sorted.length - 15} more types`);
          }
        }

        // Equipment
        lines.push('');
        lines.push('Equipment:');
        const slots = ['head', 'torso', 'legs', 'feet', 'hand', 'off-hand'] as const;
        for (const slot of slots) {
          const item = bot.inventory.slots[bot.getEquipmentDestSlot(slot)];
          lines.push(`  ${slot}: ${item ? item.name : 'empty'}`);
        }
        lines.push('');
      }

      // Nearby entities
      if (focus === 'all' || focus === 'nearby') {
        lines.push('=== NEARBY ===');

        // Entities
        const entities = Object.values(bot.entities)
          .filter(e => e !== bot.entity && e.position.distanceTo(pos) <= radius)
          .map(e => ({
            type: e.type,
            name: e.name || e.displayName || 'unknown',
            distance: e.position.distanceTo(pos),
            health: (e as any).health,
          }))
          .sort((a, b) => a.distance - b.distance);

        // Group entities by name
        const entityGroups: Record<string, { count: number; nearest: number }> = {};
        for (const e of entities) {
          if (!entityGroups[e.name]) {
            entityGroups[e.name] = { count: 0, nearest: e.distance };
          }
          entityGroups[e.name].count++;
          entityGroups[e.name].nearest = Math.min(entityGroups[e.name].nearest, e.distance);
        }

        if (Object.keys(entityGroups).length > 0) {
          lines.push('Entities:');
          for (const [name, info] of Object.entries(entityGroups).slice(0, 10)) {
            lines.push(`  ${name}: ${info.count} (nearest: ${info.nearest.toFixed(1)}m)`);
          }
        } else {
          lines.push('Entities: none nearby');
        }

        // Interesting blocks
        const interestingBlocks = [
          'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'emerald_ore',
          'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_gold_ore', 'deepslate_diamond_ore',
          'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log',
          'crafting_table', 'furnace', 'chest',
        ];

        lines.push('');
        lines.push('Resources nearby:');
        const foundBlocks: { name: string; pos: any; distance: number }[] = [];

        for (const blockName of interestingBlocks) {
          const blockType = mcData.blocksByName[blockName];
          if (blockType) {
            const block = bot.findBlock({
              matching: blockType.id,
              maxDistance: radius,
            });
            if (block) {
              foundBlocks.push({
                name: blockName,
                pos: block.position,
                distance: block.position.distanceTo(pos),
              });
            }
          }
        }

        if (foundBlocks.length > 0) {
          foundBlocks.sort((a, b) => a.distance - b.distance);
          for (const block of foundBlocks.slice(0, 8)) {
            lines.push(`  ${block.name} at (${block.pos.x}, ${block.pos.y}, ${block.pos.z}) - ${block.distance.toFixed(1)}m`);
          }
        } else {
          lines.push('  No interesting resources found');
        }
        lines.push('');
      }

      // Smart suggestions
      lines.push('=== SUGGESTIONS ===');
      const suggestions: string[] = [];

      // Health/food suggestions
      if (bot.health < 10) {
        suggestions.push('Low health! Consider eating or finding shelter.');
      }
      if (bot.food < 10) {
        const hasFood = bot.inventory.items().some(i => {
          const itemData = mcData.items[i.type] as any;
          return itemData?.foodPoints > 0;
        });
        if (hasFood) {
          suggestions.push('Hungry - use do("eat") to restore food.');
        } else {
          suggestions.push('Hungry and no food! Hunt animals or find food.');
        }
      }

      // Tool suggestions
      const hasPickaxe = bot.inventory.items().some(i => i.name.includes('pickaxe'));
      const hasAxe = bot.inventory.items().some(i => i.name.includes('axe') && !i.name.includes('pickaxe'));
      const hasWood = bot.inventory.items().some(i => i.name.includes('log') || i.name.includes('planks'));

      if (!hasPickaxe && !hasAxe) {
        if (hasWood) {
          suggestions.push('No tools! Use do("craft wooden_pickaxe") to make tools.');
        } else {
          suggestions.push('No tools or wood! Use do("gather 5 wood") first.');
        }
      }

      // Creative mode
      if (bot.game.gameMode === 'creative') {
        suggestions.push('Creative mode - unlimited resources available!');
      }

      // Default suggestion
      if (suggestions.length === 0) {
        suggestions.push('Ready for commands. Try: do("build a small cobblestone house")');
      }

      for (const suggestion of suggestions) {
        lines.push(`• ${suggestion}`);
      }

      return factory.createResponse(lines.join('\n'));
    }
  );
}
