import { z } from "zod";

const cartStatuses = ["active", "soldout"] as const;

export const getCartItemListQuerySchema = z.object({
    page: z.string().pipe(z.coerce.number<string>().int().min(1).max(10000)).optional().default(1),
    status: z.preprocess(
        (value) => (value === "active" || value === "soldout" ? value : undefined),
        z.enum(cartStatuses).optional(),
    ),
    keyword: z
        .string()
        .trim()
        .nullish()
        .transform((value) => (!value || value === "null" ? null : value)),
});

export type GetCartItemListQuery = z.infer<typeof getCartItemListQuerySchema>;
