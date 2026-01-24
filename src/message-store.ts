interface StoredMessage {
  timestamp: number;
  botName?: string; // Optional: which bot received this message
  username: string;
  content: string;
}

const MAX_STORED_MESSAGES = 100;

export class MessageStore {
  private messages: StoredMessage[] = [];
  private maxMessages = MAX_STORED_MESSAGES;

  /**
   * Add a message to the store
   * @param username The username who sent the message
   * @param content The message content
   * @param botName Optional: which bot received this message
   */
  addMessage(username: string, content: string, botName?: string): void {
    const message: StoredMessage = {
      timestamp: Date.now(),
      botName,
      username,
      content
    };

    this.messages.push(message);

    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  /**
   * Get recent messages, optionally filtered by bot name
   * @param count Number of messages to retrieve
   * @param botName Optional: filter messages by bot name
   */
  getRecentMessages(count: number = 10, botName?: string): StoredMessage[] {
    if (count <= 0) {
      return [];
    }

    let filtered = this.messages;

    // Filter by bot name if specified
    if (botName !== undefined) {
      filtered = this.messages.filter(msg => msg.botName === botName);
    }

    return filtered.slice(-count);
  }

  getMaxMessages(): number {
    return this.maxMessages;
  }
}

export type { StoredMessage };
