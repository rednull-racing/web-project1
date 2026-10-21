import type { Request, Response } from "express-serve-static-core";
import { getSuggestUseCase } from "../../usecases/suggestWords/getSuggest.js";
import { normalizeJapanese } from "../../utils/normalizeJapanese.js";
import { KeywordOptionalQuery } from "../../validators/query/keyword.js";

// GET /suggest-words?keyword
// summary: 検索サジェスト一覧取得
// page: header
export const suggestWordsGetRootController = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = req.validatedQuery as KeywordOptionalQuery;
        const keyword = normalizeJapanese(query.keyword ?? "");

        if (!keyword.trim()) {
            res.status(200).json({ suggest: [] });
            return;
        }

        const suggest = await getSuggestUseCase({ keyword });

        res.status(200).json({ suggest });
    } catch (err) {
        console.error(err);
        res.status(500).json({ suggest: [] });
    }
};
