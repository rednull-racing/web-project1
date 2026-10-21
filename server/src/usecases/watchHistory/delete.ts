import { destroyWatchHistory, getWatchHistoryOne } from "../../services/watchHistory/watchHistory.js";
import { AppError } from "../../errors.js";

type Params = {
    itemId: number;
    userId: number;
};

// DELETE /watch-history/:id
// summary: 閲覧履歴削除
// page: /item-list/watch-history
export const deleteWatchHistoryUseCase = async ({ itemId, userId }: Params) => {
    // watchHistory取得
    const history = await getWatchHistoryOne({ itemId, userId });

    if (!history) {
        throw new AppError("WATCH_HISTORY_NOT_FOUND", 404);
    }

    // 削除
    await destroyWatchHistory({ history });
};
