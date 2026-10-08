import { Item } from "../../models/index.js";
import {
    CreateItemEditingParams,
    UpdateConfirmParams,
    UpdateItemEditingImageParams,
} from "../../types/serviceType/itemEditing.js";

export const createItemEditing = async ({ data, transaction }: CreateItemEditingParams) => {
    return await Item.create(data, { transaction });
};

export const updateConfirm = async ({ itemEditing, data, transaction }: UpdateConfirmParams) => {
    await itemEditing.update(data, { transaction });
};

export const updateItemEditingImage = async ({ itemEditing, urls, transaction }: UpdateItemEditingImageParams) => {
    itemEditing.setDataValue("image_url", urls);
    itemEditing.changed("image_url", true);
    await itemEditing.save({ transaction });
};
