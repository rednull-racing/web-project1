import { AppError } from "../../errors.js";
import { getMyItemDraftPageMetadata } from "../../services/itemDraft/query.js";

type Params = {
    itemDraftId: number;
    userId: number;
};

type Result = {
    id: number;
    name: string | null;
};

// GET /item-draft/:id/metadata
// summary: 下書き商品ページ メタデータ取得
// page: /item/draft/[id]
export const getItemDraftPageMetadataUseCase = async ({ itemDraftId, userId }: Params): Promise<Result> => {
    const itemDraft = await getMyItemDraftPageMetadata({ itemDraftId, userId });
    if (!itemDraft) {
        throw new AppError("ITEM_DRAFT_NOT_FOUND", 404);
    }
    return { id: itemDraft.id, name: itemDraft.name };
};
