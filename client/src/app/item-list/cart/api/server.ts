import { apiFetchServer } from "@/lib/api/server";
import { Items } from "@/types/itemListTypes";

type ItemListResponse = {
    items: Items[];
};

export const fetchRecommend = async (): Promise<ItemListResponse> => {
    return apiFetchServer("/items/recommend?view=cart");
};
