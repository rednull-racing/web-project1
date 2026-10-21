import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { deleteItemDraft } from "../../services/itemDraft/command.js";
import { getMyItemDraft } from "../../services/itemDraft/query.js";

type Params = {
    itemDraftId: number;
    userId: number;
};

// DELETE /item-draft/:id
// summary: 下書き商品削除
// page: /item/draft/[id]
export const deleteItemDraftUseCase = async ({ itemDraftId, userId }: Params): Promise<void> => {
    await sequelize.transaction(async (transaction) => {
        const itemDraft = await getMyItemDraft({ itemDraftId, userId, transaction });
        if (!itemDraft) {
            throw new AppError("ITEM_DRAFT_NOT_FOUND", 404);
        }

        await deleteItemDraft({ itemDraft, transaction });
    });
};
