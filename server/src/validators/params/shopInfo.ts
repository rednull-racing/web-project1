import z from "zod";

export const shopInfoFilesIdParamSchema = z.object({
    shopId: z.coerce.number().int().positive(),
    s3MetadataId: z.coerce.number().int().positive(),
});
