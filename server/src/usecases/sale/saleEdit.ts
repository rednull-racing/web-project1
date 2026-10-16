import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { getMyItemBySaleId, updatePrice } from "../../services/items/index.js";
import { getSale, updateSaleEdit } from "../../services/sale/sale.js";

type Body = {
    discountRate: number;
    discountAmount: number;
    finalPrice: number;
};

type Params = {
    saleId: number;
    userId: number;
    body: Body;
};

// PATCH /sale/:id/edit
// summary: セール開始
// page: /item
export const saleEditUseCase = async ({ saleId, userId, body }: Params) => {
    const { discountRate, discountAmount, finalPrice } = body;

    // bodyバリデーション
    if (discountRate > 0 && discountAmount > 0) {
        throw new AppError("INVALID_BODY_DISCOUNT_BOTH", 400);
    }
    if ((!discountRate || discountRate === 0) && (!discountAmount || discountAmount === 0)) {
        throw new AppError("INVALID_BODY_DISCOUNT_EMPTY", 400);
    }

    // sale取得
    const sale = await getSale({ saleId });

    if (!sale) throw new AppError("SALE_NOT_FOUND", 404);

    // item取得
    const item = await getMyItemBySaleId({ saleId: sale.id, userId });

    if (!item) throw new AppError("ITEM_NOT_FOUND", 404);

    // db更新
    await sequelize.transaction(async (t) => {
        // sale更新
        await updateSaleEdit({
            sale,
            data: {
                discount_rate: discountRate,
                discount_amount: discountAmount,
                sale_flag: true,
            },
            transaction: t,
        });

        // item更新
        await updatePrice({
            item,
            data: {
                price: finalPrice,
            },
            transaction: t,
        });
    });
};
