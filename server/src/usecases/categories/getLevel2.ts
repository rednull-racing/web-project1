import { AppError } from "../../errors.js";
import { getLevel2 } from "../../services/categories/categories.js";

type Params = {
    parentId: number;
};

// GET /categories/:id/level2
// summary: カテゴリーlevel2取得
// page: /upload
export const getLevel2UseCase = async ({ parentId }: Params) => {
    const category2 = await getLevel2({ parentId });

    if (category2.length === 0) {
        throw new AppError("CATEGORY2_NOT_FOUND", 404);
    }

    return category2;
};
