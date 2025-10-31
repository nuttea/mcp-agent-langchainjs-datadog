import process from 'node:process';
import { Pool } from 'pg';

export class UserDbService {
  private static instance: UserDbService;
  private pool: Pool | undefined = undefined;
  private readonly inMemoryStorage = new Map<string, any>();
  private useInMemoryStorage = true; // Default to in-memory storage
  private isPostgresInitialized = false;

  static async getInstance(): Promise<UserDbService> {
    if (!UserDbService.instance) {
      const instance = new UserDbService();
      await instance.initializePostgres();
      UserDbService.instance = instance;
    }

    return UserDbService.instance;
  }

  protected async initializePostgres(): Promise<void> {
    try {
      const host = process.env.POSTGRES_HOST || 'postgres-0.postgres.mcp-agent-dev.svc.cluster.local';
      const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
      const user = process.env.POSTGRES_USER || 'burgerapp';
      const password = process.env.POSTGRES_PASSWORD;
      const database = process.env.POSTGRES_DB || 'burgerdb';

      if (!password) {
        console.log('PostgreSQL password not configured. Using in-memory storage for users.');
        this.useInMemoryStorage = true;
        return;
      }

      console.log(`Attempting to connect to PostgreSQL at ${host}:${port}/${database}...`);

      this.pool = new Pool({
        host,
        port,
        user,
        password,
        database,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isPostgresInitialized = true;
      this.useInMemoryStorage = false;
      console.log('Successfully connected to PostgreSQL for users');
    } catch (error) {
      console.warn('Failed to initialize PostgreSQL for users. Falling back to in-memory storage.', error);
      this.useInMemoryStorage = true;
      if (this.pool) {
        await this.pool.end().catch(console.error);
        this.pool = undefined;
      }
    }
  }

  async getUserById(id: string): Promise<any | undefined> {
    if (this.useInMemoryStorage) {
      return this.inMemoryStorage.get(id);
    }

    if (!this.isPostgresInitialized || !this.pool) return undefined;

    try {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) return undefined;

      return {
        id: result.rows[0].id,
        name: result.rows[0].name,
        createdAt: result.rows[0].created_at,
      };
    } catch (error: any) {
      console.error('Error fetching user from PostgreSQL:', error);
      throw error;
    }
  }

  async createUser(id: string, name?: string): Promise<any> {
    const user = {
      id,
      name: name || id,
      createdAt: new Date().toISOString(),
    };

    if (this.useInMemoryStorage) {
      this.inMemoryStorage.set(id, user);
      console.log(`Created user ${id} in in-memory storage`);
      return user;
    }

    if (!this.isPostgresInitialized || !this.pool) {
      console.warn('PostgreSQL not initialized, falling back to in-memory storage');
      this.inMemoryStorage.set(id, user);
      return user;
    }

    try {
      const result = await this.pool.query(
        'INSERT INTO users (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING RETURNING *',
        [id, user.name, new Date()]
      );

      if (result.rows.length > 0) {
        console.log(`Created user ${id} in PostgreSQL`);
        return {
          id: result.rows[0].id,
          name: result.rows[0].name,
          createdAt: result.rows[0].created_at,
        };
      } else {
        // User already exists
        return await this.getUserById(id);
      }
    } catch (error) {
      console.error('Error creating user in PostgreSQL:', error);
      throw error;
    }
  }

  getPool(): Pool | undefined {
    return this.pool;
  }

  isInitialized(): boolean {
    return this.isPostgresInitialized;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
      this.isPostgresInitialized = false;
    }
  }
}
