# Minecraft MCP Server

<a href="https://github.com/yuniko-software/minecraft-mcp-server/actions">
  <img alt="CI" src="https://github.com/yuniko-software/minecraft-mcp-server/actions/workflows/build.yml/badge.svg">
</a>
<a href="https://github.com/yuniko-software">
  <img alt="Contribution Welcome" src="https://img.shields.io/badge/Contribution-Welcome-blue">
</a>
<a href="https://github.com/yuniko-software/minecraft-mcp-server/releases/latest">
  <img alt="Latest Release" src="https://img.shields.io/github/v/release/yuniko-software/minecraft-mcp-server?label=Latest%20Release">
</a>

<img width="2063" height="757" alt="image" src="https://github.com/user-attachments/assets/3f0f0438-f079-4226-90bd-87b9e1311d19" />

___

> [!IMPORTANT]
> Currently supports Minecraft version 1.21.8. Newer versions may not work with this MCP server, but we will add support as soon as possible.

https://github.com/user-attachments/assets/6f17f329-3991-4bc7-badd-7cde9aacb92f

A Minecraft bot powered by large language models and [Mineflayer API](https://github.com/PrismarineJS/mineflayer). This bot uses the [Model Context Protocol](https://github.com/modelcontextprotocol) (MCP) to enable Claude and other supported models to control a Minecraft character.

<a href="https://glama.ai/mcp/servers/@yuniko-software/minecraft-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@yuniko-software/minecraft-mcp-server/badge" alt="mcp-minecraft MCP server" />
</a>

## Prerequisites

- Git
- Node.js (>= 20.10.0)
- A running Minecraft game (the setup below was tested with Minecraft 1.21.8 Java Edition included in Microsoft Game Pass)
- An MCP-compatible client. Claude Desktop will be used as an example, but other MCP clients are also supported

## Getting started

This bot is designed to be used with Claude Desktop through the Model Context Protocol (MCP).

### Run Minecraft

Create a singleplayer world and open it to LAN (`ESC -> Open to LAN`). Bot will try to connect using port `25565` and hostname `localhost`. These parameters could be configured in `claude_desktop_config.json` on a next step. 

### MCP Configuration

Make sure that [Claude Desktop](https://claude.ai/download) is installed. Open `File -> Settings -> Developer -> Edit Config`. It should open installation directory. Find file with a name `claude_desktop_config.json` and insert the following code:

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

Double-check that right `--port` and `--host` parameters were used. Make sure to completely reboot the Claude Desktop application (should be closed in OS tray). 

## Running

Make sure Minecraft game is running and the world is opened to LAN. Then start Claude Desktop application and the bot should join the game. 

**It could take some time for Claude Desktop to boot the MCP server**. The marker that the server has booted successfully:

<img width="885" height="670" alt="image" src="https://github.com/user-attachments/assets/ccbb42f8-6544-462c-8ac1-8af13ddfcddd" />

You can give bot any commands through any active Claude Desktop chat. You can also upload images of buildings and ask bot to build them 😁

Don't forget to mention that bot should do something in Minecraft in your prompt. Because saying this is a trigger to run MCP server. It will ask for your permissions.

Using Claude Sonnet could give you some interesting results. The bot-agent would be really smart 🫡

Example usage: [shared Claude chat](https://claude.ai/share/535d5f69-f102-4cdb-9801-f74ea5709c0b)

## Available Commands

Once connected to a Minecraft server, Claude can use these commands:

### Movement
- `get-position` - Get the current position of the bot
- `move-to-position` - Move to specific coordinates
- `look-at` - Make the bot look at specific coordinates
- `jump` - Make the bot jump
- `move-in-direction` - Move in a specific direction for a duration

### Flight
- `fly-to` - Make the bot fly directly to specific coordinates

### Inventory
- `list-inventory` - List all items in the bot's inventory
- `find-item` - Find a specific item in inventory
- `equip-item` - Equip a specific item

### Block Interaction
- `place-block` - Place a block at specified coordinates
- `dig-block` - Dig a block at specified coordinates
- `get-block-info` - Get information about a block
- `find-block` - Find the nearest block of a specific type

### Entity Interaction
- `find-entity` - Find the nearest entity of a specific type

### Communication
- `send-chat` - Send a chat message in-game
- `read-chat` - Get recent chat messages from players

### Game State
- `detect-gamemode` - Detect the gamemode on game

### Crafting
- `list-recipes` - List available crafting recipes
- `get-recipe` - Get detailed recipe information
- `can-craft` - Check if an item can be crafted
- `craft-item` - Craft a specific item

### Multi-Bot Management (New in v2.1.0) 🎉
- `spawn-bot` - Create and connect a new bot
- `list-bots` - List all active bots with their status
- `select-bot` - Set the active bot by name or number
- `remove-bot` - Remove a bot from the pool
- `get-active-bot` - Get information about the current active bot
- `get-bot-count` - Get total number of active bots

## Multi-Bot Support (v2.1.0+)

The server now supports managing multiple bot connections to the same Minecraft world! You can:
- **Configure a single Minecraft server** target (host + port)
- **Spawn multiple bots dynamically** into the same world
- **Switch between bots** using the active bot concept
- **Target specific bots** with the optional `bot` parameter on many tools

### Quick Start with Multi-Bot

**Option 1**: No initial bot (spawn as needed)
```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": ["-y", "github:yuniko-software/minecraft-mcp-server",
               "--host", "localhost", "--port", "25565"]
    }
  }
}
```

Then use the `spawn-bot` tool in Claude:
```typescript
spawn-bot({ username: "MinerBot" })
spawn-bot({ username: "BuilderBot" })
```

**Option 2**: Start with one bot, add more later
```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": ["-y", "github:yuniko-software/minecraft-mcp-server",
               "--host", "localhost", "--port", "25565", "--username", "ClaudeBot"]
    }
  }
}
```

Then spawn additional bots using `spawn-bot({ username: "SecondBot" })` as needed!

### Simple Usage Example

```bash
# Server starts connected to localhost:25565
# Spawn bots as you need them:
spawn-bot({ username: "Miner" })
spawn-bot({ username: "Builder" })
spawn-bot({ username: "Scout" })

# List all bots
list-bots()

# Control a specific bot
get-position({ bot: "Miner" })
move-to-position({ bot: "Builder", x: 100, y: 64, z: 200 })
```

For detailed multi-bot usage, workflow examples, and best practices, see [Multi-Bot Guide](docs/multi-bot-guide.md).

## Contributing

Feel free to submit pull requests or open issues for improvements. All refactoring commits, functional and test contributions, issues and discussion are greatly appreciated!

To get started with contributing, please see [CONTRIBUTING.md](CONTRIBUTING.md).

---

⭐ If you find this project useful, please consider giving it a star on GitHub! ⭐

Your support helps make this project more visible to other people who might benefit from it.
