import { z } from "zod";
import { colorVariantSchema, fileSchema, itemImageSchema, materialSchema } from "./utils/putItem.js";

export const createItemDraftBodySchema = z.object({
    itemEditingId: z.number().int().min(1),

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

        colorVariants: z.array(colorVariantSchema).superRefine((variants, ctx) => {
            const seenUiIds = new Set<string>();

            variants.forEach((variant, index) => {
                if (seenUiIds.has(variant.uiId)) {
                    ctx.addIssue({
                        code: "custom",
                        path: [index, "uiId"],
                        message: "色の情報が重複しています。色の設定を確認してください。",
                    });
                }

                seenUiIds.add(variant.uiId);
            });
        }),

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

export type CreateItemDraftBody = z.infer<typeof createItemDraftBodySchema>;
