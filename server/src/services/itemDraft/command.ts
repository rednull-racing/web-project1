import type { ItemDraftTransactionParams } from "../../types/serviceType/itemDraft.js";
import { ItemDraft } from "../../models/index.js";
import { CreateItemDraftParams, UpdateItemDraftImageParams } from "../../types/serviceType/itemDraft.js";

export const CreateItemDraft = async ({ data, transaction }: CreateItemDraftParams) => {
    return await ItemDraft.create(data, { transaction });
};

export const updateItemDraftImage = async ({ itemDraft, urls, transaction }: UpdateItemDraftImageParams) => {
    itemDraft.setDataValue("image_url", urls);
    itemDraft.changed("image_url", true);
    await itemDraft.save({ transaction });
};

export const deleteItemDraft = async ({ itemDraft, transaction }: ItemDraftTransactionParams): Promise<void> => {
    await itemDraft.destroy({ transaction });
};
