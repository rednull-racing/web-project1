import { Router } from "express";
import { branchesGetSearchController } from "../controllers/branches/branches.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { branchSearchQuerySchema } from "../validators/query/branches.js";
import { bankSearchRateLimit } from "../middleware/rateLimit/bankAccountRateLimit.js";

const router = Router();

// GET /branches/search?keyword=""&bankcode=""
// summary: 支店名検索
// page: /edit/accountなど
router.get("/search", validateQuery(branchSearchQuerySchema), bankSearchRateLimit, branchesGetSearchController);

export default router;
