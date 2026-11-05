import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { getMyItemForTrash } from "../../services/itemTrash/query.js";
import { createItemTrash } from "../../services/itemTrash/command.js";
import { detachItemReports } from "../../services/itemReport/itemReport.js";
import { deleteVideo } from "../../services/video/video.js";
import { deleteSale } from "../../services/sale/sale.js";
import { deleteShipping } from "../../services/itemShippingProfile/itemShippingProfile.js";
import { deleteItem } from "../../services/items/index.js";
import { createNotification } from "../../services/notification/notification.js";

type Params = { itemId: number; userId: number };

// POST /item-trash
// summary: 論理削除商品作成
// page: /item/[id]
export const createItemTrashUseCase = async ({ itemId, userId }: Params): Promise<void> => {
    const trash = await sequelize.transaction(async (transaction) => {
        const source = await getMyItemForTrash({ itemId, userId, transaction });
        if (!source) throw new AppError("ITEM_NOT_FOUND", 404, "商品が見つかりません。");
        const { item, video, sale, shipping } = source;
        const trash = await createItemTrash({
            data: {
                item_id: item.id,
                name: item.name,
                detail: item.detail,
                image_url: item.image_url,
                first_image_url: item.first_image_url,
                item_condition_id: item.item_condition_id,
                seller_id: item.seller_id,
                gender_type: item.gender_type,
                age_type: item.age_type,
                recommend: item.recommend,
                category_id: item.category_id,
                brand_id: item.brand_id,
                brand_aliases_id: item.brand_aliases_id,
                attributes: item.attributes,
                price: sale?.before_price ?? null,
                title: video?.title ?? null,
                summary: video?.summary ?? null,
                thumbnail_url: video?.thumbnail_url ?? null,
                duration: video?.duration ?? null,
                original_url: video?.original_url ?? null,
                converted_url: video?.converted_url ?? null,
                video_status: video?.status ?? null,
                shipping_day_id: shipping?.shipping_day_id ?? null,
                shipping_service_id: shipping?.shipping_service_id ?? null,
                shipping_place_id: shipping?.shipping_place_id ?? null,
                shipping_service_free_text: shipping?.shipping_service_free_text ?? null,
            },
            transaction,
        });
        await detachItemReports({ itemId, transaction });
        if (video) await deleteVideo({ video, transaction });
        if (sale) await deleteSale({ sale, transaction });
        if (shipping) await deleteShipping({ shipping, transaction });
        await deleteItem({ item, transaction });
        return trash;
    });
    // 通知は削除の成立条件に含めず、コミット済みの退避先だけを案内する。
    createNotification({
        data: {
            read_user_id: userId,
            url: `/item/deleted/${trash.id}`,
            message_image: trash.first_image_url,
            message: `商品「${trash.name}」が削除されました。削除された商品の詳細はこちらのページからご確認ください。なお、復元される場合は削除日から30日以内に行ってください。`,
            type: "ITEM",
        },
    }).catch((error: unknown) => {
        console.error("service createNotification error", error);
    });
};
