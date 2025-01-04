import { ERC20_Transfer_event, handlerContext } from "generated";
import { Address, getContract } from "viem";
import { client } from "../viem/Client";
import { VenusPoolABI } from "../abi/VenusPool";
import { VenusPoolAddress } from "../constants/VenusPools";
const THRESHOLD_BLOCK_NUMBER = 52500000;

export const VenusPoolsToFetchShare = new Set<Address>();

class VenusShareFetcher {
  latestHandledBlock = 0;
  syncInterval = 3000;
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

    for (let address of poolList) {
      const contract = getContract({ address, abi: VenusPoolABI, client });
      contracts.push({
        ...contract,
        functionName: "exchangeRateStored",
      });
    }

    const results = await client.multicall({ contracts });

    for (let i = 0; i < poolList.length; i++) {
      if (results[i].result === undefined) {
        continue;
      }
      const address = poolList[i];
      context.VenusPool.set({
        id: address,
        address,
        tokenPerShare: results[i].result as bigint,
        underlyingToken_id: VenusPoolAddress[address]?.underlyingToken,
      });
    }
  }
}

export const venusShareFetcher = new VenusShareFetcher();
