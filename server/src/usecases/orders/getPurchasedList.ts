import { Op } from "sequelize";
import { getPurchasedOrders } from "../../services/orders.js";
import type { OrderWhere } from "../../types/serviceType/orders.js";

type Params = {
    page: number;
    userId: number;
    status?: string;
};

// /orders?type="purchased"&page=number&status=""
// summary: 購入履歴取得
// page: /order/list/purchased
export const getPurchasedListUseCase = async ({ page, userId, status }: Params) => {
    const limit = 20;
    const offset = (page - 1) * limit;

    const where: OrderWhere = {
        buyer_user_id: userId,
    };

    if (status && ["paid", "shipped", "completed"].includes(status)) {
        where.status = status;
    } else {
        where.status = { [Op.ne]: "pending" };
    }

    return await getPurchasedOrders({ where, limit, offset });
};
