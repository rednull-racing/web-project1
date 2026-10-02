import { AppError } from "../../../errors.js";
import { getUserIdS3Metadata } from "../../../services/users/query.js";

type Params = {
    userId: number;
};

// GET /user/id-card
// summary: 身分証データ取得
// page: /edit/id-card
export const getMyIdCardUseCase = async ({ userId }: Params) => {
    // user取得
    const user = await getUserIdS3Metadata({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    return user;
};
