import { Transaction } from "sequelize";
import { UserDeleteLogs } from "../../models/index.js";

type CreateUserDeleteLogParams = {
    data: {
        user_id: number;
        delete_reason: string;
        deleted_by_admin: boolean;
        admin_id: number | null;
    };
    transaction?: Transaction;
};

export const createUserDeleteLogs = async ({ data, transaction }: CreateUserDeleteLogParams) => {
    await UserDeleteLogs.create(data, { transaction });
};
