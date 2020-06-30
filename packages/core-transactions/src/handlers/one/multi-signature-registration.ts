import { Models } from "@arkecosystem/core-database";
import { Container, Contracts } from "@arkecosystem/core-kernel";
import { Interfaces, Transactions, Utils } from "@arkecosystem/crypto";

import { LegacyMultiSignatureError, MultiSignatureAlreadyRegisteredError } from "../../errors";
import { TransactionReader } from "../../transaction-reader";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

// todo: revisit the implementation, container usage and arguments after core-database rework
// todo: replace unnecessary function arguments with dependency injection to avoid passing around references
@Container.injectable()
export class MultiSignatureRegistrationTransactionHandler extends TransactionHandler {
    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["multiSignature"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.One.MultiSignatureRegistrationTransaction;
    }

    public async bootstrap(): Promise<void> {
        const reader: TransactionReader = this.getTransactionReader();
        const transactions: Models.Transaction[] = await reader.read();
        for (const transaction of transactions) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);
            const multiSignature: Contracts.State.WalletMultiSignatureAttributes =
                transaction.asset.multiSignature || transaction.asset.multiSignatureLegacy;
            multiSignature.legacy = true;

            if (wallet.hasMultiSignature()) {
                throw new MultiSignatureAlreadyRegisteredError();
            }

            wallet.setAttribute("multiSignature", multiSignature);
            this.walletRepository.index(wallet);
        }
    }

    public async isActivated(): Promise<boolean> {
        return false;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        const { data }: Interfaces.ITransaction = transaction;

        if (Utils.isException(data.id)) {
            return;
        }

        throw new LegacyMultiSignatureError();
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        throw new Contracts.TransactionPool.PoolError(`Deprecated multi-signature registration`, "ERR_DEPRECATED");
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}