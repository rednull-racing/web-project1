import { Item } from "../../models/index.js";
import { CreateItemEditingParams } from "../../types/serviceType/itemEditing.js";

export const createItemEditing = async ({ data, transaction }: CreateItemEditingParams) => {
    return await Item.create(data, { transaction });
};
