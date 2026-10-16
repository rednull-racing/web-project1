import type { Request, Response } from "express-serve-static-core";
import { getBrandsSuggestUseCase } from "../../usecases/brands/getBrandsSuggest.js";
import { normalizeJapanese } from "../../utils/normalizeJapanese.js";
import { KeywordOptionalQuery } from "../../validators/query/keyword.js";

// GET /brands/suggest?keyword=""
// summary: ブランドサジェスト検索リスト取得
// page: /upload
export const brandsGetSuggestController = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = req.validatedQuery as KeywordOptionalQuery;

        if (!query.keyword) {
            res.status(200).json({ suggest: [] });
            return;
        }

        const keyword = normalizeJapanese(query.keyword);

        const brands = await getBrandsSuggestUseCase({ keyword });

        res.status(200).json({ brands });
    } catch (err) {
        console.error(err);
        res.status(500).json({ suggest: [] });
    }
};
