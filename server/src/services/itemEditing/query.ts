import { ItemEditing } from "../../models/index.js";
import { ItemEditingUserIdParams } from "../../types/serviceType/itemEditing.js";

export const getMyItemEditing = ({ itemEditingId, userId }: ItemEditingUserIdParams) => {
    return ItemEditing.findOne({
        where: {
            id: itemEditingId,
            seller_id: userId,
        },
    });
};
