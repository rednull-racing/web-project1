import { ItemAttributes } from "../../../types/itemAttributes";

export type ItemConditionOption = {
    id: string;
    name: string;
};

export type ShippingDayOption = {
    id: string;
    name: string;
};

export type ShippingServiceOption = {
    id: string;
    name: string;
};

export type TodouhukenOption = {
    id: string;
    name: string;
};

export type Brand = {
    id: string;
    name: string;
};

export type Categories = {
    id: string;
    name: string;
    parent?: Categories | null;
    children?: Categories | null;
};

export type ItemDraft = {
    id: string;
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
    ItemConditionOption?: ItemConditionOption;
    Category?: Categories;
    Brand?: Brand;

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

    ShippingDayOption?: ShippingDayOption;
    ShippingServiceOption?: ShippingServiceOption;
    TodouhukenOption?: TodouhukenOption;
    shipping_service_free_text: string | null;
};
