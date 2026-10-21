import type { Transaction } from "sequelize";
import { ItemEditing } from "../../models/index.js";
import type { ItemEditingUserIdParams } from "../../types/serviceType/itemEditing.js";

type GetMyItemEditingParams = ItemEditingUserIdParams & {
    transaction?: Transaction;
};

export const getMyItemEditing = ({ itemEditingId, userId, transaction }: GetMyItemEditingParams) => {
    return ItemEditing.findOne({
        where: {
            id: itemEditingId,
            seller_id: userId,
        },
        ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
};
