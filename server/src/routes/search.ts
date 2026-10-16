import { Router } from "express";
import { searchGetHistoryController } from "../controllers/search/search.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { getSearchHistoryRateLimit } from "../middleware/rateLimit/searchRateLimit.js";

const router = Router();

// GET /search/history
// summary: 検索履歴取得
// page: header
router.get("/history", getSearchHistoryRateLimit, authenticateToken, searchGetHistoryController);

export default router;
