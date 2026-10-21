import { AppError } from "../../../errors.js";
import { updatePenaltyUser } from "../../../services/users/command.js";
import { getUser } from "../../../services/users/query.js";

type Params = {
    pageUserId: number;
    addPenalty: number;
};

// PATCH /admin/user/:id/add-penalty
// summary: ペナルティポイント追加
// page: /profile/admin/[id]
export const addPenaltyUseCase = async ({ pageUserId, addPenalty }: Params) => {
    // bodyバリデーション
    if (addPenalty <= 0) throw new AppError("INVALID_BODY", 400);

    // user取得
    const user = await getUser({ userId: pageUserId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // db更新
    const newPenaltyPoints = Number(user.penalty_points) + addPenalty;

    await updatePenaltyUser({
        user,
        data: { penalty_points: newPenaltyPoints },
    });
};
