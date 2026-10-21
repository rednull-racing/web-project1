import { AppError } from "../../errors.js";
import { destroyCart, getCartOne } from "../../services/cart/cart.js";
import { patchSortNumberDecreaseUseCase } from "../items/sortNumber/sortNumber.js";

type Params = {
    itemId: number;
    userId: number;
};

// DELETE /cart/:id
// summary: カート削除
// page: /item
export const deleteCartUseCase = async ({ itemId, userId }: Params) => {
    // cart取得
    const cart = await getCartOne({ itemId, userId });

    if (!cart) {
        throw new AppError("CART_NOT_FOUND", 404);
    }

    // cart削除
    await destroyCart({ cart });

    // sort_number 非同期
    const number = 250;
    const buzzNumber = 300;

    patchSortNumberDecreaseUseCase({ itemId, number, buzzNumber }).catch((err) => {
        console.error("patchSortNumberDecrease error:", err);
    });
};
