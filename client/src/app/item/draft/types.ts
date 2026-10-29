import type { ItemAttributes } from "../../../types/itemAttributes";

export type ItemConditionOption = {
    id: number;
    name: string;
};

export type ShippingDayOption = {
    id: number;
    name: string;
};

export type ShippingServiceOption = {
    id: number;
    name: string;
};

export type TodouhukenOption = {
    id: number;
    name: string;
};

export type Brand = {
    id: number;
    name: string;
};

export type Category = {
    id: number;
    name: string;
};

export type Categories = Category & {
    parent: Category | null;
    children: Category[];
};

export type ItemDraft = {
    id: number;
    seller_id: number | null;
    name: string | null;
    detail: string | null;
    price: number | null;
    image_url: string[] | null;
    first_image_url: string | null;
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    recommend: boolean | null;
    attributes: ItemAttributes;
    updatedAt: string;
    ItemConditionOption: ItemConditionOption | null;
    Category: Categories | null;
    Brand: Brand | null;

    thumbnail_url: string | null;
    title: string | null;
    summary: string | null;
    duration: number | null;
    original_url: string | null;
    converted_url: string | null;

    before_price: number | null;
    discount_rate: number | null;
    discount_amount: number | null;
    sale_flag: boolean;

    ShippingDayOption: ShippingDayOption | null;
    ShippingServiceOption: ShippingServiceOption | null;
    TodouhukenOption: TodouhukenOption | null;
    shipping_service_free_text: string | null;
};
