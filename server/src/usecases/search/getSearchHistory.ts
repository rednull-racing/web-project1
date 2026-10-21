import { getSearchHistoryAll } from "../../services/search/search.js";

type Params = {
    userId: number;
};

// GET /search/history
// summary: 検索履歴取得
// page: header
export const getSearchHistoryUseCase = async ({ userId }: Params) => {
    // search取得
    const searchHistory = await getSearchHistoryAll({ userId });

    // 並べ替え
    const sortedData = searchHistory.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return sortedData;
};
