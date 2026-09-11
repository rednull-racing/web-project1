import { Permit } from "../models/index.js";
import { CreatePermitParams, PermitTransactionParams } from "../types/serviceType/permit.js";

type UpdatePermitParams = PermitTransactionParams & {
    data: { s3_metadata_id: number; sort_order: number };
};

export const updatePermit = async ({ permit, data, transaction }: UpdatePermitParams): Promise<void> => {
    await permit.update(data, { transaction });
};

export const createPermit = async ({ data, transaction }: CreatePermitParams) => {
    return Permit.create(data, { transaction });
};

export const deletePermit = async ({ permit, transaction }: PermitTransactionParams) => {
    await permit.destroy({ transaction });
};
