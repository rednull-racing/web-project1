import { ReferenceCode } from "../../models/index.js";
import {
    CreateInputParams,
    CreateOutputParams,
    DeleteReferenceCodeUserIdTransactionParams,
    UserIdParams,
} from "../../types/serviceType/referenceCode.js";

export const createInputCode = async ({ data }: CreateInputParams) => {
    await ReferenceCode.create(data);
};

export const createOutputCode = async ({ data }: CreateOutputParams) => {
    await ReferenceCode.create(data);
};

export const countReferenceOutput = ({ userId }: UserIdParams) => {
    return ReferenceCode.count({
        where: {
            output_user_id: userId,
            checked: true,
        },
    });
};

export const deleteInputCodeUserLogical = async ({
    userId,
    transaction,
}: DeleteReferenceCodeUserIdTransactionParams) => {
    await ReferenceCode.destroy({
        where: { input_user_id: userId },
        transaction,
    });
};

export const deleteOutputCodeUserLogical = async ({
    userId,
    transaction,
}: DeleteReferenceCodeUserIdTransactionParams) => {
    await ReferenceCode.destroy({
        where: { output_user_id: userId },
        transaction,
    });
};
