const MAX_STORED_MESSAGES = 40;
const MAX_STORED_MESSAGE_LENGTH = 8_000;

export function compactConversationForStorage<T extends {text: string}>(messages: T[]): T[] {
  return messages.slice(-MAX_STORED_MESSAGES).map(message => ({
    ...message,
    text:
      message.text.length > MAX_STORED_MESSAGE_LENGTH
        ? `${message.text.slice(0, MAX_STORED_MESSAGE_LENGTH).trimEnd()}...`
        : message.text,
  }));
}

export function safelyStoreConversation(storageKey: string, messages: Array<{text: string}>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(compactConversationForStorage(messages)));
    return true;
  } catch (error) {
    console.error(`Failed to save conversation history for ${storageKey}`, error);
    return false;
  }
}
