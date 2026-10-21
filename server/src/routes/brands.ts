import { Router } from "express";
import { brandsGetSuggestController } from "../controllers/brands/brands.js";
import { brandSuggestRateLimit } from "../middleware/rateLimit/brandRateLimit.js";
import { validateQuery } from "../middleware/validate/validateQuery.js";
import { keywordOptionalQuerySchema } from "../validators/query/keyword.js";

const router = Router();

// GET /brands/suggest?keyword=""
// summary: ブランドサジェスト検索リスト取得
// page: /upload
router.get("/suggest", brandSuggestRateLimit, validateQuery(keywordOptionalQuerySchema), brandsGetSuggestController);

export default router;
