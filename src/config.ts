import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface ServerConfig {
  host: string;
  port: number;
}

export interface AppConfig {
  server: ServerConfig;
  initialBot?: string; // Optional initial bot username
}

/**
 * Parse configuration from command line arguments
 * Configures a single Minecraft server target
 * Optionally spawns an initial bot
 */
export function parseConfig(): AppConfig {
  const argv = yargs(hideBin(process.argv))
    .option('host', {
      type: 'string',
      description: 'Minecraft server host address',
      default: 'localhost'
    })
    .option('port', {
      type: 'number',
      description: 'Minecraft server port',
      default: 25565
    })
    .option('username', {
      type: 'string',
      description: 'Optional: spawn an initial bot with this username'
    })
    .example('$0 --host localhost --port 25565', 'Connect to server, no initial bot')
    .example('$0 --host localhost --port 25565 --username MyBot', 'Connect to server with initial bot')
    .help()
    .alias('help', 'h')
    .parseSync();

  return {
    server: {
      host: argv.host,
      port: argv.port
    },
    initialBot: argv.username
  };
}
