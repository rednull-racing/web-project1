import { Op } from "sequelize";
import { Item } from "../../../models/index.js";
import type {
    CronEditingDeleteParams,
    ItemDataParams,
    ItemTransactionParams,
    LogicalDeleteParams,
} from "../../../types/serviceType/items.js";

export const updateLogicalDeleteItem = async ({ item, data, transaction }: LogicalDeleteParams) => {
    const nowDate = new Date();

    await item.update(
        {
            uploaded_at: null,
            sort_number: 0,
            sort_buzz_number: 0,
            deleted_at: nowDate,
            ...data,
        },
        { transaction },
    );
};

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
