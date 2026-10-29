import { AppError } from "../../errors.js";
import { getMyItemDraftPage } from "../../services/itemDraft/query.js";
import type { ItemDraft } from "../../models/index.js";

type Params = {
    itemDraftId: number;
    userId: number;
};

// GET /item-draft/:id/item-page
// summary: 下書き商品ページ データ取得
// page: /item/draft/[id]
export const getItemDraftPageUseCase = async ({ itemDraftId, userId }: Params): Promise<InstanceType<typeof ItemDraft>> => {
    const itemDraft = await getMyItemDraftPage({ itemDraftId, userId });
    if (!itemDraft) {
        throw new AppError("ITEM_DRAFT_NOT_FOUND", 404);
    }
    return itemDraft;
};
