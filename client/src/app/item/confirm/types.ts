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

export type CategoryParent = {
    id: number;
    name: string;
    level: number;
    allowed_gender: string;
    allowed_age: string;
};

export type CategoryChild = CategoryParent & {
    parent_id: number | null;
};

export type Categories = CategoryChild & {
    parent: CategoryParent | null;
    children: CategoryChild[];
};

export type ItemEditing = {
    id: string;
    status: "normal" | "edit";
    item_id: number;
    seller_id: number;
    name: string;
    detail: string | null;
    price: number;
    image_url: string[];
    first_image_url: string;
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    recommend: boolean;
    attributes: ItemAttributes;
    updatedAt: Date;
    ItemConditionOption: ItemConditionOption | null;
    Category: Categories | null;
    Brand: Brand | null;

    thumbnail_url: string;
    title: string;
    summary: string | null;
    duration: string | null;
    original_url: string;
    converted_url: string | null;

    before_price: number;
    discount_rate: number | null;
    discount_amount: number | null;
    sale_flag: boolean;

    ShippingDayOption: ShippingDayOption | null;
    ShippingServiceOption: ShippingServiceOption | null;
    TodouhukenOption: TodouhukenOption | null;
    shipping_service_free_text: string | null;
};
