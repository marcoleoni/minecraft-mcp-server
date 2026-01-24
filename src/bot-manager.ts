import mineflayer from 'mineflayer';
import { BotConnection } from './bot-connection.js';

interface BotConfig {
  host: string;
  port: number;
  username: string;
}

interface ServerConfig {
  host: string;
  port: number;
}

interface BotInfo {
  name: string;
  username: string;
  host: string;
  port: number;
  state: string;
  isActive: boolean;
}

interface BotManagerCallbacks {
  onLog: (level: string, message: string) => void;
  onChatMessage: (botName: string, username: string, message: string) => void;
}

/**
 * Manages multiple bot connections to a single Minecraft server
 * Provides centralized access to bots by name or index
 */
export class BotManager {
  private bots: Map<string, BotConnection> = new Map();
  private activeBotName: string | null = null;
  private callbacks: BotManagerCallbacks;
  private botCounter = 0;
  private defaultServerConfig: ServerConfig;

  constructor(callbacks: BotManagerCallbacks, serverConfig: ServerConfig) {
    this.callbacks = callbacks;
    this.defaultServerConfig = serverConfig;
  }

  /**
   * Get the default server configuration
   */
  getServerConfig(): ServerConfig {
    return { ...this.defaultServerConfig };
  }

  /**
   * Spawn a new bot with the given username
   * Uses the default server configuration unless overridden
   * @param username Bot username in Minecraft
   * @param options Optional: name identifier and server override
   * @returns Success status and optional error message
   */
  async spawnBot(
    username: string,
    options?: { name?: string; host?: string; port?: number }
  ): Promise<{ success: boolean; message: string }> {
    // Use provided name or generate from username
    const botName = options?.name || username;

    // Check if bot with this name already exists
    if (this.bots.has(botName)) {
      return {
        success: false,
        message: `Bot with name '${botName}' already exists. Please use a different name or remove the existing bot first.`
      };
    }

    // Use default server config unless overridden
    const config: BotConfig = {
      host: options?.host || this.defaultServerConfig.host,
      port: options?.port || this.defaultServerConfig.port,
      username
    };

    this.callbacks.onLog('info', `Spawning bot '${botName}' (username: ${username}) at ${config.host}:${config.port}`);

    try {
      const connection = new BotConnection(
        config,
        {
          onLog: (level, message) => this.callbacks.onLog(level, `[${botName}] ${message}`),
          onChatMessage: (user, msg) => this.callbacks.onChatMessage(botName, user, msg)
        }
      );

      connection.connect();

      // Wait for connection to establish (max 10 seconds)
      const connectionResult = await connection.checkConnectionAndReconnect();

      if (!connectionResult.connected) {
        return {
          success: false,
          message: connectionResult.message || `Failed to connect bot '${botName}'`
        };
      }

      this.bots.set(botName, connection);
      this.botCounter++;

      // Set as active bot if it's the first one
      if (this.activeBotName === null) {
        this.activeBotName = botName;
        this.callbacks.onLog('info', `Bot '${botName}' set as active bot`);
      }

      return {
        success: true,
        message: `Bot '${botName}' (username: ${username}) spawned successfully and connected to ${config.host}:${config.port}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to spawn bot '${botName}': ${errorMessage}`
      };
    }
  }

  /**
   * Remove and disconnect a bot
   * @param nameOrIndex Bot name or numeric index (1-based)
   * @returns Success status and message
   */
  removeBot(nameOrIndex: string | number): { success: boolean; message: string } {
    const name = this.resolveBotName(nameOrIndex);

    if (!name) {
      return {
        success: false,
        message: `Bot '${nameOrIndex}' not found`
      };
    }

    const connection = this.bots.get(name);
    if (!connection) {
      return {
        success: false,
        message: `Bot '${name}' not found`
      };
    }

    // Cleanup the bot connection
    connection.cleanup();
    this.bots.delete(name);

    this.callbacks.onLog('info', `Bot '${name}' removed and disconnected`);

    // If this was the active bot, set a new active bot
    if (this.activeBotName === name) {
      const remainingBots = Array.from(this.bots.keys());
      this.activeBotName = remainingBots.length > 0 ? remainingBots[0] : null;

      if (this.activeBotName) {
        this.callbacks.onLog('info', `Bot '${this.activeBotName}' is now the active bot`);
      }
    }

    return {
      success: true,
      message: `Bot '${name}' removed successfully`
    };
  }

