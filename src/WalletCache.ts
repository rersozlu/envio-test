import { getRedisInstance } from "./utils/Redis";

class WalletCache {
  private readonly CACHE_KEY = "clave:wallets";
  private redis: Awaited<ReturnType<typeof getRedisInstance>> | undefined;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 100; // ms

  constructor() {
    this.initialize();
  }

  async initialize() {
    this.redis = await getRedisInstance({
      host: process.env.REDIS_HOST || "redis-12945.c300.eu-central-1-1.ec2.redns.redis-cloud.com",
      port: parseInt(process.env.REDIS_PORT || "12945"),
      username: process.env.REDIS_USERNAME || "default",
      password: process.env.REDIS_PASSWORD || "YPbmBSP7lBumkk4oL6djJH4tfowkpDNo",
    });
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY * attempt));
        }
      }
    }

    throw lastError!;
  }

  async bulkCheckClaveWallets(addresses: Array<string>): Promise<Set<string>> {
    if (!this.redis) {
      await this.initialize();
    }

    try {
      const claveAddresses = new Set<string>();
      const lowercaseAddresses = addresses.map((addr) => addr.toLowerCase());

      await Promise.all(
        lowercaseAddresses.map(async (address) => {
          const isMember = await this.retryOperation(() =>
            this.redis!.sIsMember(this.CACHE_KEY, address)
          );
          if (isMember) {
            claveAddresses.add(address);
          }
        })
      );

      return claveAddresses;
    } catch (error) {
      console.error("Failed to bulk check wallets", error);
      return new Set<string>();
    }
  }
}

export const walletCache = new WalletCache();
