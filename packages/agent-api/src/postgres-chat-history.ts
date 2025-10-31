import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import { BaseMessage, mapStoredMessageToChatMessage, AIMessage, HumanMessage } from '@langchain/core/messages';
import { Pool } from 'pg';

export interface PostgresChatMessageHistoryInput {
  sessionId: string;
  userId: string;
  pool: Pool;
}

export class PostgresChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ['langchain', 'stores', 'message', 'postgres'];

  private sessionId: string;
  private userId: string;
  private pool: Pool;

  constructor(fields: PostgresChatMessageHistoryInput) {
    super(fields);
    this.sessionId = fields.sessionId;
    this.userId = fields.userId;
    this.pool = fields.pool;
  }

  async getMessages(): Promise<BaseMessage[]> {
    try {
      const result = await this.pool.query(
        'SELECT messages FROM chats WHERE id = $1 AND user_id = $2',
        [this.sessionId, this.userId]
      );

      if (result.rows.length === 0 || !result.rows[0].messages) {
        return [];
      }

      const messages = result.rows[0].messages;

      // Convert stored messages to LangChain message format
      return messages.map((msg: any) => {
        if (msg.type === 'human') {
          return new HumanMessage({ content: msg.content, id: msg.id });
        } else if (msg.type === 'ai') {
          return new AIMessage({ content: msg.content, id: msg.id });
        }
        // Fallback to using mapStoredMessageToChatMessage for other types
        return mapStoredMessageToChatMessage(msg);
      });
    } catch (error) {
      console.error('Error fetching chat messages from PostgreSQL:', error);
      return [];
    }
  }

  async addMessage(message: BaseMessage): Promise<void> {
    try {
      // First, ensure the chat session exists
      await this.pool.query(
        `INSERT INTO chats (id, user_id, messages, created_at, updated_at)
         VALUES ($1, $2, '[]'::jsonb, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [this.sessionId, this.userId]
      );

      // Convert message to storable format
      const storedMessage = {
        type: message._getType(),
        content: message.content,
        id: message.id,
        additional_kwargs: message.additional_kwargs || {},
      };

      // Append the message to the messages JSONB array
      await this.pool.query(
        `UPDATE chats
         SET messages = messages || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
        [JSON.stringify(storedMessage), this.sessionId, this.userId]
      );
    } catch (error) {
      console.error('Error adding message to PostgreSQL chat history:', error);
      throw error;
    }
  }

  override async clear(): Promise<void> {
    try {
      await this.pool.query(
        'UPDATE chats SET messages = \'[]\'::jsonb, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        [this.sessionId, this.userId]
      );
    } catch (error) {
      console.error('Error clearing chat history in PostgreSQL:', error);
      throw error;
    }
  }

  async deleteChat(): Promise<void> {
    try {
      await this.pool.query(
        'DELETE FROM chats WHERE id = $1 AND user_id = $2',
        [this.sessionId, this.userId]
      );
    } catch (error) {
      console.error('Error deleting chat from PostgreSQL:', error);
      throw error;
    }
  }

  async getAllSessions(): Promise<Array<{ id: string; title?: string }>> {
    try {
      const result = await this.pool.query(
        'SELECT id, title FROM chats WHERE user_id = $1 ORDER BY updated_at DESC',
        [this.userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        title: row.title || undefined,
      }));
    } catch (error) {
      console.error('Error fetching all sessions from PostgreSQL:', error);
      return [];
    }
  }

  async getContext(): Promise<any> {
    try {
      const result = await this.pool.query(
        'SELECT title FROM chats WHERE id = $1 AND user_id = $2',
        [this.sessionId, this.userId]
      );

      if (result.rows.length === 0) {
        return {};
      }

      return { title: result.rows[0].title };
    } catch (error) {
      console.error('Error fetching chat context from PostgreSQL:', error);
      return {};
    }
  }

  async setContext(context: any): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO chats (id, user_id, title, messages, created_at, updated_at)
         VALUES ($1, $2, $3, '[]'::jsonb, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET title = $3, updated_at = NOW()`,
        [this.sessionId, this.userId, context.title || null]
      );
    } catch (error) {
      console.error('Error setting chat context in PostgreSQL:', error);
      throw error;
    }
  }
}
