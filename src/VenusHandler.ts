import { AccountVenusPosition, VenusPool, ERC20_Transfer_event } from "generated";
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
  const { senderAccount, receiverAccount, claveAddresses } = loaderReturn as {
    senderAccount: AccountVenusPosition;
    receiverAccount: AccountVenusPosition;
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
      tokenPerShare: 0n,
      underlyingToken_id: undefined,
    };
    context.VenusPool.set(newVenusPool);
    VenusPoolsToFetchShare.add(newVenusPool.address as Address);
  }

  if (event.params.from === event.params.to) {
    return;
  }

  if (claveAddresses.has(event.params.from.toLowerCase())) {
    // create the account
    let accountObject: AccountVenusPosition = {
      id: event.params.from.toLowerCase() + event.srcAddress.toLowerCase(),
      shareBalance:
        senderAccount == undefined
          ? 0n - event.params.value
          : senderAccount.shareBalance - event.params.value,
      userAddress: event.params.from.toLowerCase(),
      venusPool_id: event.srcAddress.toLowerCase(),
    };

    context.AccountVenusPosition.set(accountObject);
  }

  if (claveAddresses.has(event.params.to.toLowerCase())) {
    // create new account
    let accountObject: AccountVenusPosition = {
      id: event.params.to.toLowerCase() + event.srcAddress.toLowerCase(),
      shareBalance:
        receiverAccount == undefined
          ? event.params.value
          : event.params.value + receiverAccount.shareBalance,
      userAddress: event.params.to.toLowerCase(),
      venusPool_id: event.srcAddress.toLowerCase(),
    };

    context.AccountVenusPosition.set(accountObject);
  }
};
