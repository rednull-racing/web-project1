import type { NextFunction, Request, Response } from "express-serve-static-core";
import { searchBranchesUseCase } from "../../usecases/branches/search.js";
import { BranchSearchQuery } from "../../validators/query/branches.js";

// GET /branches/search?keyword=""&bankcode=""
// summary: 支店名検索
// page: /edit/accountなど
export const branchesGetSearchController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = req.validatedQuery as BranchSearchQuery;

        const { bankCode, keyword } = query;

        const matchedBranches = await searchBranchesUseCase({ kw: keyword, bankCode });

        res.status(200).json({ branches: matchedBranches });
    } catch (err) {
        next(err);
    }
};
