import { apiFetch } from "@/lib/api/client";

type BuyResponse = {
    deliveryId: number;
};

export const fetchBuy = async (itemId: string): Promise<BuyResponse> => {
    return apiFetch(`/delivery/${itemId}`, {
        method: "POST",
    });
};
