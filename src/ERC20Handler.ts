import { ERC20, AccountIdleBalance, Token } from "generated";
import { getOrCreateToken } from "./viem/Contract";
import { walletCache } from "./utils/WalletCache";
import { priceFetcher } from "./utils/PriceFetcher";
import { VenusPoolAddress } from "./constants/VenusPools";
import { VenusHandler } from "./VenusHandler";
import { venusShareFetcher } from "./utils/VenusShareFetcher";

ERC20.Transfer.handlerWithLoader({
  loader: async ({ event, context }) => {
    const [senderAccount, receiverAccount, token, claveAddresses] = await Promise.all([
      context.AccountIdleBalance.get(
        event.params.from.toLowerCase() + event.srcAddress.toLowerCase()
      ),
      context.AccountIdleBalance.get(
        event.params.to.toLowerCase() + event.srcAddress.toLowerCase()
      ),
      context.Token.get(event.srcAddress.toLowerCase()),
      walletCache.bulkCheckClaveWallets([
        event.params.from.toLowerCase(),
        event.params.to.toLowerCase(),
      ]),
    ]);
    return {
      senderAccount,
      receiverAccount,
      token,
      claveAddresses,
    };
  },
  handler: async ({ event, context, loaderReturn }) => {
    const { senderAccount, receiverAccount, token, claveAddresses } = loaderReturn as {
      senderAccount: AccountIdleBalance;
      receiverAccount: AccountIdleBalance;
      token: Token;
      claveAddresses: Set<string>;
    };

    try {
      await priceFetcher.genOdosTokenPrices(context, event);
      await venusShareFetcher.genVenusPoolShares(context, event);
    } catch (e) {
      console.log(e);
    }

    if (claveAddresses.size == 0) {
      return;
    }

    if (Object.keys(VenusPoolAddress).includes(event.srcAddress.toLowerCase())) {
      return await VenusHandler({ event, context, loaderReturn });
    }

    const generatedToken = await getOrCreateToken(event.srcAddress.toLowerCase(), token, context);

    if (event.params.from === event.params.to) {
      return;
    }

    if (senderAccount === undefined && claveAddresses.has(event.params.from.toLowerCase())) {
      // create the account
      let accountObject: AccountIdleBalance = {
        id: event.params.from.toLowerCase() + generatedToken.id,
        balance: 0n - event.params.value,
        address: event.params.from.toLowerCase(),
        token_id: generatedToken.id,
      };

      context.AccountIdleBalance.set(accountObject);
      context.HistoricalAccountIdleBalance.set({
        ...accountObject,
        id: accountObject.id + event.block.timestamp.toString(),
        timestamp: BigInt(event.block.timestamp),
      });
    } else if (claveAddresses.has(event.params.from.toLowerCase())) {
      // subtract the balance from the existing users balance
      let accountObject: AccountIdleBalance = {
        id: senderAccount.id,
        balance: senderAccount.balance - event.params.value,
        address: senderAccount.address.toLowerCase(),
        token_id: senderAccount.token_id,
      };

      context.AccountIdleBalance.set(accountObject);
      context.HistoricalAccountIdleBalance.set({
        ...accountObject,
        id: accountObject.id + event.block.timestamp.toString(),
        timestamp: BigInt(event.block.timestamp),
      });
    }

    if (receiverAccount === undefined && claveAddresses.has(event.params.to.toLowerCase())) {
      // create new account
      let accountObject: AccountIdleBalance = {
        id: event.params.to.toLowerCase() + generatedToken.id,
        balance: event.params.value,
        address: event.params.to.toLowerCase(),
        token_id: generatedToken.id,
      };

      context.AccountIdleBalance.set(accountObject);
      context.HistoricalAccountIdleBalance.set({
        ...accountObject,
        id: accountObject.id + event.block.timestamp.toString(),
        timestamp: BigInt(event.block.timestamp),
      });
    } else if (claveAddresses.has(event.params.to.toLowerCase())) {
      // update existing account
      let accountObject: AccountIdleBalance = {
        id: receiverAccount.id,
        balance: receiverAccount.balance + event.params.value,
        address: receiverAccount.address.toLowerCase(),
        token_id: receiverAccount.token_id,
      };

      context.AccountIdleBalance.set(accountObject);
      context.HistoricalAccountIdleBalance.set({
        ...accountObject,
        id: accountObject.id + event.block.timestamp.toString(),
        timestamp: BigInt(event.block.timestamp),
      });
    }
  },

  wildcard: true,
});
