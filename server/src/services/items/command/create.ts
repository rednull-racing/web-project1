import { Item } from "../../../models/index.js";
import type { CreateItemParams } from "../../../types/serviceType/items.js";

export const createItem = async ({ data, transaction }: CreateItemParams): Promise<number> => {
    const item = await Item.create(data, { transaction });
    return item.id;
};
