export type ItemUploadSharedUseCaseBody = {
    video?: {
        name?: string;
        type?: string;
        uploaded: boolean;
    };
    thumbnail?: {
        name?: string;
        type?: string;
        uploaded: boolean;
    };
    videoMeta: {
        title: string;
        summary: string | null;
    };
    itemImages: {
        name: string;
        type: string | null;
        uploaded: boolean;
    }[];
    itemMeta: {
        name: string;
        detail: string | null;
    };
    category: {
        id: string | null;
        name: string;
        parent_id: string | null;
        level: number;
    };
    genderAge: {
        gender: string | null;
        age: string | null;
    };
    brand: {
        id: string | null;
        name: string | null;
    };
    attributes: {
        allInventory: number;
        colorVariants: {
            uiId: string;
            color?: string;
            inventory: number;
            image?: {
                name: string;
                type?: string;
                uploaded: boolean;
            };
            sizes: {
                size: string;
                inventory: number;
            }[];
        }[];
        materials: {
            name: string;
            ratio: number;
        }[];
    };
    condition: {
        id: string;
        name: string;
    };
    shipping: {
        day: string | null;
        service: string | null;
        place: string | null;
        freeText: string | null;
    };
    price: number;
};
