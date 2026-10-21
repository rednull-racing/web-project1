import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { deleteItemDraft } from "../../services/itemDraft/command.js";
import { getMyItemDraft } from "../../services/itemDraft/query.js";
import { createItemEditingDraft } from "../../services/itemEditing/command.js";

type Params = {
    userId: number;
    itemDraftId: number;
};

// POST /item-editing/draft
// summary: 下書きから商品編集セッション作成
// page: /item/draft/[id]
export const createItemEditingDraftUseCase = async ({ userId, itemDraftId }: Params): Promise<number> => {
    return await sequelize.transaction(async (transaction) => {
        const itemDraft = await getMyItemDraft({ itemDraftId, userId, transaction });
        if (!itemDraft) {
            throw new AppError("ITEM_DRAFT_NOT_FOUND", 404);
        }

        const itemEditing = await createItemEditingDraft({
            data: {
                seller_id: userId,
                name: itemDraft.name,
                detail: itemDraft.detail,
                image_url: itemDraft.image_url,
                price: itemDraft.price,
                item_condition_id: itemDraft.item_condition_id,
                first_image_url: itemDraft.first_image_url,
                gender_type: itemDraft.gender_type,
                age_type: itemDraft.age_type,
                recommend: itemDraft.recommend,
                category_id: itemDraft.category_id,
                brand_id: itemDraft.brand_id,
                brand_aliases_id: itemDraft.brand_aliases_id,
                attributes: itemDraft.attributes,
                thumbnail_url: itemDraft.thumbnail_url,
                title: itemDraft.title,
                summary: itemDraft.summary,
                duration: itemDraft.duration,
                original_url: itemDraft.original_url,
                converted_url: itemDraft.converted_url,
                video_status: itemDraft.video_status,
                before_price: itemDraft.before_price,
                discount_rate: itemDraft.discount_rate,
                discount_amount: itemDraft.discount_amount,
                sale_flag: itemDraft.sale_flag,
                shipping_day_id: itemDraft.shipping_day_id,
                shipping_service_id: itemDraft.shipping_service_id,
                shipping_place_id: itemDraft.shipping_place_id,
                shipping_service_free_text: itemDraft.shipping_service_free_text,
            },
            transaction,
        });

        await deleteItemDraft({ itemDraft, transaction });
        return itemEditing.id;
    });
};
