import { Op } from "sequelize";
import { getSoldOrders } from "../../services/orders/orders.js";
import type { OrderWhere } from "../../types/serviceType/orders.js";

type Params = {
    page: number;
    userId: number;
    status?: string;
};

// /orders?type="sold"&page=number&status=""
// summary: 販売履歴取得
// page: /order/list/sold
export const getSoldListUseCase = async ({ page, userId, status }: Params) => {
    const limit = 20;
    const offset = (page - 1) * limit;

    const where: OrderWhere = {
        seller_user_id: userId,
    };

    if (status && ["paid", "shipped", "completed"].includes(status)) {
        where.status = status;
    } else {
        where.status = { [Op.ne]: "pending" };
    }

    return await getSoldOrders({ where, limit, offset });
};
