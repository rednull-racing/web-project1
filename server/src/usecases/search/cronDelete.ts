import { deleteCronSearch } from "../../services/search/search.js";

// 180日経過search削除
export const searchCronDeleteUseCase = () => {
    const halfYearsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 180);

    return deleteCronSearch({ createdBefore: halfYearsAgo });
};
