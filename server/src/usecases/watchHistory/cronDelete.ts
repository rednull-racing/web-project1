import { deleteCronWatchHistory } from "../../services/watchHistory/watchHistory.js";

// 90日経過WatchHistory削除
export const watchHistoryCronDeleteUseCase = () => {
    const ninetyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);

    return deleteCronWatchHistory({ updatedBefore: ninetyDaysAgo });
};
