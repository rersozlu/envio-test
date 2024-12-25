import { ERC20, Account } from "generated";

ERC20.Transfer.handlerWithLoader({
  loader: async ({ event, context }) => {
    const [senderAccount, receiverAccount] = await Promise.all([
      context.Account.get(event.params.from.toLowerCase() + event.srcAddress.toLowerCase()),
      context.Account.get(event.params.to.toLowerCase() + event.srcAddress.toLowerCase()),
    ]);
    return { senderAccount, receiverAccount };
  },
  handler: async ({ event, context, loaderReturn }) => {
    const { senderAccount, receiverAccount } = loaderReturn as {
      senderAccount: Account;
      receiverAccount: Account;
    };

    if (senderAccount != undefined && receiverAccount != undefined) {
      if (senderAccount.address == receiverAccount.address) {
        return;
      }
    }

    if (senderAccount === undefined) {
      // create the account
      let accountObject: Account = {
        id: event.params.from.toLowerCase() + event.srcAddress.toLowerCase(),
        balance: 0n - event.params.value,
        address: event.params.from.toLowerCase(),
        tokenAddress: event.srcAddress.toLowerCase(),
      };

      context.Account.set(accountObject);
    } else {
      // subtract the balance from the existing users balance
      let accountObject: Account = {
        id: senderAccount.id,
        balance: senderAccount.balance - event.params.value,
        address: senderAccount.address.toLowerCase(),
        tokenAddress: senderAccount.tokenAddress.toLowerCase(),
      };
      context.Account.set(accountObject);
    }

    if (receiverAccount === undefined) {
      // create new account
      let accountObject: Account = {
        id: event.params.to.toLowerCase() + event.srcAddress.toLowerCase(),
        balance: event.params.value,
        address: event.params.to.toLowerCase(),
        tokenAddress: event.srcAddress.toLowerCase(),
      };
      context.Account.set(accountObject);
    } else {
      // update existing account
      let accountObject: Account = {
        id: receiverAccount.id,
        balance: receiverAccount.balance + event.params.value,
        address: receiverAccount.address.toLowerCase(),
        tokenAddress: receiverAccount.tokenAddress.toLowerCase(),
      };

      context.Account.set(accountObject);
    }
  },
  wildcard: true,
});
