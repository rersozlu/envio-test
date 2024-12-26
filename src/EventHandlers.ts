import { ERC20, Account, Token } from "generated";
import { getOrCreateToken } from "./viem/Contract";

ERC20.Transfer.handlerWithLoader({
  loader: async ({ event, context }) => {
    const [senderAccount, receiverAccount, token] = await Promise.all([
      context.Account.get(event.params.from.toLowerCase() + event.srcAddress.toLowerCase()),
      context.Account.get(event.params.to.toLowerCase() + event.srcAddress.toLowerCase()),
      context.Token.get(event.srcAddress.toLowerCase()),
    ]);
    return { senderAccount, receiverAccount, token };
  },
  handler: async ({ event, context, loaderReturn }) => {
    const { senderAccount, receiverAccount, token } = loaderReturn as {
      senderAccount: Account;
      receiverAccount: Account;
      token: Token;
    };

    if (senderAccount != undefined && receiverAccount != undefined) {
      if (senderAccount.address == receiverAccount.address) {
        return;
      }
    }

    const generatedToken = await getOrCreateToken(event.srcAddress.toLowerCase(), token, context);

    if (senderAccount === undefined) {
      // create the account
      let accountObject: Account = {
        id: event.params.from.toLowerCase() + generatedToken.id,
        balance: 0n - event.params.value,
        address: event.params.from.toLowerCase(),
        token_id: generatedToken.id,
      };

      context.Account.set(accountObject);
    } else {
      // subtract the balance from the existing users balance
      let accountObject: Account = {
        id: senderAccount.id,
        balance: senderAccount.balance - event.params.value,
        address: senderAccount.address.toLowerCase(),
        token_id: senderAccount.token_id,
      };
      context.Account.set(accountObject);
    }

    if (receiverAccount === undefined) {
      // create new account
      let accountObject: Account = {
        id: event.params.to.toLowerCase() + generatedToken.id,
        balance: event.params.value,
        address: event.params.to.toLowerCase(),
        token_id: generatedToken.id,
      };
      context.Account.set(accountObject);
    } else {
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
