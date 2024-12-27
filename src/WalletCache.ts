import { getRedisInstance } from "./utils/Redis";

class WalletCache {
  private readonly CACHE_KEY = "clave:wallets";
  private redis: Awaited<ReturnType<typeof getRedisInstance>> | undefined;
  private inMemoryCache: Set<string> = new Set();

  constructor() {
    this.initialize();
  }

  async initialize() {
    // Create two connections - one for subscribing and one for getting data
    this.redis = await getRedisInstance({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
    });

    await this.updateInMemoryCache();
    await this.subscribeToSetOperations();
  }

  private async updateInMemoryCache() {
    await this.redis!.sMembers(this.CACHE_KEY).then((members) => {
      this.inMemoryCache = new Set(members);
    });
  }

  private async subscribeToSetOperations() {
    const keyspaceChannel = `__keyspace@0__:${this.CACHE_KEY}`;

    await this.redis!.subscribe(keyspaceChannel, () => {
      this.updateInMemoryCache();
    });
  }

  async bulkCheckClaveWallets(addresses: Array<string>): Promise<Set<string>> {
    if (!this.redis) {
      await this.initialize();
    }

    try {
      const claveAddresses = new Set<string>();
      const lowercaseAddresses = addresses.map((addr) => addr.toLowerCase());

      lowercaseAddresses.forEach((address) => {
        const isMember = this.inMemoryCache.has(address);
        if (isMember) {
          claveAddresses.add(address);
        }
      });

      return claveAddresses;
    } catch (error) {
      console.error("Failed to bulk check wallets", error);
      return new Set<string>();
    }
  }
}

export const walletCache = new WalletCache();
