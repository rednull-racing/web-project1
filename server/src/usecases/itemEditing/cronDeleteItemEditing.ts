import sequelize from "../../db.js";
import { destroyExpiredItemEditings } from "../../services/itemEditing/command.js";

// cron 3日経過ItemEditing削除
export const cronDeleteItemEditingUseCase = async (): Promise<number> => {
    const createdBefore = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    return await sequelize.transaction(async (transaction) => {
        return await destroyExpiredItemEditings({ createdBefore, transaction });
    });
};
