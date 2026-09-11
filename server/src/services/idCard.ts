import { IdCard } from "../models/index.js";
import {
    CreateIdFirstParams,
    CreateIdParams,
    IdCardTransactionParams,
    UpdateIdParams,
} from "../types/serviceType/idCard.js";

type UpdateIdCardS3MetadataParams = IdCardTransactionParams & {
    data: CreateIdParams["data"];
};

export const updateIdCardS3Metadata = async ({
    idCard,
    data,
    transaction,
}: UpdateIdCardS3MetadataParams): Promise<void> => {
    await idCard.update(data, { transaction });
};

export const createIdCardFirst = async ({ transaction }: CreateIdFirstParams) => {
    return IdCard.create({ transaction });
};

export const createIdCard = async ({ data, transaction }: CreateIdParams) => {
    return IdCard.create(data, { transaction });
};

export const updateIdCard = async ({ idCard, data, transaction }: UpdateIdParams) => {
    await idCard.update(data, { transaction });
};

export const deleteIdCard = async ({ idCard, transaction }: IdCardTransactionParams) => {
    await idCard.destroy({ transaction });
};
