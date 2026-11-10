import { z } from "zod";

const itemLikeStatuses = ["active", "soldout"] as const;

export const getItemLikeListQuerySchema = z.object({
    page: z.string().pipe(z.coerce.number<string>().int().min(1).max(10000)).optional().default(1),
    status: z.preprocess(
        (value) => (value === "active" || value === "soldout" ? value : undefined),
        z.enum(itemLikeStatuses).optional(),
    ),
    keyword: z
        .string()
        .trim()
        .nullish()
        .transform((value) => (!value || value === "null" ? null : value)),
});

export type GetItemLikeListQuery = z.infer<typeof getItemLikeListQuerySchema>;
