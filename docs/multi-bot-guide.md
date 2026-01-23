# Multi-Bot Support Guide

This guide explains how to use the multi-bot functionality in Minecraft MCP Server v2.1.0+

## Overview

The Minecraft MCP Server now supports managing multiple bot connections to the same Minecraft world. You can:
- Configure a single Minecraft server target
- Spawn multiple bots dynamically into that world
- Switch between bots using the active bot concept
- Execute tools on specific bots using the optional `bot` parameter

## How It Works

**Single Server, Multiple Bots**
- You configure ONE Minecraft server (host + port) when starting the MCP server
- All bots spawn and connect to that same server
- Each bot gets its own unique username in the game
- You manage bots by username/name through MCP tools

## Configuration

### Option 1: No Initial Bot (Spawn Later)

Start the server without any bots, then spawn them as needed:

```bash
minecraft-mcp-server --host localhost --port 25565
```

Then use the `spawn-bot` tool to create bots:
```typescript
spawn-bot({ username: "MinerBot" })
spawn-bot({ username: "BuilderBot" })
```

### Option 2: With Initial Bot

Start with one bot already connected:

```bash
minecraft-mcp-server --host localhost --port 25565 --username FirstBot
```

Then spawn additional bots as needed using the `spawn-bot` tool.

### Claude Desktop Configuration

**Without initial bot:**
```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": [
        "-y",
        "github:yuniko-software/minecraft-mcp-server",
        "--host",
        "localhost",
        "--port",
        "25565"
      ]
    }
  }
}
```

**With initial bot:**
```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": [
        "-y",
        "github:yuniko-software/minecraft-mcp-server",
        "--host",
        "localhost",
        "--port",
        "25565",
        "--username",
        "ClaudeBot"
      ]
    }
  }
}
```

## Bot Management Tools

The server provides several tools for managing bots:

### spawn-bot

Create and connect a new bot to the configured server:

```typescript
// Simple usage
spawn-bot({ username: "MinerBot" })

// With custom name identifier
spawn-bot({ username: "MinerBot", name: "miner1" })
```

**Parameters:**
- `username` (required): The bot's username in Minecraft
- `name` (optional): Unique identifier for the bot (defaults to username)

The bot will connect to the server configured at startup.

### list-bots

List all currently active bots with their connection information and status. The active bot is marked with ⭐.

### select-bot

Set the active bot by name or number (1-based index):

```typescript
// By name
select-bot({ bot: "MinerBot" })

// By index
select-bot({ bot: 1 })
```

The active bot will be used by default for all tools that don't specify a bot parameter.

### remove-bot

Disconnect and remove a bot:

```typescript
remove-bot({ bot: "MinerBot" })
// or
remove-bot({ bot: 2 })
```

If you remove the active bot, another bot will be automatically selected as active.

### get-active-bot

Get information about the currently active bot.

### get-bot-count

Get the total number of active bots.

## Using the Bot Parameter

Many tools support an optional `bot` parameter that allows you to execute the tool on a specific bot instead of the active one:

```typescript
// Get position of the active bot
get-position()

// Get position of a specific bot
get-position({ bot: "MinerBot" })

// Get position of bot #2
get-position({ bot: 2 })
```

### Tools with Bot Selection Support

Currently, the following tools support the `bot` parameter:

**Position Tools** (all 5 tools):
- get-position
- move-to-position
- look-at
- jump
- move-in-direction

**Note**: Other tool categories (inventory, blocks, entities, etc.) currently use only the active bot. Bot selection support can be added gradually to other tools following the same pattern.

## Workflow Examples

### Example 1: Start Empty, Spawn as Needed

```bash
# Start server without bots
minecraft-mcp-server --host localhost --port 25565

# In Claude Desktop:
# 1. List bots (will be empty)
list-bots()

# 2. Spawn a miner bot
spawn-bot({ username: "MinerBot" })

# 3. Spawn a builder bot
spawn-bot({ username: "BuilderBot" })

# 4. List bots to see them
list-bots()
# Output shows:
# 1. MinerBot ⭐ [ACTIVE]
# 2. BuilderBot

# 5. Use the active bot (MinerBot)
get-position() # Gets MinerBot's position

# 6. Switch active bot
select-bot({ bot: "BuilderBot" })

# 7. Now commands use BuilderBot by default
get-position() # Gets BuilderBot's position

# 8. Or target specific bot explicitly
get-position({ bot: "MinerBot" })
```

### Example 2: Start with One, Add More

```bash
# Start with one bot
minecraft-mcp-server --host localhost --port 25565 --username MainBot

# In Claude Desktop:
# 1. The initial bot is already active
get-position() # Gets MainBot's position

# 2. Spawn additional helpers
spawn-bot({ username: "Scout" })
spawn-bot({ username: "Guard" })

# 3. Control multiple bots
move-to-position({ bot: "MainBot", x: 100, y: 64, z: 200 })
move-to-position({ bot: "Scout", x: 150, y: 70, z: 250 })
move-to-position({ bot: "Guard", x: 50, y: 65, z: 150 })
```

### Example 3: Team Coordination

```bash
# Start with a coordinator
minecraft-mcp-server --host localhost --port 25565 --username Coordinator

# Create a mining team
spawn-bot({ username: "Miner1" })
spawn-bot({ username: "Miner2" })
spawn-bot({ username: "Transporter" })

# Send miners to work
move-to-position({ bot: "Miner1", x: 100, y: 12, z: 200 })
move-to-position({ bot: "Miner2", x: 120, y: 12, z: 200 })

# Keep transporter at base
move-to-position({ bot: "Transporter", x: 0, y: 64, z: 0 })

# Monitor all
list-bots()
```

## Active Bot Concept

- **Active Bot**: One bot is always designated as "active" (if any bots exist)
- **Default Behavior**: Tools without a `bot` parameter use the active bot
- **First Bot**: The first bot spawned automatically becomes active
- **Auto-Selection**: When removing the active bot, another bot is automatically selected

## Best Practices

1. **Descriptive Usernames**: Use clear usernames like "MinerBot", "BuilderBot", "Scout"
2. **Track Active Bot**: Use `get-active-bot` to confirm which bot you're controlling
3. **Explicit Targeting**: Use the `bot` parameter when coordinating multiple bots
4. **Resource Management**: Remove unused bots with `remove-bot` to free connections
5. **Start Clean**: If unsure which bots exist, use `list-bots` first

## Troubleshooting

### Bot Not Found Error

If you get "Bot 'name' not found", use `list-bots` to see available bots.

### Connection Issues

Each bot needs to successfully connect. Check:
- Minecraft server is running and accessible
- Server allows multiple connections from the same IP
- Port and host are correct

### No Active Bot

If tools fail with "no active bot", spawn a bot first:
```typescript
spawn-bot({ username: "MyBot" })
```

## Limitations

- All bots connect to the same Minecraft server (configured at startup)
- Each bot needs a unique username in Minecraft
- Server must allow multiple connections from the same client

## Architecture

The multi-bot system is built on:

1. **BotManager**: Stores server config and manages Map<name, BotConnection>
2. **Single Server Target**: One host:port configured at startup
3. **Dynamic Spawning**: Bots created at runtime using `spawn-bot` tool
4. **Bot Selection**: Optional `bot` parameter in tools to target specific bots

For implementation details, see:
- `src/bot-manager.ts`
- `src/config.ts`
- `src/tools/bot-management-tools.ts`
