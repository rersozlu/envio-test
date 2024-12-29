import { ERC20, Account, Token } from "generated";
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

    try {
      priceFetcher.genOdosTokenPrices(context, event);
    } catch {}

    if (claveAddresses.size == 0) {
      return;
    }

    const generatedToken = await getOrCreateToken(event.srcAddress.toLowerCase(), token, context);

    if (senderAccount === undefined && claveAddresses.has(event.params.from.toLowerCase())) {
      // create the account
      let accountObject: Account = {
        id: event.params.from.toLowerCase() + generatedToken.id,
        balance: 0n - event.params.value,
        address: event.params.from.toLowerCase(),
        token_id: generatedToken.id,
      };

      context.Account.set(accountObject);
    } else if (claveAddresses.has(event.params.from.toLowerCase())) {
      // subtract the balance from the existing users balance
      let accountObject: Account = {
        id: senderAccount.id,
        balance: senderAccount.balance - event.params.value,
        address: senderAccount.address.toLowerCase(),
        token_id: senderAccount.token_id,
      };

      context.Account.set(accountObject);
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
    } else if (claveAddresses.has(event.params.to.toLowerCase())) {
      // update existing account
      let accountObject: Account = {
        id: receiverAccount.id,
        balance: receiverAccount.balance + event.params.value,
        address: receiverAccount.address.toLowerCase(),
        token_id: receiverAccount.token_id,
      };

      context.Account.set(accountObject);
    }
  },
  wildcard: true,
});
