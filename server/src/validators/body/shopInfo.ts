import z from "zod";
import { filesSchema } from "./utils/fileSchema.js";

export const repNameBodySchema = z.object({
    sei: z.string().trim().min(1),
    mei: z.string().trim().min(1),
    seiKana: z.string().trim().min(1),
    meiKana: z.string().trim().min(1),
    frontFileName: z.string().optional(),
    frontFileType: z.string().optional(),
    rearFileName: z.string().optional(),
    rearFileType: z.string().optional(),
    idFrontUpload: z.boolean().optional(),
    idRearUpload: z.boolean().optional(),
});

export const updateRepNameBodySchema = repNameBodySchema
    .pick({ sei: true, mei: true, seiKana: true, meiKana: true })
    .extend({
        frontIdCard: filesSchema.optional(),
        rearIdCard: filesSchema.optional(),
        frontS3MetadataId: z.coerce.number().int().positive().optional(),
        rearS3MetadataId: z.coerce.number().int().positive().optional(),
    })
    .superRefine((body, ctx) => {
        if (!body.frontIdCard && !body.frontS3MetadataId) {
            ctx.addIssue({ code: "custom", path: ["frontIdCard"], message: "身分証の表面を選択してください。" });
        }
        if (!body.rearIdCard && !body.rearS3MetadataId) {
            ctx.addIssue({ code: "custom", path: ["rearIdCard"], message: "身分証の裏面を選択してください。" });
        }
    });

export const shopOptionBodySchema = z.object({
    autoTrans: z.boolean().default(false),
    openInfo: z.boolean().default(false),
});

export type RepNameBody = z.infer<typeof repNameBodySchema>;
export type ShopOptionBody = z.infer<typeof shopOptionBodySchema>;
