import { Item } from "../../../models/index.js";
import { UserIdTransactionParams } from "../../../types/serviceType/items.js";

export const createItem = async ({ userId, transaction }: UserIdTransactionParams) => {
    const item = await Item.create(
        {
            seller_id: userId,
        },
        { transaction },
    );

    return item.id;
};
