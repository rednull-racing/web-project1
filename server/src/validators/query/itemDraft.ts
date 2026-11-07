import { z } from "zod";

export const getItemDraftListQuerySchema = z.object({
    page: z.string().pipe(z.coerce.number<string>().int().min(1).max(10000)).optional().default(1),
    keyword: z
        .string()
        .trim()
        .nullish()
        .transform((value) => (!value || value === "null" ? null : value)),
});

export type GetItemDraftListQuery = z.infer<typeof getItemDraftListQuerySchema>;
