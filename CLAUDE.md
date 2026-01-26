# Minecraft Bot Expert v3

You control Minecraft bots through 3 simple tools. The bot is intelligent and handles complex tasks automatically.

## Tools

### `bot` - Manage bots
```
bot("spawn", "Steve")   # Create a bot
bot("list")             # List all bots
bot("remove", "Steve")  # Remove a bot
bot("select", "Steve")  # Switch active bot
```

### `observe` - See the world
```
observe()               # Full status (health, inventory, nearby)
observe("inventory")    # Just inventory
observe("nearby")       # Just nearby entities/blocks
observe("status")       # Just health/position
```

### `do` - Execute tasks (natural language)
```
do("build a 5x5 cobblestone house")
do("mine 10 iron_ore")
do("craft a diamond_pickaxe")
do("gather 20 wood")
do("go to 100, 64, 200")
do("follow me")
do("kill zombies")
do("eat")
```

## How It Works

The bot is **intelligent**. When you say `do("build a cobblestone house")`:

1. **Checks game mode** - Creative or Survival?
2. **In Creative** - Just builds with unlimited blocks
3. **In Survival** - Automatically:
   - Calculates materials needed
   - Checks inventory
   - Gathers missing resources
   - Crafts required tools
   - Executes the full task

### Example: Building in Survival

```
do("build a 5x5 cobblestone house")

Bot thinks:
→ Need 100 cobblestone
→ Have 0, need to mine
→ Need pickaxe to mine stone
→ No pickaxe, need to craft
→ Need 3 planks + 2 sticks
→ Need wood for planks
→ Can punch trees!

Bot executes:
1. Punch trees → get logs
2. Craft planks
3. Craft sticks
4. Craft wooden_pickaxe
5. Mine 100 stone → get cobblestone
6. Build house
```

**One command, fully autonomous execution.**

## Task Examples

### Building
```
do("build a small cobblestone house")
do("build a 7x7 oak_planks house")
do("build a 10 block tall stone tower")
do("build a cobblestone wall")
do("place 20 dirt blocks")
```

### Mining & Gathering
```
do("mine 10 stone")
do("mine 5 iron_ore")
do("mine 3 diamond_ore")
do("gather 20 wood")
do("get 10 coal")
```

### Crafting
```
do("craft a wooden_pickaxe")
do("craft a stone_sword")
do("craft 10 torches")
do("craft a crafting_table")
do("make a furnace")
```

### Movement
```
do("go to 100, 64, 200")
do("come here")
do("follow me")
do("stop follow")
```

### Combat & Survival
```
do("kill zombies")
do("attack skeleton")
do("hunt cows")
do("eat")
```

## Tips

1. **Start with observe()** - Understand the situation before acting
2. **Use natural language** - The bot understands variations
3. **Trust the planner** - It handles prerequisites automatically
4. **Check game mode** - Creative = unlimited, Survival = must gather

## Error Handling

If a task fails, the bot will:
- Tell you what went wrong
- Show what it accomplished
- Suggest alternatives

Example:
```
do("mine 5 diamond_ore")
→ "Need iron_pickaxe for diamond. Try: do('craft iron_pickaxe') first"
```
