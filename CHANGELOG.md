# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-01-23

### Added
- **Multi-Bot Support**: Major new feature allowing management of multiple bot connections to the same Minecraft world
  - New `BotManager` class to centralize bot management with single-server configuration
  - Support for spawning, listing, selecting, and removing bots dynamically
  - Active bot concept: one bot is always designated as "active" for default operations
  - Bot selection parameter: many tools now support optional `bot` parameter to target specific bots

- **New Bot Management Tools**:
  - `spawn-bot` - Create and connect a new bot to the configured server (requires only username)
  - `list-bots` - List all active bots with connection info and status
  - `select-bot` - Set the active bot by name or number (1-based index)
  - `remove-bot` - Disconnect and remove a bot from the pool
  - `get-active-bot` - Get detailed info about the currently active bot
  - `get-bot-count` - Get the total number of active bots

- **Simplified Configuration**:
  - Single server target: configure host + port once at startup
  - Optional initial bot: `--username` parameter to spawn first bot
  - No-bot mode: start server without any bots, spawn them as needed
  - All bots connect to the same configured server

- **Enhanced Position Tools**: All position tools now support bot selection
  - `get-position` - Can target specific bot
  - `move-to-position` - Can move specific bot
  - `look-at` - Can control specific bot's view
  - `jump` - Can make specific bot jump
  - `move-in-direction` - Can move specific bot in direction

- **Documentation**:
  - Comprehensive [Multi-Bot Guide](docs/multi-bot-guide.md) with workflow examples
  - Updated README with multi-bot quick start and usage examples
  - Clear documentation of single-server architecture

### Changed
- **Breaking (Internal)**: `BotManager` now requires server config in constructor
- **Breaking (Internal)**: `config.ts` simplified - returns `AppConfig` with server config and optional initial bot
- **Breaking (Tool)**: `spawn-bot` now requires only `username` (and optional `name`), uses configured server
- `MessageStore` now tags messages with bot name for multi-bot chat tracking
- `MessageStore.getRecentMessages()` now accepts optional `botName` parameter for filtering
- Version bumped from 2.0.1 to 2.1.0

### Enhanced
- Tool execution includes connection verification for the selected bot
- Better error messages when bot is not found or not connected
- Automatic active bot selection when removing the current active bot
- Log messages tagged with bot name in multi-bot scenarios
- Cleaner startup flow with informative logging

### Technical Details
- **Architecture**: Single-server, multi-bot approach
  - `BotManager`: Stores server config and manages Map<name, BotConnection>
  - `ToolFactory`: Enhanced with bot selection and validation logic
  - `MessageStore`: Extended with bot-aware message tracking
- Bot instances accessible by name (string) or index (1-based number)
- Internal `_selectedBot` parameter passed to tool executors for bot-aware operations
- All bots connect to the same Minecraft server configured at startup

### Removed
- Multi-server configuration options (simplified to single-server model)
- `--bots` and `--bot-config` CLI parameters (no longer needed)

## [2.0.1] - 2024-XX-XX

### Previous Release
- Stable single-bot implementation
- 23 tools across 8 categories
- Full crafting system support
- Comprehensive pathfinding with mineflayer-pathfinder

---

## Upgrade Guide: 2.0.1 → 2.1.0

### For Users

**Minimal breaking changes!** The upgrade path is simple:

**Old configuration (still works):**
```bash
minecraft-mcp-server --host localhost --port 25565 --username MyBot
```

**New recommended usage:**
```bash
# Option 1: No initial bot
minecraft-mcp-server --host localhost --port 25565

# Option 2: With initial bot
minecraft-mcp-server --host localhost --port 25565 --username MyBot
```

Then use `spawn-bot({ username: "AnotherBot" })` to add more bots as needed!

### For Contributors/Developers

If you're developing custom tools or extensions:

1. **BotManager constructor** now requires server config:
   ```typescript
   // Old
   const botManager = new BotManager(callbacks);

   // New
   const botManager = new BotManager(callbacks, serverConfig);
   ```

2. **spawn-bot tool** simplified signature:
   ```typescript
   // Old (no longer supported)
   spawn-bot({ name: "bot1", host: "...", port: 25565, username: "Bot1" })

   // New
   spawn-bot({ username: "Bot1" }) // Uses configured server
   spawn-bot({ username: "Bot1", name: "bot1" }) // With custom identifier
   ```

3. **Config parsing** returns different structure:
   ```typescript
   // Old
   const config = parseConfig(); // Returns MultiBotConfig

   // New
   const config = parseConfig(); // Returns AppConfig with server + optional initialBot
   ```

See [Multi-Bot Guide](docs/multi-bot-guide.md) for full implementation details.

---

## Design Philosophy

The v2.1.0 multi-bot design follows these principles:

1. **Simplicity**: One server, multiple bots - easy to understand and use
2. **Flexibility**: Spawn bots dynamically as needed, no upfront configuration required
3. **Clarity**: Explicit bot targeting with optional `bot` parameter
4. **Efficiency**: All bots share the same server connection configuration
5. **Intuitive**: Active bot concept for default operations, specific targeting when needed
