import { AppError } from "../../../errors.js";

type Params = {
    itemId: number;
    userId: number;
};

// DELETE /items/:id/logical
// summary: 商品削除（停止中）
// page: /item/[id]
export const deleteItemLogicallyUseCase: (params: Params) => Promise<void> = async () => {
    // item_trashへの移行が完了するまで、旧処理による商品変更を停止する。
    throw new AppError("ITEM_ARCHIVE_UNAVAILABLE", 503, "商品の削除は現在ご利用いただけません。時間をおいてもう一度お試しください。");
};
