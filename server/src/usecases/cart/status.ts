import { getCartOne } from "../../services/cart/cart.js";

type Params = {
    itemId: number;
    userId: number;
};

// GET /cart/:id/status
// summary: カートステータス取得
// page: /item
export const cartStatusUseCase = async ({ itemId, userId }: Params) => {
    const status = await getCartOne({ itemId, userId });

    return !!status;
};
