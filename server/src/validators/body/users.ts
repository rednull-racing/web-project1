import z from "zod";
import { filesSchema } from "./utils/fileSchema.js";

export const phoneNumberBodySchema = z.object({
    phoneNumber: z
        .string()
        .min(1)
        .transform((val) => val.replace(/[^0-9]/g, ""))
        .pipe(z.string().regex(/^0[0-9]{9,10}$/)),
});

export const profileEditBodySchema = z.object({
    userName: z.string().min(1),
    introduction: z.string().optional().nullable(),
    fileName: z.string().optional(),
    contentType: z.string().optional(),
});

export const honninBodySchema = z.object({
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
    sei: z.string().trim().min(1),
    mei: z.string().trim().min(1),
    seiKana: z.string().trim().min(1),
    meiKana: z.string().trim().min(1),
    phoneNumber: z
        .string()
        .min(1)
        .transform((val) => val.replace(/[^0-9]/g, ""))
        .pipe(z.string().regex(/^0[0-9]{9,10}$/)),
    idFrontUpload: z.preprocess((val) => val === true || val === "true", z.boolean()),
    idRearUpload: z.preprocess((val) => val === true || val === "true", z.boolean()),
    birthday: z.coerce.date().max(new Date()),
    selectedGender: z.coerce.number().int().positive().min(1).max(3),
    frontIdCard: filesSchema.optional(),
    rearIdCard: filesSchema.optional(),
});

export type PhoneNumberBody = z.infer<typeof phoneNumberBodySchema>;
export type ProfileEditBody = z.infer<typeof profileEditBodySchema>;
export type HonninBody = z.infer<typeof honninBodySchema>;
