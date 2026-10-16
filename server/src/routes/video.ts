import { Router } from "express";
import { videoPatchByIdOnplayController, videoPatchByIdConvertController } from "../controllers/video/video.js";
import { authenticateOptional, authenticateToken } from "../middleware/index.js";
import { convertVideoRateLimit, playVideoLogRateLimit } from "../middleware/rateLimit/videoRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// PATCH /video/:id/onplay
// summary: 動画再生ログ更新
// page: /item
router.patch(
    "/:id/onplay",
    authenticateOptional,
    playVideoLogRateLimit,
    validateParams(idParamSchema),
    videoPatchByIdOnplayController,
);

// PATCH /video/:id/convert
// summary: 動画HLS変換
// page: /upload
router.patch(
    "/:id/convert",
    authenticateToken,
    convertVideoRateLimit,
    validateParams(idParamSchema),
    videoPatchByIdConvertController,
);

export default router;
