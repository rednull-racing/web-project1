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
    parent?: Categories | null;
    children?: Categories | null;
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
    createdAt: Date;
    updatedAt: Date;
    ItemConditionOption?: ItemConditionOption;
    User?: User;
    Category?: Categories;
    Brand?: Brand;

    thumbnail_url: string;
    title: string;
    summary: string | null;
    duration: string | null;
    original_url: string;
    converted_url: string | null;
    video_status: string;

    before_price: number;
    discount_rate: number | null;
    discount_amount: number | null;
    sale_flag: boolean;

    ShippingDayOption?: ShippingDayOption;
    ShippingServiceOption?: ShippingServiceOption;
    TodouhukenOption?: TodouhukenOption;
    shipping_service_free_text: string | null;
};
