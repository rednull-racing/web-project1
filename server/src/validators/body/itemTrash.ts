import { z } from "zod";

export const createItemTrashBodySchema = z.object({
    itemId: z.number().int().positive().max(2147483647),
});

export type CreateItemTrashBody = z.infer<typeof createItemTrashBodySchema>;
