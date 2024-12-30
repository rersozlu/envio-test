import { ERC20, Account, Token, HistoricalAccount, Transfer } from "generated";
import { getOrCreateToken } from "./viem/Contract";
import { walletCache } from "./WalletCache";
import { priceFetcher } from "./PriceFetcher";
priceFetcher;

ERC20.Transfer.handlerWithLoader({
  loader: async ({ event, context }) => {
    const [senderAccount, receiverAccount, token, claveAddresses] = await Promise.all([
      context.Account.get(event.params.from.toLowerCase() + event.srcAddress.toLowerCase()),
      context.Account.get(event.params.to.toLowerCase() + event.srcAddress.toLowerCase()),
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
      senderAccount: Account;
      receiverAccount: Account;
      token: Token;
      claveAddresses: Set<string>;
    };

    if (claveAddresses.size == 0) {
      return;
    }

    const generatedToken = await getOrCreateToken(event.srcAddress.toLowerCase(), token, context);

    try {
      await priceFetcher.genOdosTokenPrices(context, event);
    } catch (e) {
      console.log(e);
    }

    const transferObject: Transfer = {
      id: event.transaction.hash + event.logIndex.toString(),
      from: event.params.from.toLowerCase(),
      to: event.params.to.toLowerCase(),
      token: event.srcAddress.toLowerCase(),
      value: event.params.value,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      transactionHash: event.transaction.hash,
      logIndex: event.logIndex,
    };

    if (event.params.from === event.params.to) {
      context.Transfer.set(transferObject);
      return;
    }

    if (senderAccount === undefined && claveAddresses.has(event.params.from.toLowerCase())) {
      // create the account
      let accountObject: Account = {
        id: event.params.from.toLowerCase() + generatedToken.id,
        balance: 0n - event.params.value,
        address: event.params.from.toLowerCase(),
        token_id: generatedToken.id,
      };

      context.Account.set(accountObject);
      context.HistoricalAccount.set({
        ...accountObject,
        id: accountObject.id + event.block.timestamp.toString(),
        timestamp: BigInt(event.block.timestamp),
      });
      context.Transfer.set(transferObject);
    } else if (claveAddresses.has(event.params.from.toLowerCase())) {
      // subtract the balance from the existing users balance
      let accountObject: Account = {
        id: senderAccount.id,
        balance: senderAccount.balance - event.params.value,
        address: senderAccount.address.toLowerCase(),
        token_id: senderAccount.token_id,
      };

      context.Account.set(accountObject);
      context.HistoricalAccount.set({
        ...accountObject,
        id: accountObject.id + event.block.timestamp.toString(),
        timestamp: BigInt(event.block.timestamp),
      });
      context.Transfer.set(transferObject);
    }

    if (receiverAccount === undefined && claveAddresses.has(event.params.to.toLowerCase())) {
      // create new account
      let accountObject: Account = {
        id: event.params.to.toLowerCase() + generatedToken.id,
        balance: event.params.value,
        address: event.params.to.toLowerCase(),
        token_id: generatedToken.id,
      };

      context.Account.set(accountObject);
      context.HistoricalAccount.set({
        ...accountObject,
        id: accountObject.id + event.block.timestamp.toString(),
        timestamp: BigInt(event.block.timestamp),
      });
      context.Transfer.set(transferObject);
    } else if (claveAddresses.has(event.params.to.toLowerCase())) {
      // update existing account
      let accountObject: Account = {
        id: receiverAccount.id,
        balance: receiverAccount.balance + event.params.value,
        address: receiverAccount.address.toLowerCase(),
        token_id: receiverAccount.token_id,
      };

      context.Account.set(accountObject);
      context.HistoricalAccount.set({
        ...accountObject,
        id: accountObject.id + event.block.timestamp.toString(),
        timestamp: BigInt(event.block.timestamp),
      });
      context.Transfer.set(transferObject);
    }
  },
  wildcard: true,
});
