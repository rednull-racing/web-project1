import sequelize from "../../../db.js";
import { getCommentsReportScoreCron, updateReportScore } from "../../../services/comment/comment.js";

// コメント信頼度 1日0.9倍
export const cronCommentTrustScoreUseCase = async (): Promise<number> => {
    const comments = await getCommentsReportScoreCron({ minReportScore: 0 });

    if (comments.length === 0) return 0;

    await sequelize.transaction(async (transaction) => {
        for (const comment of comments) {
            await updateReportScore({
                comment,
                data: { report_score: comment.report_score * 0.9 },
                transaction,
            });
        }
    });

    return comments.length;
};
