type FileMeta = { name?: string; type?: string; uploaded: boolean };
type ImageMeta = { name?: string; type: string | null; uploaded: boolean };

export type Body = {
    video?: FileMeta;
    thumbnail?: FileMeta;
    videoMeta: { title: string; summary: string };
    itemImages: ImageMeta[];
    itemMeta: { name: string; detail: string };
    category: { id: string | null; name: string; parent_id: string | null; level: number };
    genderAge: { gender: string | null; age: string | null };
    brand: { id: string | null; name: string | null };
    attributes: {
        allInventory: number;
        colorVariants: Array<{
            uiId: string;
            color?: string;
            inventory: number;
            image?: FileMeta;
            sizes: Array<{
                size: string;
                inventory: number;
            }>;
        }>;
        materials: Array<{
            name: string;
            ratio: number;
        }>;
    };
    condition: { id: string; name: string };
    shipping: {
        day: string | null;
        service: string | null;
        place: string | null;
        freeText: string | null;
    };
    price: number;
};
