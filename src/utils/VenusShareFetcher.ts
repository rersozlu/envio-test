import { ERC20_Transfer_event, handlerContext } from "generated";
import { Address, getContract } from "viem";
import { client } from "../viem/Client";
import { VenusPoolABI } from "../abi/VenusPool";
import { getOrCreateToken } from "../viem/Contract";

const THRESHOLD_BLOCK_NUMBER = 52500000;

export const VenusPoolsToFetchShare = new Set<Address>();

class VenusShareFetcher {
  latestHandledBlock = 0;
  syncInterval = 1800;
  asyncInterval = 100000;

  public async genVenusPoolShares(
    context: handlerContext,
    event: ERC20_Transfer_event
  ): Promise<void> {
    const interval =
      event.block.number > THRESHOLD_BLOCK_NUMBER ? this.syncInterval : this.asyncInterval;
    if (event.block.number <= this.latestHandledBlock + interval) {
      return;
    }
    if (VenusPoolsToFetchShare.size == 0) {
      return;
    }

    this.latestHandledBlock = event.block.number;

    const poolList = Array.from(VenusPoolsToFetchShare);

    const contracts = [];

    const underlyingTokenAddresses = [];

    for (let address of poolList) {
      const contract = getContract({ address, abi: VenusPoolABI, client });
      contracts.push({
        ...contract,
        functionName: "exchangeRateStored",
      });
      underlyingTokenAddresses.push({
        ...contract,
        functionName: "underlying",
      });
    }

    const poolRates = await client.multicall({ contracts });
    const underlyingTokenData = await client.multicall({ contracts: underlyingTokenAddresses });

    const underlyingTokens = [];
    for (let i = 0; i < poolList.length; i++) {
      const underlyingTokenAddress = underlyingTokenData[i].result as Address;
      const existingToken = await context.Token.get(underlyingTokenAddress?.toLowerCase());
      underlyingTokens.push(await getOrCreateToken(underlyingTokenAddress, context, existingToken));
    }

    for (let i = 0; i < poolList.length; i++) {
      if (poolRates[i].result === undefined) {
        continue;
      }
      const address = poolList[i];
      context.VenusPool.set({
        id: address,
        address,
        tokenPerShare: poolRates[i].result as bigint,
        underlyingToken_id: underlyingTokens[i].id,
      });
    }
  }
}

export const venusShareFetcher = new VenusShareFetcher();
