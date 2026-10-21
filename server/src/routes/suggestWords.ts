import { Router } from "express";
import { suggestWordsGetRootController } from "../controllers/suggestWords/suggestWords.js";
import { getSuggestWordsRateLimit } from "../middleware/rateLimit/suggestWordsRateLimit.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { keywordOptionalQuerySchema } from "../validators/query/keyword.js";

const router = Router();

// GET /suggest-words?keyword
// summary: 検索サジェスト一覧取得
// page: header
router.get("/", getSuggestWordsRateLimit, validateQuery(keywordOptionalQuerySchema), suggestWordsGetRootController);

export default router;
