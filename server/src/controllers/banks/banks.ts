import type { NextFunction, Request, Response } from "express-serve-static-core";
import { searchBanksUseCase } from "../../usecases/banks/search.js";
import { KeywordQuery } from "../../validators/query/keyword.js";

// GET /banks/search?keyword=""
// summary: 銀行検索
// page: /edit/accountなど
export const banksGetSearchController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = req.validatedQuery as KeywordQuery;

        const matchedBanks = await searchBanksUseCase({ kw: query.keyword });

        res.status(200).json({ banks: matchedBanks });
    } catch (err) {
        next(err);
    }
};
