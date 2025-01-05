import { ERC20_Transfer_event, handlerContext } from "generated";
import { Address, getContract } from "viem";
import { client } from "../viem/Client";
import { SyncswapPoolABI } from "../abi/SyncswapPool";
import { getOrCreateToken } from "../viem/Contract";

const THRESHOLD_BLOCK_NUMBER = 52500000;

export const SyncswapPoolsToFetchShare = new Set<Address>();

class SyncswapShareFetcher {
  latestHandledBlock = 0;
  syncInterval = 1800;
  asyncInterval = 100000;

  public async genSyncswapPoolShares(
    context: handlerContext,
    event: ERC20_Transfer_event
  ): Promise<void> {
    const interval =
      event.block.number > THRESHOLD_BLOCK_NUMBER ? this.syncInterval : this.asyncInterval;
    if (event.block.number <= this.latestHandledBlock + interval) {
      return;
    }
    if (SyncswapPoolsToFetchShare.size == 0) {
      return;
    }

    this.latestHandledBlock = event.block.number;

    const poolList = Array.from(SyncswapPoolsToFetchShare);

    for (let address of poolList) {
      const pool = await context.SyncswapPool.get(address);
      const contract = getContract({ address, abi: SyncswapPoolABI, client });
      const [reserves, totalSupply, token0Precision] = await client.multicall({
        contracts: [
          { ...contract, functionName: "getReserves" },
          { ...contract, functionName: "totalSupply" },
          { ...contract, functionName: "token0PrecisionMultiplier" },
        ],
      });
      const price = calculateLPTokenPrice(
        (reserves.result as Array<bigint>)[0],
        totalSupply.result as bigint,
        pool?.poolType as bigint,
        token0Precision.result as bigint
      );
      context.SyncswapPool.set({
        id: address,
        address,
        name: pool?.name,
        symbol: pool?.symbol,
        tokenPerShare: price,
        poolType: pool?.poolType,
        underlyingToken_id: pool?.underlyingToken_id,
      });
    }
  }
}

function calculateLPTokenPrice(
  reserve0: bigint,
  totalSupply: bigint,
  poolType: bigint,
  token0PrecisionMultiplier = 1n
) {
  if (totalSupply === 0n) return 0n;

  // Convert to BigInt
  reserve0 = BigInt(reserve0);
  totalSupply = BigInt(totalSupply);

  if (poolType === 1n) {
    // Classic Pool
    // For classic pools, LP share is based on sqrt(k)
    return (reserve0 * BigInt(1e18)) / totalSupply;
  } else {
    // Stable Pool
    // Adjust reserves using precision multipliers like in the contract
    const adjustedReserve0 = reserve0 * token0PrecisionMultiplier;

    // Calculate value using adjusted reserves
    return (adjustedReserve0 * BigInt(1e18)) / (totalSupply * token0PrecisionMultiplier);
  }
}

export const syncswapShareFetcher = new SyncswapShareFetcher();
