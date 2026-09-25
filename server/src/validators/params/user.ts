import z from "zod";

export const userFilesIdParamSchema = z.object({
    s3MetadataId: z.coerce.number().int().positive(),
});
