import z from "zod";

export const createItemBodySchema = z.object({
    itemEditingId: z.number().int().positive().max(2147483647),
});

export type CreateItemBody = z.infer<typeof createItemBodySchema>;
