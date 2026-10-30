import { ItemAttributes } from "@/types/itemAttributes";

export type SearchResponse = {
    itemList: Item[];
    nextCursorScore: string | null;
    nextCursorId: string | null;
    hasMore: boolean;
};

export type Brand = {
    id: string;
    name: string;
};

export type Categories = {
    id: string;
    name: string;
    level: number;
    parent: Categories | null;
    allowed_gender: "men" | "women" | "both";
    allowed_age: "adult" | "kids" | "both";
};

export type User = {
    id: string;
    user_name: string;
    profile_image: string;
};

export type Sale = {
    id: string;
    discount_rate: number;
    discount_amount: number;
    before_price: number;
    sale_flag: boolean;
};

export type Video = {
    id: string;
    title: string;
    thumbnail_url: string;
    duration: number;
};

export type Item = {
    id: string;
    name: string;
    price: number;
    status: "active" | "soldout";
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    first_image_url: string;
    attributes: ItemAttributes;
    Video: Video | null;
    Sale: Sale | null;
    User: User | null;
    Categories: Categories | null;
    Brand: Brand | null;
};

export type Search = {
    id: string;
    user_id: number;
    search_text: string | null;
    category_text: string | null;
};
