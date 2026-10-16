import { Router } from "express";
import { banksGetSearchController } from "../controllers/banks/banks.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { keywordQuerySchema } from "../validators/query/keyword.js";
import { bankSearchRateLimit } from "../middleware/rateLimit/bankAccountRateLimit.js";

const router = Router();

// GET /banks/search?keyword=""
// summary: 銀行検索
// page: /edit/accountなど
router.get("/search", validateQuery(keywordQuerySchema), bankSearchRateLimit, banksGetSearchController);

export default router;
