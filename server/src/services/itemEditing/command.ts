import { ItemEditing } from "../../models/index.js";
import type { CreateItemEditingCopyParams, CreateItemEditingDraftParams } from "../../types/serviceType/itemEditing.js";
import type {
    CreateItemEditingParams,
    UpdateConfirmParams,
    UpdateItemEditingImageParams,
} from "../../types/serviceType/itemEditing.js";

export const createItemEditing = ({ data, transaction }: CreateItemEditingParams) => {
    return ItemEditing.create(data, { transaction });
};

export const updateConfirm = async ({ itemEditing, data, transaction }: UpdateConfirmParams) => {
    await itemEditing.update(data, { transaction });
};

export const updateItemEditingImage = async ({ itemEditing, urls, transaction }: UpdateItemEditingImageParams) => {
    itemEditing.setDataValue("image_url", urls);
    itemEditing.changed("image_url", true);
    await itemEditing.save({ transaction });
};

export const createItemEditingDraft = ({ data, transaction }: CreateItemEditingDraftParams) => {
    return ItemEditing.create(data, { transaction });
};

export const createItemEditingCopy = ({ data, transaction }: CreateItemEditingCopyParams) => {
    return ItemEditing.create(data, { transaction });
};
