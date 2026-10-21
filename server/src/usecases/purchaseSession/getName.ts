import { AppError } from "../../errors.js";
import { getMyPurchaseSessionHasName } from "../../services/purchaseSession/purchaseSession.js";

type Params = {
    purchaseSessionId: number;
    userId: number;
};

// GET /purchase-session/:id/name
// summary: 購入セッション配送先氏名取得
// page: /edit/name/purchase/[id]
export const getPurchaseSessionNameUseCase = async ({ purchaseSessionId, userId }: Params) => {
    const purchaseSession = await getMyPurchaseSessionHasName({ purchaseSessionId, userId });

    if (!purchaseSession) {
        throw new AppError("PURCHASE_SESSION_NOT_FOUND", 404);
    }

    const name = purchaseSession.Name;

    if (!name) {
        throw new AppError("NAME_NOT_FOUND", 404);
    }

    return name;
};
