import process from 'node:process';
import { CosmosClient, Database, Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

export class UserDbService {
  private static instance: UserDbService;
  private client: CosmosClient | undefined = undefined;
  private database: Database | undefined = undefined;
  private usersContainer: Container | undefined = undefined;
  private isCosmosDbInitialized = false;
  private readonly inMemoryStorage = new Map<string, any>();
  private useInMemoryStorage = true; // Default to in-memory storage

  static async getInstance(): Promise<UserDbService> {
    if (!UserDbService.instance) {
      const instance = new UserDbService();
      await instance.initializeCosmosDb();
      UserDbService.instance = instance;
    }

    return UserDbService.instance;
  }

  protected async initializeCosmosDb(): Promise<void> {
    try {
      const endpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
      if (!endpoint) {
        console.log('Cosmos DB endpoint not configured. Using in-memory storage for users.');
        this.useInMemoryStorage = true;
        return;
      }

      console.log('Attempting to connect to Cosmos DB for users...');
      const credential = new DefaultAzureCredential();
      this.client = new CosmosClient({ endpoint, aadCredentials: credential });
      const databaseId = 'userDB';
      const { database } = await this.client.databases.createIfNotExists({ id: databaseId });
      this.database = database;
      const { container } = await this.database.containers.createIfNotExists({
        id: 'users',
        partitionKey: { paths: ['/id'] },
      });
      this.usersContainer = container;
      this.isCosmosDbInitialized = true;
      this.useInMemoryStorage = false; // Switch to Cosmos DB if connection succeeds
      console.log('Successfully connected to Cosmos DB for users');
    } catch (error) {
      console.warn('Failed to initialize Cosmos DB for users. Falling back to in-memory storage.', error);
      this.useInMemoryStorage = true;
    }
  }

  async getUserById(id: string): Promise<any | undefined> {
    if (this.useInMemoryStorage) {
      return this.inMemoryStorage.get(id);
    }

    if (!this.isCosmosDbInitialized) return undefined;
    try {
      const { resource } = await this.usersContainer!.item(id, id).read();
      return resource;
    } catch (error: any) {
      if (error.code === 404) return undefined;
      throw error;
    }
  }

  async createUser(id: string): Promise<any> {
    const user = {
      id,
      createdAt: new Date().toISOString(),
    };

    if (this.useInMemoryStorage) {
      this.inMemoryStorage.set(id, user);
      console.log(`Created user ${id} in in-memory storage`);
      return user;
    }

    if (!this.isCosmosDbInitialized) {
      console.warn('Cosmos DB not initialized, falling back to in-memory storage');
      this.inMemoryStorage.set(id, user);
      return user;
    }

    const { resource } = await this.usersContainer!.items.create(user);
    console.log(`Created user ${id} in Cosmos DB`);
    return resource;
  }
}
