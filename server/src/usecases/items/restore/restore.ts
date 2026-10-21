import { AppError } from "../../../errors.js";

type Params = {
    itemId: number;
    userId: number;
};

// PATCH /items/:id/restore
// summary: 商品復元（停止中）
// page: /item/deleted/[id]
export const restoreItemUseCase: (params: Params) => Promise<void> = async () => {
    // item_trashへの移行が完了するまで、旧処理による商品変更を停止する。
    throw new AppError(
        "ITEM_ARCHIVE_UNAVAILABLE",
        503,
        "商品の復元は現在ご利用いただけません。時間をおいてもう一度お試しください。",
    );
};
