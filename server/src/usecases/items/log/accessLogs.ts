import { AppError } from "../../../errors.js";
import { addViewsCount, getItem, updateSortNumber } from "../../../services/items/index.js";
import { createWatchHistory, getWatchHistoryOne, updateUpdateAt } from "../../../services/watchHistory.js";

type Params = {
    itemId: number;
    userId: number | null;
};

// PATCH /items/:id/logs/access
// summary: アクセスログ記録
// page: /item/[id]
export const patchItemLogsAccessUseCase = async ({ itemId, userId }: Params) => {
    // Item取得
    const item = await getItem({ itemId });
    if (!item) {
        throw new AppError("ITEM_NOT_FOUND", 404);
    }

    // WatchHistory作成・更新
    if (userId) {
        const history = await getWatchHistoryOne({ itemId, userId });

        if (history) {
            await updateUpdateAt({ history });
        } else {
            await createWatchHistory({ itemId, userId });
        }
    }

    // views_count、sort_number追加
    if (item.seller_id !== userId) {
        const newViewsCount = Number(item.views_count) + 1;

        await addViewsCount({ item, data: { views_count: newViewsCount } });

        const addSort = item.recommend ? 10 : 5;
        const addBuzzSort = item.recommend ? 60 : 30;

        const newSort = Number(item.sort_number) + addSort;
        const newSortBuzz = Number(item.sort_buzz_number) + addBuzzSort;

        await updateSortNumber({
            item,
            data: {
                sort_number: newSort,
                sort_buzz_number: newSortBuzz,
            },
        });
    }
};
