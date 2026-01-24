import { z } from "zod";
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { goals } = pathfinderPkg;
import { Vec3 } from 'vec3';
import { ToolFactory } from '../tool-factory.js';

type Direction = 'forward' | 'back' | 'left' | 'right';

export function registerPositionTools(factory: ToolFactory, getBot: () => mineflayer.Bot): void {
  // Helper to get the correct bot (selected or active)
  const getBotFromArgs = (args: { _selectedBot?: mineflayer.Bot }) => args._selectedBot || getBot();

  factory.registerTool(
    "get-position",
    "Get the current position of the bot",
    {},
    async (args) => {
      const bot = getBotFromArgs(args);
      const position = bot.entity.position;
      const pos = {
        x: Math.floor(position.x),
        y: Math.floor(position.y),
        z: Math.floor(position.z)
      };
      return factory.createResponse(`Current position: (${pos.x}, ${pos.y}, ${pos.z})`);
    },
    true // Enable bot selection
  );

  factory.registerTool(
    "move-to-position",
    "Move the bot to a specific position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
      range: z.number().optional().describe("How close to get to the target (default: 1)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { x, y, z, range = 1 } = args;
      const goal = new goals.GoalNear(x, y, z, range);
      await bot.pathfinder.goto(goal);
      return factory.createResponse(`Successfully moved to position near (${x}, ${y}, ${z})`);
    },
    true // Enable bot selection
  );

  factory.registerTool(
    "look-at",
    "Make the bot look at a specific position",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
      z: z.number().describe("Z coordinate"),
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { x, y, z } = args;
      await bot.lookAt(new Vec3(x, y, z), true);
      return factory.createResponse(`Looking at position (${x}, ${y}, ${z})`);
    },
    true // Enable bot selection
  );

  factory.registerTool(
    "jump",
    "Make the bot jump",
    {},
    async (args) => {
      const bot = getBotFromArgs(args);
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 250);
      return factory.createResponse("Successfully jumped");
    },
    true // Enable bot selection
  );

  factory.registerTool(
    "move-in-direction",
    "Move the bot in a specific direction for a duration",
    {
      direction: z.enum(['forward', 'back', 'left', 'right']).describe("Direction to move"),
      duration: z.number().optional().describe("Duration in milliseconds (default: 1000)")
    },
    async (args) => {
      const bot = getBotFromArgs(args);
      const { direction, duration = 1000 } = args as { direction: Direction, duration?: number };
      return new Promise((resolve) => {
        bot.setControlState(direction, true);
        setTimeout(() => {
          bot.setControlState(direction, false);
          resolve(factory.createResponse(`Moved ${direction} for ${duration}ms`));
        }, duration);
      });
    },
    true // Enable bot selection
  );
}