  /**
   * Get a bot by name or index
   * @param nameOrIndex Bot name or numeric index (1-based)
   * @returns Bot instance or null
   */
  getBot(nameOrIndex?: string | number): mineflayer.Bot | null {
    // If no parameter, return active bot
    if (nameOrIndex === undefined) {
      return this.getActiveBot();
    }

    const name = this.resolveBotName(nameOrIndex);

    if (!name) {
      return null;
    }

    const connection = this.bots.get(name);
    return connection ? connection.getBot() : null;
  }

  /**
   * Get the currently active bot
   */
  getActiveBot(): mineflayer.Bot | null {
    if (!this.activeBotName) {
      return null;
    }

    const connection = this.bots.get(this.activeBotName);
    return connection ? connection.getBot() : null;
  }

  /**
   * Get the BotConnection instance for a bot
   * @param nameOrIndex Bot name or numeric index (1-based)
   */
  getBotConnection(nameOrIndex?: string | number): BotConnection | null {
    if (nameOrIndex === undefined) {
      return this.activeBotName ? this.bots.get(this.activeBotName) || null : null;
    }

    const name = this.resolveBotName(nameOrIndex);
    return name ? this.bots.get(name) || null : null;
  }

  /**
   * Set the active bot
   * @param nameOrIndex Bot name or numeric index (1-based)
   * @returns Success status and message
   */
  setActiveBot(nameOrIndex: string | number): { success: boolean; message: string } {
    const name = this.resolveBotName(nameOrIndex);

    if (!name) {
      return {
        success: false,
        message: `Bot '${nameOrIndex}' not found`
      };
    }

    if (!this.bots.has(name)) {
      return {
        success: false,
        message: `Bot '${name}' not found`
      };
    }

    this.activeBotName = name;
    this.callbacks.onLog('info', `Active bot set to '${name}'`);

    return {
      success: true,
      message: `Active bot set to '${name}'`
    };
  }

  /**
   * Get the name of the active bot
   */
  getActiveBotName(): string | null {
    return this.activeBotName;
  }

  /**
   * List all bots with their information
   */
  listBots(): BotInfo[] {
    const botList: BotInfo[] = [];

    this.bots.forEach((connection, name) => {
      const config = connection.getConfig();
      botList.push({
        name,
        username: config.username,
        host: config.host,
        port: config.port,
        state: connection.getState(),
        isActive: name === this.activeBotName
      });
    });

    return botList;
  }

  /**
   * Get the number of active bots
   */
  getBotCount(): number {
    return this.bots.size;
  }

  /**
   * Check if a bot exists
   * @param nameOrIndex Bot name or numeric index (1-based)
   */
  hasBot(nameOrIndex: string | number): boolean {
    const name = this.resolveBotName(nameOrIndex);
    return name ? this.bots.has(name) : false;
  }

  /**
   * Resolve bot name from name or index
   * @param nameOrIndex Bot name or numeric index (1-based)
   * @returns Bot name or null if not found
   */
  private resolveBotName(nameOrIndex: string | number): string | null {
    // If it's a string, treat it as a name
    if (typeof nameOrIndex === 'string') {
      return this.bots.has(nameOrIndex) ? nameOrIndex : null;
    }

    // If it's a number, treat it as an index (1-based)
    if (typeof nameOrIndex === 'number') {
      const names = Array.from(this.bots.keys());
      const index = nameOrIndex - 1; // Convert to 0-based
      return index >= 0 && index < names.length ? names[index] : null;
    }

    return null;
  }

  /**
   * Cleanup all bots
   */
  cleanup(): void {
    this.callbacks.onLog('info', 'Cleaning up all bots...');

    this.bots.forEach((connection, name) => {
      this.callbacks.onLog('info', `Cleaning up bot '${name}'`);
      connection.cleanup();
    });

    this.bots.clear();
    this.activeBotName = null;
  }
}
