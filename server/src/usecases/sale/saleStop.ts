import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { getMyItemBySaleId, updatePrice } from "../../services/items/index.js";
import { getSale, updateSaleEdit } from "../../services/sale/sale.js";

type Params = {
    saleId: number;
    userId: number;
};

// PATCH /sale/:id/stop
// summary: セール終了
// page: /item
export const saleStopUseCase = async ({ saleId, userId }: Params) => {
    // sale取得
    const sale = await getSale({ saleId });

    if (!sale) throw new AppError("SALE_NOT_FOUND", 404);

    const beforePrice = sale.before_price;

    if (!beforePrice || isNaN(beforePrice)) {
        throw new AppError("BEFORE_PRICE_INVALID", 400);
    }

    // item取得
    const item = await getMyItemBySaleId({ saleId: sale.id, userId });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    // db更新
    await sequelize.transaction(async (t) => {
        // sale更新
        await updateSaleEdit({
            sale,
            data: {
                discount_rate: 0,
                discount_amount: 0,
                sale_flag: false,
            },
            transaction: t,
        });

        // item更新
        await updatePrice({
            item,
            data: {
                price: beforePrice,
            },
            transaction: t,
        });
    });
};
