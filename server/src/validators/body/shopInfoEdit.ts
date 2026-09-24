import z from "zod";
import { updateRepNameBodySchema } from "./shopInfo.js";
import { shopConfirmUpdateFieldSchemas } from "./shopSignup.js";
import { filesSchema } from "./utils/fileSchema.js";

export const shopInfoEditIdImageBodySchema = z.object({
    frontIdCard: filesSchema,
    rearIdCard: filesSchema,
    permitFiles: z.array(filesSchema).max(10),
});

export const createCompanyNameBodySchema = z.object({
    companyName: z.string().min(1),
});

export const comFreeIdBodySchema = z.object({
    selectOption: z.number().int().positive().min(1).max(2),
});

export const shopInfoEditUpdateBodySchema = z.union([
    z.object({ company_name: shopConfirmUpdateFieldSchemas.company_name }).strict(),
    z.object({ phone_number: shopConfirmUpdateFieldSchemas.phone_number }).strict(),
    z.object({ email: shopConfirmUpdateFieldSchemas.email }).strict(),
    z.object({ open_date_time: shopConfirmUpdateFieldSchemas.open_date_time }).strict(),
    z.object({ founded_date: shopConfirmUpdateFieldSchemas.founded_date }).strict(),
    z.object({ member_count: shopConfirmUpdateFieldSchemas.member_count }).strict(),
    z.object({ homepage_url: shopConfirmUpdateFieldSchemas.homepage_url }).strict(),
    z.object({ company_number: shopConfirmUpdateFieldSchemas.company_number }).strict(),
    z.object({ capital: shopConfirmUpdateFieldSchemas.capital }).strict(),
]);

export const createShopEditRepNameBodySchema = updateRepNameBodySchema;

export type CreateCompanyNameBody = z.infer<typeof createCompanyNameBodySchema>;
export type ComFreeIdBody = z.infer<typeof comFreeIdBodySchema>;
export type ShopInfoEditIdImageBody = z.infer<typeof shopInfoEditIdImageBodySchema>;
export type ShopInfoEditUpdateBody = z.infer<typeof shopInfoEditUpdateBodySchema>;
export type CreateShopEditRepNameBody = z.infer<typeof createShopEditRepNameBodySchema>;
