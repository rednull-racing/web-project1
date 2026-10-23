import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import { ItemEditing } from "../../models/index.js";
import type { CreateItemEditingCopyParams, CreateItemEditingDraftParams } from "../../types/serviceType/itemEditing.js";
import type {
    CreateItemEditingParams,
    ItemEditingTransactionParams,
    UpdateConfirmParams,
    UpdateItemEditingImageParams,
    UpdateItemEditingVideoParams,
} from "../../types/serviceType/itemEditing.js";

type DestroyExpiredItemEditingsParams = {
    createdBefore: Date;
    transaction: Transaction;
};

export const destroyExpiredItemEditings = ({
    createdBefore,
    transaction,
}: DestroyExpiredItemEditingsParams): Promise<number> => {
    return ItemEditing.destroy({
        where: { createdAt: { [Op.lte]: createdBefore } },
        transaction,
    });
};

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

export const updateItemEditingVideo = async ({
    itemEditing,
    data,
    transaction,
}: UpdateItemEditingVideoParams): Promise<void> => {
    await itemEditing.update(data, { transaction });
};

export const createItemEditingDraft = ({ data, transaction }: CreateItemEditingDraftParams) => {
    return ItemEditing.create(data, { transaction });
};

export const createItemEditingCopy = ({ data, transaction }: CreateItemEditingCopyParams) => {
    return ItemEditing.create(data, { transaction });
};

export const deleteItemEditing = async ({ itemEditing, transaction }: ItemEditingTransactionParams): Promise<void> => {
    await itemEditing.destroy({ transaction });
};
