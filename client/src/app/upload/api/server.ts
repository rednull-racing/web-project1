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

type IdDto<T extends { id: string }> = Omit<T, "id"> & { id: string | number };
type UploadResponseDto = Omit<UploadResponse, "itemEditing" | "category" | "allCondition" | "allDay" | "allService" | "allPlace"> & {
    itemEditing: Omit<ItemEditing, "id" | "Category" | "Brand" | "ItemConditionOption" | "ShippingDayOption" | "ShippingServiceOption" | "TodouhukenOption"> & {
        id: string | number;
        Category: IdDto<Categories> | null;
        Brand: IdDto<NonNullable<ItemEditing["Brand"]>> | null;
        ItemConditionOption: IdDto<ItemConditionOption> | null;
        ShippingDayOption: IdDto<ShippingDayOption> | null;
        ShippingServiceOption: IdDto<ShippingServiceOption> | null;
        TodouhukenOption: IdDto<TodouhukenOption> | null;
    };
    category: IdDto<Categories>[];
    allCondition: IdDto<ItemConditionOption>[];
    allDay: IdDto<ShippingDayOption>[];
    allService: IdDto<ShippingServiceOption>[];
    allPlace: IdDto<TodouhukenOption>[];
};

const withStringId = <T extends { id: string | number }>(value: T) => ({ ...value, id: String(value.id) });
const nullableOption = <T extends { id: string | number }>(value: T | null) => value ? withStringId(value) : null;

export const normalizeUploadPage = (data: UploadResponseDto): UploadResponse => ({
    ...data,
    itemEditing: {
        ...data.itemEditing,
        id: String(data.itemEditing.id),
        Category: nullableOption(data.itemEditing.Category),
        Brand: nullableOption(data.itemEditing.Brand),
        ItemConditionOption: nullableOption(data.itemEditing.ItemConditionOption),
        ShippingDayOption: nullableOption(data.itemEditing.ShippingDayOption),
        ShippingServiceOption: nullableOption(data.itemEditing.ShippingServiceOption),
        TodouhukenOption: nullableOption(data.itemEditing.TodouhukenOption),
    },
    category: data.category.map(withStringId),
    allCondition: data.allCondition.map(withStringId),
    allDay: data.allDay.map(withStringId),
    allService: data.allService.map(withStringId),
    allPlace: data.allPlace.map(withStringId),
});

type ItemHighlightResponse = {
    item: Item;
};

export const fetchUploadPage = async (itemEditingId: string): Promise<UploadResponse> => {
    return normalizeUploadPage(await apiFetchServer<UploadResponseDto>(`/item-editing/${itemEditingId}/form`, {
        cache: "no-store",
    }));
};

export const fetchItemHighlight = async (itemId: string): Promise<ItemHighlightResponse> => {
    return apiFetchServer(`/items/${itemId}/highlight`, {
        cache: "no-store",
    });
};
