import { AppError } from "../../errors.js";
import { getMyItemConfirmPageMetadata } from "../../services/itemEditing/query.js";

type Params = {
    itemEditingId: number;
    userId: number;
};

type Result = {
    id: number;
    name: string | null;
};

// GET /item-editing/:id/metadata
// summary: 編集セッション確認 メタデータ取得
// page: /item/confirm/[id]・/item/confirm/edit/[id]
export const getItemConfirmPageMetadataUseCase = async ({ itemEditingId, userId }: Params): Promise<Result> => {
    const itemEditing = await getMyItemConfirmPageMetadata({ itemEditingId, userId });
    if (!itemEditing) {
        throw new AppError("ITEM_EDITING_NOT_FOUND", 404);
    }
    return { id: itemEditing.id, name: itemEditing.name };
};
