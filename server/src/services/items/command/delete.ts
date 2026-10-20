import { Op } from "sequelize";
import { Item } from "../../../models/index.js";
import type {
    CronEditingDeleteParams,
    ItemDataParams,
    ItemTransactionParams,
} from "../../../types/serviceType/items.js";

export const destroyDraftItem = async ({ item }: ItemDataParams) => {
    await item.destroy();
};

export const destroyPerfectItem = async ({ item, transaction }: ItemTransactionParams) => {
    await item.destroy({ transaction });
};

export const destroyCronEditingItems = ({ createdBefore }: CronEditingDeleteParams) => {
    return Item.destroy({
        where: {
            createdAt: { [Op.lt]: createdBefore },
        },
    });
};
