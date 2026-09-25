import z from "zod";

export const shopEditFilesIdParamSchema = z.object({
    shopEditId: z.coerce.number().int().positive(),
    s3MetadataId: z.coerce.number().int().positive(),
});
