import { AppError } from "../../errors.js";
import { createItemEditing } from "../../services/itemEditing/command.js";

type Params = {
    userId: number;
};

// POST /item-editing
// summary: 商品データ作成
// page: /upload/before
export const createItemEditingUseCase = async ({ userId }: Params) => {
    // itemEditing作成
    const itemEditing = await createItemEditing({
        data: {
            seller_id: userId,
        },
    });

    if (!itemEditing) {
        throw new AppError("CREATE_ITEM_EDITING_ISSUE", 400);
    }

    return itemEditing.id;
};
