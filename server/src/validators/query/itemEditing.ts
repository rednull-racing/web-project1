import z from "zod";

const editingStatuses = ["normal", "edit"] as const;

export const createItemEditingCopyQuerySchema = z.object({
    status: z.enum(editingStatuses),
});

export type CreateItemEditingCopyQuery = z.infer<typeof createItemEditingCopyQuerySchema>;
