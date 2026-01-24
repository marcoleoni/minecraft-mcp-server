import { z } from 'zod';
import mineflayer from 'mineflayer';
import { ToolFactory } from '../tool-factory.js';
import { Vec3 } from 'vec3';
import pathfinderPkg from 'mineflayer-pathfinder';
import minecraftData from 'minecraft-data';

const { goals, Movements } = pathfinderPkg;

/**
 * Execute Script Tool
 *
 * Allows the LLM to send arbitrary JavaScript code to be executed
 * in the context of the Mineflayer bot. This provides maximum flexibility
 * for complex tasks that don't fit predefined goals.
 *
 * The script has access to:
 * - bot: the Mineflayer bot instance
 * - Vec3: vector class for positions
 * - goals: pathfinder goals (GoalNear, GoalBlock, etc.)
 * - Movements: pathfinder movements class
 * - mcData: minecraft-data for the bot's version
 * - sleep(ms): utility to wait
 */
export function registerExecuteScriptTool(
  factory: ToolFactory,
  getBot: () => mineflayer.Bot
): void {
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  factory.registerTool(
    "execute-script",
    `Execute JavaScript code directly on the Mineflayer bot.

The script runs as an async function with access to:
- bot: Mineflayer bot instance (movement, inventory, dig, place, chat, etc.)
- Vec3: Vector class for positions
- goals: Pathfinder goals (GoalNear, GoalBlock, GoalXZ, GoalY, GoalFollow)
- Movements: Pathfinder movements class
- mcData: minecraft-data for block/item lookups
- sleep(ms): Async sleep utility

Example scripts:

1. Build a 3x3 platform:
const pos = bot.entity.position.floored();
for (let x = 0; x < 3; x++) {
  for (let z = 0; z < 3; z++) {
    const target = pos.offset(x, -1, z);
    const refBlock = bot.blockAt(target.offset(0, -1, 0));
    if (refBlock) {
      await bot.equip(bot.inventory.items().find(i => i.name.includes('planks')), 'hand');
      await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
    }
  }
}
return 'Platform built!';

2. Mine 10 stone blocks:
let mined = 0;
while (mined < 10) {
  const stone = bot.findBlock({ matching: mcData.blocksByName.stone.id, maxDistance: 32 });
  if (!stone) break;
  await bot.pathfinder.goto(new goals.GoalNear(stone.position.x, stone.position.y, stone.position.z, 2));
  await bot.dig(stone);
  mined++;
}
return \`Mined \${mined} stone blocks\`;

3. Navigate and chat:
await bot.pathfinder.goto(new goals.GoalNear(100, 64, 100, 2));
bot.chat('I arrived!');
return 'Navigation complete';

The script must return a value (string preferred) to indicate completion.`,
    {
      script: z.string().describe("JavaScript code to execute. Must be valid async JS. Use 'return' to return a result."),
      timeout: z.number().optional().describe("Timeout in milliseconds (default: 60000, max: 300000)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { script, timeout = 60000 } = args;

      // Cap timeout at 5 minutes
      const actualTimeout = Math.min(timeout, 300000);

      try {
        // Create the execution context
        const mcData = minecraftData(bot.version);

        // Setup pathfinder if not already done
        if (!bot.pathfinder) {
          throw new Error('Pathfinder not loaded on bot');
        }
        const defaultMovements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(defaultMovements);

        // Sleep utility
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Create async function from script
        const asyncFn = new Function(
          'bot', 'Vec3', 'goals', 'Movements', 'mcData', 'sleep',
          `return (async () => { ${script} })();`
        );

        // Execute with timeout
        const result = await Promise.race([
          asyncFn(bot, Vec3, goals, Movements, mcData, sleep),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Script timeout after ${actualTimeout}ms`)), actualTimeout)
          )
        ]);

        return factory.createResponse(
          `Script executed successfully.\n\nResult: ${result !== undefined ? String(result) : '(no return value)'}`
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return factory.createErrorResponse(`Script execution failed: ${errorMessage}`);
      }
    },
    true // Supports bot selection
  );
}
