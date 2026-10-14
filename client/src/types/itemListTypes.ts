import type { ItemAttributes } from "./itemAttributes";

export type Brand = {
    id: string;
    name: string;
};

export type Categories = {
    id: string;
    name: string;
    level: number;
    parent?: Categories | null;
    allowed_gender: "men" | "women" | "both";
    allowed_age: "adult" | "kids" | "both";
};

export type User = {
    user_name: string;
    profile_image: string;
};

export type Video = {
    thumbnail_url: string;
    title: string;
    duration: number;
};

export type Sale = {
    sale_flag: boolean;
    before_price: number;
    discount_rate: number;
    discount_amount: number;
};

export type Items = {
    id: string;
    name: string;
    price: number;
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    status: "active" | "soldout";
    uploaded_at: Date;
    seller_id: string;
    first_image_url: string;
    attributes: ItemAttributes;
    Video: Video | null;
    Sale: Sale | null;
    User: User | null;
    Categories: Categories | null;
    Brand?: Brand | null;
};
