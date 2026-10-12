import z from "zod";
import { colorVariantSchema, fileSchema, itemImageSchema, materialSchema } from "./utils/putItem.js";

// PostgreSQLのVARCHARはUTF-16の長さではなく、文字数で上限を判定する。
const storedStringSchema = z.string().refine((value) => Array.from(value).length <= 255, {
    message: "255文字以内で入力してください。",
});

export const createItemDraftBodySchema = z.object({
    itemEditingId: z.number().int().min(1),

    video: fileSchema.optional(),

    thumbnail: fileSchema.optional(),

    videoMeta: z.object({
        title: storedStringSchema,
        summary: z.string().nullable(),
    }),

    itemImages: z.array(itemImageSchema),

    itemMeta: z.object({
        name: storedStringSchema,
        detail: z.string().nullable(),
    }),

    category: z.object({
        id: z.string().nullable(),
        name: z.string(),
        parent_id: z.string().nullable(),
        level: z.number().int().min(1),
    }),

    genderAge: z.object({
        gender: z.enum(["men", "women", "unisex"]).nullable(),
        age: z.enum(["adult", "kids", "both"]).nullable(),
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
        freeText: storedStringSchema.nullable(),
    }),

    price: z.number().int().positive().min(300).max(1000000),
});

export type CreateItemDraftBody = z.infer<typeof createItemDraftBodySchema>;
