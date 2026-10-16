import sequelize from "../../db.js";
import { deleteCron } from "../../services/purchaseSession/purchaseSession.js";

// 期限切れpurchaseSession削除
export const purchaseSessionCronDeleteUseCase = async () => {
    const now = new Date();

    const deletedCount = await sequelize.transaction(async (t) => {
        return deleteCron({ now, transaction: t });
    });

    return deletedCount;
};
