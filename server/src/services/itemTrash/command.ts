import { ItemTrash } from "../../models/index.js";
import type { CreateItemTrashParams } from "../../types/serviceType/itemTrash.js";

export const createItemTrash = ({
    data,
    transaction,
}: CreateItemTrashParams): Promise<InstanceType<typeof ItemTrash>> => {
    return ItemTrash.create(data, { transaction });
};
