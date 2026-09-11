import z from "zod";
import { isValidCompanyNumber } from "../../utils/isValidCompanyNumber.js";

export const createSignup1BodySchema = z.object({
    selectOption: z.number().int().positive().min(1).max(2),
    companyName: z.string().min(1),
    shopName: z.string().min(1),
    phoneNumber: z
        .string()
        .min(1)
        .transform((val) => val.replace(/[^0-9]/g, ""))
        .pipe(z.string().regex(/^0[0-9]{9,10}$/)),
    email: z
        .string()
        .trim()
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    openDateTime: z.string().min(1),
    foundedDate: z.date().max(new Date()),
    memberCount: z.number().int().positive().min(1).max(1000000),
    homepage: z.string().optional(),
    repSei: z.string().trim().min(1),
    repMei: z.string().trim().min(1),
    repSeiKana: z.string().trim().min(1),
    repMeiKana: z.string().trim().min(1),
    conSei: z.string().trim().min(1),
    conMei: z.string().trim().min(1),
    conSeiKana: z.string().trim().min(1),
    conMeiKana: z.string().trim().min(1),
    postNumber: z
        .string()
        .trim()
        .length(7)
        .transform((val) => val.replace(/-/g, ""))
        .pipe(z.string().regex(/^[0-9]{7}$/)),
    todouhuken: z.string().trim().min(1),
    shikutyouson: z.string().trim().min(1),
    banchi: z.string().trim().min(1),
    building: z.string().trim().optional(),
    companyNumber: z
        .string()
        .trim()
        .optional()
        .refine((val) => val === undefined || val === "" || isValidCompanyNumber(val)),
    capital: z.number().int().optional(),
});

export const filesSchema = z.object({
    fileName: z.string(),
    contentType: z.string().min(1),
    size: z.number().int().positive(),
    buffer: z.instanceof(Buffer),
});

export const shopSignup3BodySchema = z
    .object({
        frontIdCard: filesSchema.optional(),
        frontS3MetadataId: z.coerce.number().int().positive().optional(),
        rearIdCard: filesSchema.optional(),
        rearS3MetadataId: z.coerce.number().int().positive().optional(),
        permitFiles: z.array(filesSchema).max(10).default([]),
        requiresPermit: z
            .enum(["true", "false"])
            .default("false")
            .transform((value) => value === "true"),
        permits: z
            .array(
                z.object({
                    fileIndex: z.coerce.number().int().min(0).max(9).optional(),
                    s3MetadataId: z.coerce.number().int().positive().optional(),
                }),
            )
            .max(10)
            .optional(),
    })
    .transform((body) => ({
        ...body,
        // 新規ファイルだけを送る従来のリクエストも受け付ける。
        permits: body.permits ?? body.permitFiles.map((_, fileIndex) => ({ fileIndex, s3MetadataId: undefined })),
    }))
    .superRefine((body, ctx) => {
        if (!body.frontIdCard && !body.frontS3MetadataId) {
            ctx.addIssue({ code: "custom", path: ["frontIdCard"], message: "身分証の表面を選択してください。" });
        }
        if (!body.rearIdCard && !body.rearS3MetadataId) {
            ctx.addIssue({ code: "custom", path: ["rearIdCard"], message: "身分証の裏面を選択してください。" });
        }
        if (body.requiresPermit && body.permits.length === 0) {
            ctx.addIssue({ code: "custom", path: ["permits"], message: "許認可証を選択してください。" });
        }
        const fileIndexes = new Set<number>();
        const metadataIds = new Set<number>();
        body.permits.forEach((permit, index) => {
            if (permit.fileIndex !== undefined) {
                if (!body.permitFiles[permit.fileIndex] || fileIndexes.has(permit.fileIndex)) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["permits", index],
                        message: "許認可証を選び直してください。",
                    });
                }
                fileIndexes.add(permit.fileIndex);
            } else if (!permit.s3MetadataId || metadataIds.has(permit.s3MetadataId)) {
                ctx.addIssue({ code: "custom", path: ["permits", index], message: "許認可証を選び直してください。" });
            } else {
                metadataIds.add(permit.s3MetadataId);
            }
        });
        if (fileIndexes.size !== body.permitFiles.length) {
            ctx.addIssue({ code: "custom", path: ["permitFiles"], message: "許認可証を選び直してください。" });
        }
    });

export const shopSignupOptionBodySchema = z.object({
    autoTrans: z.boolean().default(false),
    openInfo: z.boolean().default(false),
});

export const shopConfirmUpdateFieldSchemas = {
    company_name: z.string(),
    phone_number: z.string(),
    email: z.string(),
    open_date_time: z.string(),
    founded_date: z.iso.datetime({ offset: true }),
    member_count: z.union([z.number().int(), z.string().regex(/^-?\d+$/)]),
    homepage_url: z.string(),
    company_number: z.string(),
    capital: z.union([z.number().int(), z.string().regex(/^-?\d+$/)]),
};

export const shopSignupEditBodySchema = z.union([
    z.object({ com_or_free_id: z.number().int().min(1).max(2) }).strict(),
    z.object({ company_name: shopConfirmUpdateFieldSchemas.company_name }).strict(),
    z.object({ shop_name: z.string() }).strict(),
    z.object({ phone_number: shopConfirmUpdateFieldSchemas.phone_number }).strict(),
    z.object({ email: shopConfirmUpdateFieldSchemas.email }).strict(),
    z.object({ open_date_time: shopConfirmUpdateFieldSchemas.open_date_time }).strict(),
    z.object({ founded_date: shopConfirmUpdateFieldSchemas.founded_date }).strict(),
    z.object({ member_count: shopConfirmUpdateFieldSchemas.member_count }).strict(),
    z.object({ homepage_url: shopConfirmUpdateFieldSchemas.homepage_url }).strict(),
    z.object({ company_number: shopConfirmUpdateFieldSchemas.company_number }).strict(),
    z.object({ capital: shopConfirmUpdateFieldSchemas.capital }).strict(),
    z.object({ auto_trans: z.enum(["true", "false"]) }).strict(),
    z.object({ open_info: z.enum(["true", "false"]) }).strict(),
]);

export type CreateSignup1Body = z.infer<typeof createSignup1BodySchema>;
export type ShopSignup3Body = z.infer<typeof shopSignup3BodySchema>;
export type ShopSignupOptionBody = z.infer<typeof shopSignupOptionBodySchema>;
export type ShopSignupEditBody = z.infer<typeof shopSignupEditBodySchema>;
