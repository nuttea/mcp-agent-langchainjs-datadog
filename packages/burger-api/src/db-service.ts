import { Pool } from 'pg';
import burgersData from '../data/burgers.json';
import toppingsData from '../data/toppings.json';
import { ToppingCategory, Topping } from './topping.js';
import { Burger } from './burger.js';
import { Order, OrderStatus } from './order.js';

// Helper to remove userId from Order(s)
function stripUserId<T extends Order | Order[] | undefined>(orderOrOrders: T): T {
  if (Array.isArray(orderOrOrders)) {
    return orderOrOrders.map((order) => {
      if (!order) return order;
      const { userId, ...rest } = order;
      return rest as Order;
    }) as T;
  }

  if (orderOrOrders && typeof orderOrOrders === 'object') {
    const { userId, ...rest } = orderOrOrders;
    return rest as T;
  }

  return orderOrOrders;
}

// Database service for our burger API using PostgreSQL
export class DbService {
  private static instance: DbService;
  private pool: Pool | undefined = undefined;

  // Fallback to local data if PostgreSQL is not available
  private localBurgers: Burger[] = [];
  private localToppings: Topping[] = [];
  private localOrders: Order[] = [];
  private isPostgresInitialized = false;

  static async getInstance(): Promise<DbService> {
    if (!DbService.instance) {
      const instance = new DbService();
      await instance.initializePostgres();
      instance.initializeLocalData();
      DbService.instance = instance;
    }

    return DbService.instance;
  }

  // Initialize PostgreSQL client
  protected async initializePostgres(): Promise<void> {
    try {
      const host = process.env.POSTGRES_HOST || 'postgres-0.postgres.mcp-agent-dev.svc.cluster.local';
      const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
      const user = process.env.POSTGRES_USER || 'burgerapp';
      const password = process.env.POSTGRES_PASSWORD;
      const database = process.env.POSTGRES_DB || 'burgerdb';

      if (!password) {
        console.warn('PostgreSQL password not found in environment variables. Using local data.');
        return;
      }

      console.log(`Connecting to PostgreSQL at ${host}:${port}/${database}...`);

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

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isPostgresInitialized = true;
      console.log('Successfully connected to PostgreSQL');
    } catch (error) {
      console.error('Failed to initialize PostgreSQL:', error);
      console.warn('Falling back to local data storage');
      if (this.pool) {
        await this.pool.end().catch(console.error);
        this.pool = undefined;
      }
    }
  }

