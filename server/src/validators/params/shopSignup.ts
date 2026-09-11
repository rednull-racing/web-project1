import z from "zod";

export const shopSignupFilesIdParamSchema = z.object({
    shopSignupId: z.coerce.number().int().positive(),
    s3MetadataId: z.coerce.number().int().positive(),
});
