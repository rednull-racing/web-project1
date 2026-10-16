import { AppError } from "../../errors.js";
import { createCart, getCartOne } from "../../services/cart/cart.js";
import { patchSortNumberAddUseCase } from "../items/sortNumber/sortNumber.js";

type Params = {
    itemId: number;
    userId: number;
};

// POST /cart/:id
// summary: カート追加
// page: /item
export const addCartUseCase = async ({ itemId, userId }: Params) => {
    // cart取得
    const cart = await getCartOne({ itemId, userId });

    if (cart) {
        throw new AppError("INVALID_ADD_CART", 409);
    }

    // cart作成
    await createCart({ itemId, userId });

    // sort_number 非同期
    const number = 250;
    const buzzNumber = 300;

    patchSortNumberAddUseCase({ itemId, number, buzzNumber }).catch((err) => {
        console.error("patchSortNumberAdd error:", err);
    });
};
