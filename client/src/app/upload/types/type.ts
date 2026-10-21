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

export type ItemShippingProfile = {
    id: string;
    ShippingDayOption?: ShippingDayOption | null;
    ShippingServiceOption?: ShippingServiceOption | null;
    TodouhukenOption?: TodouhukenOption | null;
    shipping_service_free_text: string | null;
};

export type Sale = {
    id: string;
    before_price: number;
};

export type Video = {
    id: string;
    original_url: string;
    converted_url: string;
    thumbnail_url: string;
    title: string;
    summary: string;
    user_id: string | number;
    shop_id: string | number;
};

export type Item = {
    id: string;
    image_url: string[];
    first_image_url: string;
    name: string;
    detail: string;
    seller_id: string | number;
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    attributes: ItemAttributes;
    status: "active" | "soldout";
    price: number;
    Video?: Video | null;
    Sale?: Sale | null;
    Category?: Categories | null;
    Brand?: Brands | null;
    ItemConditionOption?: ItemConditionOption | null;
    ItemShippingProfile?: ItemShippingProfile | null;
};
