import { z } from "zod";

const itemPageModes = ["normal", "draft", "confirm", "deleted"] as const;
const itemListTypes = ["video", "item"] as const;
const itemListViews = ["index", "profile"] as const;
const recommendItemsViews = ["recommend", "cart", "itemPage"] as const;
const searchItemSort = ["popular", "new", "priceAsc", "priceDesc"] as const;

export type ItemPageMode = (typeof itemPageModes)[number];
export type ItemListType = (typeof itemListTypes)[number];
export type ItemListView = (typeof itemListViews)[number];
export type RecommendItemsview = (typeof recommendItemsViews)[number];
export type SearchItemSort = (typeof searchItemSort)[number];

export const getItemPageQuerySchema = z.object({
    mode: z.enum(itemPageModes),
});

export const itemSortNumberQuerySchema = z.object({
    number: z.coerce.number(),
});

export const itemListQuerySchema = z.object({
    type: z.enum(itemListTypes),
    view: z.enum(itemListViews),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(6),
    pageUserId: z.coerce.number().int().positive().optional(),
});

export const recommendItemsQuerySchema = z.object({
    view: z.enum(recommendItemsViews),
    itemId: z.coerce.number().int().positive().optional(),
});

export const searchItemsQuerySchema = z.object({
    keyword: z.string().min(1),
    limit: z.coerce.number().int().positive().min(1).max(1000).default(15),
    sort: z.enum(searchItemSort),
    cursorScore: z.coerce.number().positive().optional(),
    cursorId: z.coerce.number().int().positive().min(1).optional(),
});

export type ItemPageQuery = z.infer<typeof getItemPageQuerySchema>;
export type ItemSortNumberQuery = z.infer<typeof itemSortNumberQuerySchema>;
export type ItemListQuery = z.infer<typeof itemListQuerySchema>;
export type RecommendItemsQuery = z.infer<typeof recommendItemsQuerySchema>;
export type SearchItemsQuery = z.infer<typeof searchItemsQuerySchema>;
