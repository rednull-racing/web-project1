import { Router } from "express";
import { commentReportPostByIdController, commentReportGetAllOptionsController } from "../controllers/commentReport/commentReport.js";
import { authenticateToken } from "../middleware/index.js";
import { commentReportRateLimit, getCommentReportRateLimit } from "../middleware/rateLimit/commentReportRateLimit.js";
import { validateBody } from "../middleware/validate/validateBody.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { optionIdBodySchema } from "../validators/body/report.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// POST /comment-report/:id
// summary: comment報告作成
// page: /report/comment/[id]
router.post(
    "/:id",
    validateParams(idParamSchema),
    validateBody(optionIdBodySchema),
    authenticateToken,
    commentReportRateLimit,
    commentReportPostByIdController,
);

// GET /comment-report/all-options
// summary: CommentReportOptions取得
// page: /report/comment/[id]
router.get("/all-options", getCommentReportRateLimit, commentReportGetAllOptionsController);

export default router;
