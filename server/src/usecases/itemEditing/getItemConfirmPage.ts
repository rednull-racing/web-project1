import { AppError } from "../../errors.js";
import type { ItemEditing } from "../../models/item_editing.js";
import { getMyItemConfirmPage } from "../../services/itemEditing/query.js";

type Params = { itemEditingId: number; userId: number };

// GET /item-editing/:id/confirm
// summary: 編集セッション確認ページ データ取得
// page: /item/confirm/[id]・/item/confirm/edit/[id]
export const getItemConfirmPageUseCase = async ({ itemEditingId, userId }: Params): Promise<ItemEditing> => {
    const itemEditing = await getMyItemConfirmPage({ itemEditingId, userId });
    if (!itemEditing) throw new AppError("ITEM_EDITING_NOT_FOUND", 404);
    return itemEditing;
};
