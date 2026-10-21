import { AppError } from "../../errors.js";
import { getMyPurchaseSessionHasAddress } from "../../services/purchaseSession/purchaseSession.js";

type Params = {
    purchaseSessionId: number;
    userId: number;
};

// GET /purchase-session/:id/address
// summary: 購入セッション配送先住所取得
// page: /edit/address/purchase/[id]
export const getPurchaseSessionAddressUseCase = async ({ purchaseSessionId, userId }: Params) => {
    const purchaseSession = await getMyPurchaseSessionHasAddress({ purchaseSessionId, userId });

    if (!purchaseSession) {
        throw new AppError("PURCHASE_SESSION_NOT_FOUND", 404);
    }

    const address = purchaseSession.Address;

    if (!address) {
        throw new AppError("ADDRESS_NOT_FOUND", 404);
    }

    return address;
};
