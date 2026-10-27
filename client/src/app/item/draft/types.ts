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

export type BrandAliases = {
    id: string;
    name: string | null;
    name_normalized: string | null;
    Brand?: Brand;
};

export type Categories = {
    id: string;
    name: string;
    level: number;
    allowed_gender: "men" | "women" | "both";
    allowed_age: "adult" | "kids" | "both";
    parent?: Categories | null;
};

export type ShopInfo = {
    id: string;
};

export type User = {
    id: string;
    user_name: string;
    profile_image: string;
    early_seller: boolean;
    honnin_verified: boolean;
    star_amount: number;
    star_average: number;
    ShopInfo?: ShopInfo | null;
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
    createdAt: string;
    updatedAt: string;
    ItemConditionOption?: ItemConditionOption;
    User?: User;
    Category?: Categories;
    Brand?: Brand;

    thumbnail_url: string | null;
    title: string | null;
    summary: string | null;
    duration: number | null;
    original_url: string | null;
    converted_url: string | null;
    video_status: string | null;

    before_price: number | null;
    discount_rate: number | null;
    discount_amount: number | null;
    sale_flag: boolean;

    ShippingDayOption?: ShippingDayOption;
    ShippingServiceOption?: ShippingServiceOption;
    TodouhukenOption?: TodouhukenOption;
    shipping_service_free_text: string | null;
};
