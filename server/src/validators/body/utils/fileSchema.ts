import z from "zod";

export const filesSchema = z.object({
    fileName: z.string(),
    contentType: z.string().min(1),
    size: z.number().int().positive(),
    buffer: z.instanceof(Buffer),
});
