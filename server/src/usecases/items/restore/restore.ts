import { AppError } from "../../../errors.js";
import { getMyItem, updateRestoreItem } from "../../../services/items/index.js";
import { createNotification } from "../../../services/notification/notification.js";

type Params = {
    itemId: number;
    userId: number;
};

// PATCH /items/:id/restore
// summary: 商品データ復元
// page: /item/deleted/[id]
export const restoreItemUseCase = async ({ itemId, userId }: Params) => {
    // Item取得
    const item = await getMyItem({ itemId, userId });
    if (!item) {
        throw new AppError("ITEM_NOT_FOUND", 404);
    }

    // データ作成
    await updateRestoreItem({ item });

    createNotification({
        data: {
            read_user_id: userId,
            url: `/item/${itemId}`,
            message_image: item.first_image_url,
            message: `「${item.name}」を復元しました。こちらから復元した商品を確認できます。`,
            type: "ITEM",
        },
    }).catch((err) => {
        console.error("service createNotification error", err);
    });
};
