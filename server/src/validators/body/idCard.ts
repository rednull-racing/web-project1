import z from "zod";
import { filesSchema } from "./utils/fileSchema.js";

export const updateIdCardBodySchema = z.object({
    frontIdCard: filesSchema.optional(),
    rearIdCard: filesSchema.optional(),
    frontS3MetadataId: z.coerce.number().int().positive().optional(),
    rearS3MetadataId: z.coerce.number().int().positive().optional(),
});

export type UpdateIdCardBody = z.infer<typeof updateIdCardBodySchema>;
