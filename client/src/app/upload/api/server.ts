import { apiFetchServer } from "../../../lib/api/server";
import {
    Categories,
    Item,
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "../types/types";

type UploadResponse = {
    item: Item;
    category: Categories[];
    allCondition: ItemConditionOption[];
    allDay: ShippingDayOption[];
    allService: ShippingServiceOption[];
    allPlace: TodouhukenOption[];
    hasShop: boolean;
};

type ItemHighlightResponse = {
    item: Item;
};

export const fetchUploadPage = async (itemId: string): Promise<UploadResponse> => {
    return apiFetchServer(`/items/${itemId}/form-data`, {
        cache: "no-store",
    });
};

export const fetchItemHighlight = async (itemId: string): Promise<ItemHighlightResponse> => {
    return apiFetchServer(`/items/${itemId}/highlight`, {
        cache: "no-store",
    });
};
