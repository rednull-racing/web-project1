import { Router } from "express";
import { inquiryPostRootController } from "../controllers/inquiry/inquiry.js";
import { authenticateOptional } from "../middleware/authOptional.js";
import { createInquiryRateLimit } from "../middleware/rateLimit/inquiryRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { createInquiryBodySchema } from "../validators/body/inquiry.js";

const router = Router();

// POST /inquiry
// summary: お問い合わせ作成
// page: /inquiry
router.post(
    "/",
    authenticateOptional,
    validateBody(createInquiryBodySchema),
    createInquiryRateLimit,
    inquiryPostRootController,
);

export default router;
