import { AppError } from "../../../errors.js";
import { countFollower } from "../../../services/follow/follow.js";
import { countSellItem, getMyItemWithVideoCategoriesUser, updatePublishItem } from "../../../services/items/index.js";
import { createNotification } from "../../../services/notification/notification.js";
import { normalizeJapanese } from "../../../utils/normalizeJapanese.js";

type Params = {
    itemId: number;
    userId: number;
};

// PATCH /items/:id/publish
// summary: 商品公開
// page: /item/confirm/[id]
export const patchPublishUseCase = async ({ itemId, userId }: Params) => {
    // item取得
    const item = await getMyItemWithVideoCategoriesUser({ itemId, userId });
    if (!item) {
        throw new AppError("ITEM_NOT_FOUND", 404);
    }

    // sort_number
    const followerCount = await countFollower({ userId });

    const sellItemCount = await countSellItem({ userId });

    let sort =
        Number(item.price) / 10 +
        (item.detail?.length ?? 0) +
        (item.Video?.summary?.length ?? 0) +
        (item.User?.user_introduction?.length ?? 0) +
        followerCount * 10 +
        sellItemCount * 10;

    if (Number(item.User?.penalty_points) <= 5) {
        sort = sort + 5000;
    }

    // search_text
    const searchText = `
    ${item.name}
    ${item.Video?.title ?? ""}
    ${item.Category?.name ?? ""}
    ${item.Category?.parent?.name ?? ""}
    ${item.User?.user_name ?? ""}
    `;

    const normalizeSearchText = normalizeJapanese(searchText ?? "");

    // データ更新
    await updatePublishItem({
        item,
        data: {
            sort_number: sort,
            sort_buzz_number: sort,
            search_text: normalizeSearchText,
        },
    });

    createNotification({
        data: {
            read_user_id: userId,
            url: `/item/${itemId}`,
            message_image: item.first_image_url,
            message: `商品「${item.name}」を出品いただき誠にありがとうございます。商品の詳細はこちらの商品ページからご確認ください。`,
            type: "ITEM",
        },
    }).catch((err) => {
        console.error("service createNotification error", err);
    });
};
