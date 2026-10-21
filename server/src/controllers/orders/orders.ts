import type { NextFunction, Request, Response } from "express-serve-static-core";
import { getPurchasedListUseCase } from "../../usecases/orders/getPurchasedList.js";
import { getSoldListUseCase } from "../../usecases/orders/getSoldList.js";
import { OrderListQuery } from "../../validators/query/orders.js";

// /orders?type="purchased"&page=number&status=""
// summary: 購入・販売履歴取得
// page: type=purchased: /order/list/purchased
// page: type=sold: /order/list/sold
export const ordersGetRootController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const query = req.validatedQuery as OrderListQuery;
        const { type, page, status } = query;

        const params = { page, userId, status };

        const usecase = type === "purchased" ? () => getPurchasedListUseCase(params) : () => getSoldListUseCase(params);

        const { ordersList, totalPages } = await usecase();

        res.status(200).json({ ordersList, totalPages });
    } catch (err) {
        next(err);
    }
};
