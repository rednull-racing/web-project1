import { Router } from "express";
import {
    notificationPatchByIdReadFlagController,
    notificationGetUnreadCountController,
    notificationGetRootController,
} from "../controllers/notification/notification.js";
import { authenticateToken } from "../middleware/index.js";
import {
    getNotificationListRateLimit,
    getUnreadCountRateLimit,
    patchReadFlagRateLimit,
} from "../middleware/rateLimit/notificationRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { idParamSchema } from "../validators/params/id.js";
import { getNotificationListQuerySchema } from "../validators/query/notification.js";

const router = Router();

// PATCH /notification/:id/read-flag
// summary: 既読
// page: /notification
router.patch(
    "/:id/read-flag",
    patchReadFlagRateLimit,
    authenticateToken,
    validateParams(idParamSchema),
    notificationPatchByIdReadFlagController,
);

// GET /notification/unread-count
// summary: 未読通知カウント
// page: footer, /my-page
router.get("/unread-count", getUnreadCountRateLimit, authenticateToken, notificationGetUnreadCountController);

// GET /notification?limit=00(&cursor="")
// summary: お知らせ一覧取得
// page: /notification
router.get(
    "/",
    getNotificationListRateLimit,
    validateQuery(getNotificationListQuerySchema),
    authenticateToken,
    notificationGetRootController,
);

export default router;
