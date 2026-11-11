import { AppError } from "../../../errors.js";
import { normalizeJapanese } from "../../../utils/normalizeJapanese.js";
import type { UserItemsListQuery } from "../../../validators/query/userItems.js";
import { getUserItemsCartsUseCase } from "./userItems/getCarts.js";

type Params = UserItemsListQuery & {
    userId: number;
};

type Result = Awaited<ReturnType<typeof getUserItemsCartsUseCase>>;

// /users/me/items?type="typename"(&page=number&status=""&keyword="search")
// summary: ユーザー関連各種商品リスト取得
// page: /item-list/...
export const getUserItemsUseCase = async ({ userId, type, page, keyword: rawKeyword }: Params): Promise<Result> => {
    const keyword = rawKeyword ? normalizeJapanese(rawKeyword) : undefined;
    const baseParams = { page, userId, keyword };

    switch (type) {
        case "cart":
            return await getUserItemsCartsUseCase(baseParams);
        default:
            throw new AppError("INVALID_TYPE", 400);
    }
};
