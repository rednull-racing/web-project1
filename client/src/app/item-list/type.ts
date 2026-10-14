import { ItemAttributes } from "@/types/itemAttributes";

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
};

export type Item = {
    id: string;
    name: string;
    price: number;
    status: "active" | "soldout";
    gender_type: "men" | "women" | "unisex";
    age_type: "adult" | "kids" | "both";
    save_at: Date;
    first_image_url: string;
    attributes: ItemAttributes;
    Video?: Video | null;
    Sale?: Sale | null;
};
