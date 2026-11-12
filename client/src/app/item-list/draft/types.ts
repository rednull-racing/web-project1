export type ItemDraft = {
    id: number;
    name: string | null;
    price: number | string | null;
    first_image_url: string | null;
    title: string | null;
    createdAt: string;
};

export type DraftListResponse = {
    itemDraftList: { itemDraft: ItemDraft }[];
    totalPages: number;
};
