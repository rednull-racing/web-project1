import type { ItemTransactionParams } from "../../../types/serviceType/items.js";

export const deleteItem = async ({ item, transaction }: ItemTransactionParams) => {
    await item.destroy({ transaction });
};
