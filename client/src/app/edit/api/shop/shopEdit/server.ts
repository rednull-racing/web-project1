import { apiFetchServer } from "../../../../../lib/api/server";
import { ShopInfoEdit } from "../../../types";

type ComFreeConfirmResponse = {
    shopEdit: ShopInfoEdit;
};

export const fetchComFreeConfirmPage = async (shopEditId: string): Promise<ComFreeConfirmResponse> => {
    return apiFetchServer(`/shop-info-edit/${shopEditId}/com-free-confirm`, {
        cache: "no-store",
    });
};
