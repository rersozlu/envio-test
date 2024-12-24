import { ERC20, Account } from "generated";

ERC20.Transfer.handlerWithLoader({
  loader: async ({ event, context }) => {
    const [senderAccount, receiverAccount] = await Promise.all([
      context.Account.get(event.params.from.toString()),
      context.Account.get(event.params.to.toString()),
    ]);
    return { senderAccount, receiverAccount };
  },
  handler: async ({ event, context, loaderReturn }) => {
    const { senderAccount, receiverAccount } = loaderReturn as {
      senderAccount: Account;
      receiverAccount: Account;
    };

    if (senderAccount === undefined) {
      // create the account
      // This is likely only ever going to be the zero address in the case of the first mint
      let accountObject: Account = {
        id: event.params.from.toString() + event.srcAddress.toString(),
        balance: 0n - event.params.value,
        address: event.params.from.toString(),
      };

      context.Account.set(accountObject);
    } else {
      // subtract the balance from the existing users balance
      let accountObject: Account = {
        id: senderAccount.id,
        balance: senderAccount.balance - event.params.value,
        address: senderAccount.address.toLowerCase(),
      };
      context.Account.set(accountObject);
    }

    if (receiverAccount === undefined) {
      // create new account
      let accountObject: Account = {
        id: event.params.to.toString() + event.srcAddress.toString(),
        balance: event.params.value,
        address: event.params.to.toString().toLowerCase(),
      };
      context.Account.set(accountObject);
    } else {
      // update existing account
      let accountObject: Account = {
        id: receiverAccount.id,
        balance: receiverAccount.balance + event.params.value,
        address: receiverAccount.address.toLowerCase(),
      };

      context.Account.set(accountObject);
    }
  },
  wildcard: true,
});
