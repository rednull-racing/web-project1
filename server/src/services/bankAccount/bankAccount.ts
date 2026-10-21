import { BankAccount, User } from "../../models/index.js";
import {
    AccountIdParams,
    AccountUserIdParams,
    BankTransactionParams,
    CreateBankAllowNullParams,
    CreateBankParams,
    TransactionParams,
    updateBankParams,
} from "../../types/serviceType/bankAccount.js";

export const getBankAccount = ({ accountId }: AccountIdParams) => {
    return BankAccount.findByPk(accountId);
};

export const getMyBankAccount = ({ accountId, userId }: AccountUserIdParams) => {
    return BankAccount.findOne({
        where: { id: accountId },
        include: [
            {
                model: User,
                where: { id: userId },
                attributes: [],
                required: true,
            },
        ],
    });
};

export const createBankAccountFirst = async ({ transaction }: TransactionParams) => {
    return BankAccount.create({ transaction });
};

export const createBankAccount = async ({ data, transaction }: CreateBankParams) => {
    return BankAccount.create(data, { transaction });
};

export const createBankAccountAllowNull = async ({ data, transaction }: CreateBankAllowNullParams) => {
    return BankAccount.create(data, { transaction });
};

export const updateBankAccount = async ({ account, data, transaction }: updateBankParams) => {
    await account.update(data, { transaction });
};

export const deleteBankAccount = async ({ account, transaction }: BankTransactionParams) => {
    await account.destroy({ transaction });
};
