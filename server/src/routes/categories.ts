import { Router } from "express";
import { categoriesGetByIdLevel2Controller } from "../controllers/categories/categories.js";
import { getLevel2RateLimit } from "../middleware/rateLimit/categoriesRateLimit.js";
import { validateParams } from "../middleware/validate/validateParams.js";
import { idParamSchema } from "../validators/params/id.js";

const router = Router();

// GET /categories/:id/level2
// summary: カテゴリーlevel2取得
// page: /upload
router.get("/:id/level2", getLevel2RateLimit, validateParams(idParamSchema), categoriesGetByIdLevel2Controller);

export default router;
