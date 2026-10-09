import { z } from "zod";

const fileSchema = z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    uploaded: z.boolean(),
});

const itemImageSchema = z.object({
    name: z.string(),
    type: z.string().nullable(),
    uploaded: z.boolean(),
});

const sizeSchema = z.object({
    size: z.string(),
    inventory: z.number().int().min(0),
});

const colorVariantSchema = z.object({
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

const materialSchema = z.object({
    name: z.string(),
    ratio: z.number().min(0).max(100),
});

export const updateItemEditingConfirmBodySchema = z.object({
    video: fileSchema.optional(),

    thumbnail: fileSchema.optional(),

    videoMeta: z.object({
        title: z.string(),
        summary: z.string().nullable(),
    }),

    itemImages: z.array(itemImageSchema),

    itemMeta: z.object({
        name: z.string(),
        detail: z.string().nullable(),
    }),

    category: z.object({
        id: z.string().nullable(),
        name: z.string(),
        parent_id: z.string().nullable(),
        level: z.number().int().min(1),
    }),

    genderAge: z.object({
        gender: z.string().nullable(),
        age: z.string().nullable(),
    }),

    brand: z.object({
        id: z.string().nullable(),
        name: z.string().nullable(),
    }),

    attributes: z.object({
        allInventory: z.number().int().min(0),

        colorVariants: z.array(colorVariantSchema),

        materials: z.array(materialSchema),
    }),

    condition: z.object({
        id: z.string(),
        name: z.string(),
    }),

    shipping: z.object({
        day: z.string().nullable(),
        service: z.string().nullable(),
        place: z.string().nullable(),
        freeText: z.string().nullable(),
    }),

    price: z.number().int().positive().min(300).max(1000000),
});

export type ItemEditingConfirmBody = z.infer<typeof updateItemEditingConfirmBodySchema>;
