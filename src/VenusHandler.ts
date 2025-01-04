import { Token, AccountVenusPosition, VenusPool, ERC20_Transfer_event } from "generated";
import { getOrCreateToken } from "./viem/Contract";
import { VenusPoolAddress } from "./constants/VenusPools";
import { VenusPoolsToFetchShare } from "./utils/VenusShareFetcher";
import { Address } from "viem";

export const VenusHandler = async ({
  event,
  context,
  loaderReturn,
}: {
  event: ERC20_Transfer_event;
  context: any;
  loaderReturn: any;
}) => {
  const { senderAccount, receiverAccount, token, claveAddresses } = loaderReturn as {
    senderAccount: AccountVenusPosition;
    receiverAccount: AccountVenusPosition;
    token: Token;
    claveAddresses: Set<string>;
  };

  if (claveAddresses.size == 0) {
    return;
  }

  const venusPool = await context.VenusPool.get(event.srcAddress.toLowerCase());

  if (venusPool === undefined) {
    const newVenusPool: VenusPool = {
      id: event.srcAddress.toLowerCase(),
      address: event.srcAddress.toLowerCase(),
      underlyingToken_id: VenusPoolAddress[event.srcAddress.toLowerCase()]?.underlyingToken,
      tokenPerShare: 0n,
    };
    context.VenusPool.set(newVenusPool);
    VenusPoolsToFetchShare.add(newVenusPool.address as Address);
  }

  if (event.params.from === event.params.to) {
    return;
  }

  if (senderAccount === undefined && claveAddresses.has(event.params.from.toLowerCase())) {
    // create the account
    let accountObject: AccountVenusPosition = {
      id: event.params.from.toLowerCase() + event.srcAddress.toLowerCase(),
      shareBalance: 0n - event.params.value,
      userAddress: event.params.from.toLowerCase(),
      venusPool_id: event.srcAddress.toLowerCase(),
    };

    context.AccountVenusPosition.set(accountObject);
  } else if (claveAddresses.has(event.params.from.toLowerCase())) {
    // subtract the balance from the existing users balance
    let accountObject: AccountVenusPosition = {
      id: senderAccount.id,
      shareBalance: senderAccount.shareBalance - event.params.value,
      userAddress: senderAccount.userAddress.toLowerCase(),
      venusPool_id: senderAccount.venusPool_id,
    };

    context.AccountVenusPosition.set(accountObject);

    if (receiverAccount === undefined && claveAddresses.has(event.params.to.toLowerCase())) {
      // create new account
      let accountObject: AccountVenusPosition = {
        id: event.params.to.toLowerCase() + event.srcAddress.toLowerCase(),
        shareBalance: event.params.value,
        userAddress: event.params.to.toLowerCase(),
        venusPool_id: event.srcAddress.toLowerCase(),
      };

      context.AccountVenusPosition.set(accountObject);
    } else if (claveAddresses.has(event.params.to.toLowerCase())) {
      // update existing account
      let accountObject: AccountVenusPosition = {
        id: receiverAccount.id,
        shareBalance: receiverAccount.shareBalance + event.params.value,
        userAddress: receiverAccount.userAddress.toLowerCase(),
        venusPool_id: receiverAccount.venusPool_id,
      };

      context.AccountVenusPosition.set(accountObject);
    }
  }
};
