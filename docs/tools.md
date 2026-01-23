# Minecraft MCP Server - Tool Collection

This document contains a comprehensive list of potential tools that can be implemented for the Minecraft MCP Server.

## Legend
- ✅ Already implemented
- 🔄 Partially implemented
- ⭐ High priority for implementation
- 📋 Planned

---

## **Bot & Player Status**

- ✅ get-position - Get bot's current coordinates
- get-rotation - Get bot's yaw and pitch angles
- get-dimension - Get current dimension (overworld/nether/end)
- ✅ detect-gamemode - Detect current gamemode
- ⭐ get-health - Get bot's health points
- ⭐ get-hunger - Get bot's hunger level
- get-armor - Get equipped armor and durability
- get-experience - Get XP level and progress
- get-breath - Get oxygen level (underwater)
- get-status-effects - Get active potion effects
- get-velocity - Get current movement velocity

---

## **Movement**

- ✅ move-to-position - Pathfind to specific coordinates
- ✅ move-in-direction - Move in a direction for duration
- ✅ jump - Make the bot jump
- sprint - Toggle sprint mode
- sneak - Toggle sneak mode
- stop-moving - Stop all movement immediately
- ✅ look-at - Look at specific coordinates
- rotate - Rotate by yaw/pitch angles
- ✅ fly-to - Fly to position (creative mode)
- pathfind-to - Advanced pathfinding with options

---

## **Object Interaction**

- ✅ equip-item - Equip item to hand or armor slot
- ⭐ use-item - Use item in hand (right-click action)
- ⭐ drop-item - Drop item from inventory
- swap-hand - Swap item between main/off hand
- open-inventory - Open inventory interface
- close-inventory - Close inventory interface

---

## **Mining / Block Interaction**

- ✅ dig-block - Break block at coordinates
- ✅ place-block - Place block at coordinates
- ✅ get-block-info - Get block type and properties
- ✅ find-block - Find nearest block of type
- can-place - Check if block can be placed
- can-dig - Check if block can be broken
- break-block-face - Break specific face of block
- ⭐ get-nearby-blocks - Scan blocks in radius
- ⭐ get-light-level - Get light level at position
- ⭐ is-block-visible - Check block line-of-sight

---

## **Redstone / Mechanics**

- ⭐ activate-block - Activate buttons, levers, doors, etc.
- toggle-redstone - Toggle redstone component
- place-redstone - Place redstone dust
- place-repeater - Place redstone repeater
- place-comparator - Place redstone comparator

---

## **Entity / Combat**

- ✅ find-entity - Find nearest entity
- ⭐ attack-entity - Attack specific entity
- ⭐ interact-entity - Interact with mob/villager/entity
- mount-entity - Mount rideable entity
- unmount - Dismount from entity
- defend - Enter defensive stance
- ⭐ use-shield - Raise shield for blocking
- shoot-bow - Shoot arrow with bow
- throw-item - Throw projectile item
- ⭐ get-nearby-entities - List entities in radius with details

---

## **Inventory**

- ✅ list-inventory - List all inventory items
- ✅ find-item - Find item in inventory
- move-item - Move item between slots
- drop-all - Drop all items of type
- ⭐ transfer-item - Transfer items to/from container

---

## **Crafting & Processing**

- ✅ craft-item - Craft item with quantity
- ✅ can-craft - Check if item is craftable
- ✅ list-recipes - List available recipes
- ✅ get-recipe - Get recipe details
- ⭐ smelt-item - Smelt items in furnace
- brew-item - Brew potions

---

## **Survival & Consumption**

- ⭐ eat-food - Eat food from inventory
- drink-potion - Drink potion
- sleep - Sleep in bed
- wake-up - Wake up from bed

---

## **Building / Structures**

- fill-blocks - Fill area with blocks (batch placement)
- replace-blocks - Replace blocks in area
- clone-area - Clone region to another location
- copy-structure - Copy structure to memory
- paste-structure - Paste saved structure
- save-structure - Save structure to file

---

## **Chat / Commands**

- ✅ read-chat - Read recent chat messages
- ✅ send-chat - Send chat message
- send-command - Execute server command
- read-whisper - Read private messages
- read-system-messages - Read system notifications
- ⭐ broadcast-chat - Send message from all bots (multi-bot)

---

## **World Management**

- set-time - Set world time
- ⭐ get-time - Get current world time (day/night/ticks)
- set-weather - Set weather conditions
- ⭐ get-weather - Get current weather
- set-gamerule - Modify game rule
- set-difficulty - Change difficulty level
- get-world-info - Get world metadata
- ⭐ get-biome - Get biome at position

---

## **Dimensions / Portals**

- enter-portal - Enter nether/end portal
- exit-portal - Exit from portal
- create-portal - Build portal structure
- teleport - Teleport to coordinates

---

## **Safety & Diagnostics**

- is-safe-location - Check if position is safe
- get-nearby-hazards - Detect dangerous blocks/mobs
- get-path-cost - Calculate path difficulty
- log-state - Log current bot state for debugging

---

## **Multi-Bot Management**

- ⭐ spawn-bot - Create and connect new bot
- ⭐ list-bots - List all active bots
- ⭐ select-bot - Set active bot
- ⭐ remove-bot - Disconnect and remove bot
- get-bot-status - Get status of specific bot
- sync-bots - Synchronize bot positions/actions

---

## **Advanced Navigation**

- follow-entity - Follow player or mob
- patrol-area - Patrol between waypoints
- guard-position - Guard specific location
- return-home - Return to spawn/home position
- set-waypoint - Save named position
- goto-waypoint - Navigate to saved waypoint

---

## **Vision & Observation**

- scan-area - Comprehensive area scan
- detect-changes - Detect block changes in area
- track-entity - Track entity movement
- observe-player - Monitor player actions
- screenshot - Capture bot's view (if supported)

---

## Implementation Notes

### Current Status (v2.0.1)
- **Position Tools**: Fully implemented (5 tools)
- **Inventory Tools**: Basic implementation (3 tools)
- **Block Tools**: Core functionality (4 tools)
- **Entity Tools**: Basic implementation (1 tool)
- **Chat Tools**: Functional (2 tools)
- **Flight Tools**: Creative mode support (1 tool)
- **Gamestate Tools**: Detection implemented (1 tool)
- **Crafting Tools**: Comprehensive system (5 tools)

### Priority Categories

**High Priority (⭐)**
Essential tools for better bot functionality:
- Health/hunger monitoring
- Food consumption
- Entity interaction and combat
- Block activation
- Time and weather information
- Multi-bot management foundation

**Medium Priority (📋)**
Quality of life improvements:
- Advanced movement (sprint, sneak)
- Container management
- Redstone interaction
- Brewing system

**Low Priority**
Advanced features:
- Structure manipulation
- Dimension management
- Complex pathfinding
- Vision systems

---

## Contributing

When implementing new tools:
1. Follow the pattern in existing tool files
2. Add comprehensive error handling
3. Include proper Zod schema validation
4. Test with actual Minecraft server
5. Update this document with ✅ when complete
6. Add tests to the test suite
