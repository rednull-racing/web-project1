import sequelize from "../../../db.js";
import type { Item } from "../../../models/index.js";
import { bulkCreateItemDeleteLogs } from "../../../services/itemDeleteLogs.js";
import { destroyPerfectItem, getCronPerfectDeleteItems } from "../../../services/items/index.js";

// 論理削除後30日経過item削除、ItemDeleteLogs作成
export const cronPerfectDeleteUseCase = async (): Promise<number> => {
    const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const items = await getCronPerfectDeleteItems({ deletedBefore: thirtyDaysAgo });

    if (items.length === 0) {
        return 0;
    }

    const itemDeleteLogs = items.map((item: InstanceType<typeof Item>) => ({
        item_id: item.id,
        delete_user_id: Number(item.seller_id),
        delete_by_admin: false,
        delete_reason: "自主削除、30日経過",
    }));

    await sequelize.transaction(async (transaction) => {
        await Promise.all(items.map((item: InstanceType<typeof Item>) => destroyPerfectItem({ item, transaction })));
        await bulkCreateItemDeleteLogs({ data: itemDeleteLogs, transaction });
    });

    return items.length;
};
