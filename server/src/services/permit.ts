import { Permit } from "../models/index.js";
import { CreatePermitParams, PermitTransactionParams } from "../types/serviceType/permit.js";

export const createPermit = async ({ data, transaction }: CreatePermitParams) => {
    return Permit.create(data, { transaction });
};

export const deletePermit = async ({ permit, transaction }: PermitTransactionParams) => {
    await permit.destroy({ transaction });
};
