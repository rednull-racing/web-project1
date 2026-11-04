import { AppError } from "../../errors.js";
import type { ItemEditing } from "../../models/item_editing.js";
import { getMyItemEditingForm } from "../../services/itemEditing/query.js";

type Params = { itemEditingId: number; userId: number };

// GET /item-editing/:id/form
// summary: 商品アップロード入力フォーム初期値取得
// page: /upload/[id]・/upload/edit/[id]
export const getItemEditingFormUseCase = async ({ itemEditingId, userId }: Params): Promise<ItemEditing> => {
    const itemEditing = await getMyItemEditingForm({ itemEditingId, userId });
    if (!itemEditing) throw new AppError("ITEM_EDITING_NOT_FOUND", 404);
    return itemEditing;
};
