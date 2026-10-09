import { z } from "zod";

export const fileSchema = z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    uploaded: z.boolean(),
});

export const itemImageSchema = z.object({
    name: z.string(),
    type: z.string().nullable(),
    uploaded: z.boolean(),
});

export const sizeSchema = z.object({
    size: z.string(),
    inventory: z.number().int().min(0),
});

export const colorVariantSchema = z.object({
    uiId: z.string(),

    color: z.string().optional(),

    inventory: z.number().int().min(0),

    image: z
        .object({
            name: z.string(),
            type: z.string().optional(),
            uploaded: z.boolean(),
        })
        .optional(),

    sizes: z.array(sizeSchema),
});

export const materialSchema = z.object({
    name: z.string(),
    ratio: z.number().min(0).max(100),
});