  // Burger methods
  async getBurgers(): Promise<Burger[]> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        const result = await this.pool.query('SELECT * FROM burgers');
        return result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          price: parseFloat(row.price),
          image: row.image,
        }));
      } catch (error) {
        console.error('Error fetching burgers from PostgreSQL:', error);
        return [...this.localBurgers];
      }
    }

    return [...this.localBurgers];
  }

  async getBurger(id: string): Promise<Burger | undefined> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        const result = await this.pool.query('SELECT * FROM burgers WHERE id = $1', [id]);
        if (result.rows.length === 0) return undefined;
        const row = result.rows[0];
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          price: parseFloat(row.price),
          image: row.image,
        };
      } catch (error) {
        console.error(`Error fetching burger ${id} from PostgreSQL:`, error);
        return this.localBurgers.find((burger) => burger.id === id);
      }
    }

    return this.localBurgers.find((burger) => burger.id === id);
  }

  // Topping methods
  async getToppings(): Promise<Topping[]> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        const result = await this.pool.query('SELECT * FROM toppings');
        return result.rows.map(row => ({
          id: row.id,
          name: row.name,
          category: row.category as ToppingCategory,
          price: parseFloat(row.price),
        }));
      } catch (error) {
        console.error('Error fetching toppings from PostgreSQL:', error);
        return [...this.localToppings];
      }
    }

    return [...this.localToppings];
  }

  async getTopping(id: string): Promise<Topping | undefined> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        const result = await this.pool.query('SELECT * FROM toppings WHERE id = $1', [id]);
        if (result.rows.length === 0) return undefined;
        const row = result.rows[0];
        return {
          id: row.id,
          name: row.name,
          category: row.category as ToppingCategory,
          price: parseFloat(row.price),
        };
      } catch (error) {
        console.error(`Error fetching topping ${id} from PostgreSQL:`, error);
        return this.localToppings.find((topping) => topping.id === id);
      }
    }

    return this.localToppings.find((topping) => topping.id === id);
  }

  async getToppingsByCategory(category: ToppingCategory): Promise<Topping[]> {
    const toppings = await this.getToppings();
    return toppings.filter((topping) => topping.category === category);
  }

  // Order methods
  async getOrders(userId?: string): Promise<Order[]> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        let query = 'SELECT * FROM orders';
        const params: any[] = [];

        if (userId) {
          query += ' WHERE user_id = $1';
          params.push(userId);
        }

        query += ' ORDER BY created_at DESC';

        const result = await this.pool.query(query, params);
        const orders = result.rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          burgerId: row.burger_id,
          toppingIds: row.topping_ids || [],
          status: row.status as OrderStatus,
          total: parseFloat(row.total),
        }));
        return stripUserId(orders);
      } catch (error) {
        console.error('Error fetching orders from PostgreSQL:', error);
        const orders = userId ? this.localOrders.filter((order) => order.userId === userId) : this.localOrders;
        return stripUserId(orders);
      }
    }

    const orders = userId ? this.localOrders.filter((order) => order.userId === userId) : this.localOrders;
    return stripUserId(orders);
  }

  async getOrder(id: string, userId?: string): Promise<Order | undefined> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (result.rows.length === 0) return undefined;

        const row = result.rows[0];
        const order: Order = {
          id: row.id,
          userId: row.user_id,
          burgerId: row.burger_id,
          toppingIds: row.topping_ids || [],
          status: row.status as OrderStatus,
          total: parseFloat(row.total),
        };

        if (userId && order.userId !== userId) {
          return undefined;
        }

        return stripUserId(order);
      } catch (error) {
        console.error(`Error fetching order ${id} from PostgreSQL:`, error);
        const order = this.localOrders.find((order) => order.id === id);
        if (!order) return undefined;
        if (userId && order.userId !== userId) {
          return undefined;
        }

        return stripUserId(order);
      }
    }

    const order = this.localOrders.find((order) => order.id === id);
    if (!order) return undefined;
    if (userId && order.userId !== userId) {
      return undefined;
    }

    return stripUserId(order);
  }

  async createOrder(order: Order): Promise<Order> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        const result = await this.pool.query(
          'INSERT INTO orders (id, user_id, burger_id, topping_ids, status, total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [order.id, order.userId, order.burgerId, order.toppingIds, order.status, order.total]
        );
        const row = result.rows[0];
        const createdOrder: Order = {
          id: row.id,
          userId: row.user_id,
          burgerId: row.burger_id,
          toppingIds: row.topping_ids || [],
          status: row.status as OrderStatus,
          total: parseFloat(row.total),
        };
        return stripUserId(createdOrder);
      } catch (error) {
        console.error('Error creating order in PostgreSQL:', error);
        this.localOrders.push(order);
        return stripUserId(order);
      }
    }

    this.localOrders.push(order);
    return stripUserId(order);
  }

  async updateOrderStatus(id: string, status: OrderStatus, userId?: string): Promise<Order | undefined> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        let query = 'UPDATE orders SET status = $1 WHERE id = $2';
        const params: any[] = [status, id];

        if (userId) {
          query += ' AND user_id = $3';
          params.push(userId);
        }

        query += ' RETURNING *';

        const result = await this.pool.query(query, params);
        if (result.rows.length === 0) return undefined;

        const row = result.rows[0];
        const updatedOrder: Order = {
          id: row.id,
          userId: row.user_id,
          burgerId: row.burger_id,
          toppingIds: row.topping_ids || [],
          status: row.status as OrderStatus,
          total: parseFloat(row.total),
        };
        return stripUserId(updatedOrder);
      } catch (error) {
        console.error(`Error updating order ${id} in PostgreSQL:`, error);
        const orderIndex = this.localOrders.findIndex((order) => order.id === id);
        if (orderIndex === -1) return undefined;

        const order = this.localOrders[orderIndex];
        if (userId && order.userId !== userId) {
          return undefined;
        }

        this.localOrders[orderIndex] = { ...order, status };
        return stripUserId(this.localOrders[orderIndex]);
      }
    }

    const orderIndex = this.localOrders.findIndex((order) => order.id === id);
    if (orderIndex === -1) return undefined;

    const order = this.localOrders[orderIndex];
    if (userId && order.userId !== userId) {
      return undefined;
    }

    this.localOrders[orderIndex] = { ...order, status };
    return stripUserId(this.localOrders[orderIndex]);
  }

  async deleteOrder(id: string, userId?: string): Promise<boolean> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        let query = 'DELETE FROM orders WHERE id = $1';
        const params: any[] = [id];

        if (userId) {
          query += ' AND user_id = $2';
          params.push(userId);
        }

        const result = await this.pool.query(query, params);
        return (result.rowCount || 0) > 0;
      } catch (error) {
        console.error(`Error deleting order ${id} from PostgreSQL:`, error);
        const orderIndex = this.localOrders.findIndex((order) => order.id === id);
        if (orderIndex === -1) return false;

        const order = this.localOrders[orderIndex];
        if (userId && order.userId !== userId) {
          return false;
        }

        this.localOrders.splice(orderIndex, 1);
        return true;
      }
    }

    const orderIndex = this.localOrders.findIndex((order) => order.id === id);
    if (orderIndex === -1) return false;

    const order = this.localOrders[orderIndex];
    if (userId && order.userId !== userId) {
      return false;
    }

    this.localOrders.splice(orderIndex, 1);
    return true;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    if (this.isPostgresInitialized && this.pool) {
      try {
        const setClauses: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (updates.status !== undefined) {
          setClauses.push(`status = $${paramIndex++}`);
          params.push(updates.status);
        }
        if (updates.total !== undefined) {
          setClauses.push(`total = $${paramIndex++}`);
          params.push(updates.total);
        }
        if (updates.toppingIds !== undefined) {
          setClauses.push(`topping_ids = $${paramIndex++}`);
          params.push(updates.toppingIds);
        }
        if (updates.burgerId !== undefined) {
          setClauses.push(`burger_id = $${paramIndex++}`);
          params.push(updates.burgerId);
        }

        if (setClauses.length === 0) {
          return await this.getOrder(id);
        }

        params.push(id);
        const query = `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

        const result = await this.pool.query(query, params);
        if (result.rows.length === 0) return undefined;

        const row = result.rows[0];
        const updatedOrder: Order = {
          id: row.id,
          userId: row.user_id,
          burgerId: row.burger_id,
          toppingIds: row.topping_ids || [],
          status: row.status as OrderStatus,
          total: parseFloat(row.total),
        };
        return stripUserId(updatedOrder);
      } catch (error) {
        console.error(`Error updating order ${id} in PostgreSQL:`, error);
        const orderIndex = this.localOrders.findIndex((order) => order.id === id);
        if (orderIndex === -1) return undefined;

        this.localOrders[orderIndex] = { ...this.localOrders[orderIndex], ...updates };
        return stripUserId(this.localOrders[orderIndex]);
      }
    }

    const orderIndex = this.localOrders.findIndex((order) => order.id === id);
    if (orderIndex === -1) return undefined;

    this.localOrders[orderIndex] = { ...this.localOrders[orderIndex], ...updates };
    return stripUserId(this.localOrders[orderIndex]);
  }

  // User methods
  async createUser(id: string, name: string): Promise<void> {
    if (!this.isPostgresInitialized || !this.pool) {
      console.warn('PostgreSQL not initialized. User creation skipped.');
      return;
    }

    try {
      await this.pool.query(
        'INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [id, name]
      );
    } catch (error) {
      console.error('Error creating user:', error);
    }
  }

  async getUserName(id: string): Promise<string | undefined> {
    if (!this.isPostgresInitialized || !this.pool) {
      console.warn('PostgreSQL not initialized. Cannot fetch user name.');
      return undefined;
    }

    try {
      const result = await this.pool.query('SELECT name FROM users WHERE id = $1', [id]);
      return result.rows.length > 0 ? result.rows[0].name : undefined;
    } catch (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
  }

  async userExists(id: string): Promise<boolean> {
    if (!this.isPostgresInitialized || !this.pool) {
      console.warn('PostgreSQL not initialized. Assuming user exists.');
      return true; // Fallback to allowing operation
    }

    try {
      const result = await this.pool.query('SELECT 1 FROM users WHERE id = $1', [id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }

  async getRegisteredUsers(): Promise<number> {
    if (!this.isPostgresInitialized || !this.pool) {
      console.warn('PostgreSQL not initialized. Cannot count registered users.');
      return 0;
    }

    try {
      const result = await this.pool.query('SELECT COUNT(*) as count FROM users');
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('Error counting registered users:', error);
      return 0;
    }
  }

  // Initialize local data from JSON files
  protected initializeLocalData(): void {
    this.localBurgers = burgersData as Burger[];
    this.localToppings = toppingsData as Topping[];
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
      this.isPostgresInitialized = false;
    }
  }
}
