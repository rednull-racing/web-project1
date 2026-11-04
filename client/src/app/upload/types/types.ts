import { BodyCategory, ItemAttributes, Layer, LifeStyleCategory } from "@/types/itemAttributes";

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

export type ItemConditionOption = {
    id: string;
    name: string;
};

export type Brands = {
    id: string;
    name: string;
};

export type Categories = {
    id: string;
    name: string;
    level: number;
    allowed_gender: "men" | "women" | "unisex";
    allowed_age: "adult" | "kids" | "both";
    parent_id: number;
    body_category: BodyCategory;
    lifestyle_category: LifeStyleCategory;
    layer: Layer;
};

export type Item = {
    id: string;
    first_image_url: string;
    name: string;
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    status: "active" | "soldout";
    price: number;
};

export type ItemEditing = {
    id: string;
    status: "normal" | "edit";
    video_status?: "processing" | "converted" | "failed" | null;
    seller_id: number;
    name: string;
    detail: string;
    price: number;
    image_url: string[];
    first_image_url: string;
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    attributes: ItemAttributes;
    Category: Categories | null;
    Brand: Brands | null;
    ItemConditionOption: ItemConditionOption | null;
    thumbnail_url: string;
    title: string;
    summary: string;
    duration: number;
    original_url: string;
    converted_url: string;
    before_price: number;
    ShippingDayOption: ShippingDayOption | null;
    ShippingServiceOption: ShippingServiceOption | null;
    TodouhukenOption: TodouhukenOption | null;
    shipping_service_free_text: string | null;
};
