import { apiFetchServer } from "../../../lib/api/server";
import {
    Categories,
    Item,
    ItemConditionOption,
    ItemEditing,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "../types/types";

type UploadResponse = {
    itemEditing: ItemEditing;
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

export const fetchUploadPage = async (itemEditingId: string): Promise<UploadResponse> => {
    return apiFetchServer(`/item-editing/${itemEditingId}/form`, {
        cache: "no-store",
    });
};

export const fetchItemHighlight = async (itemId: string): Promise<ItemHighlightResponse> => {
    return apiFetchServer(`/items/${itemId}/highlight`, {
        cache: "no-store",
    });
};
