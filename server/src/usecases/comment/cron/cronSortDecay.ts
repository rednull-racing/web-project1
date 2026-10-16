import { getCommentsSortDecayCron, updateSortNumber } from "../../../services/comment/comment.js";

// Comment.sort_number減算
export const decayCommentSortNumberCronUseCase = async (): Promise<void> => {
    const comments = await getCommentsSortDecayCron({
        minSortNumber: 0.01,
    });

    for (const comment of comments) {
        const sortNumber = comment.sort_number / 2;

        await updateSortNumber({ comment, data: { sort_number: sortNumber } });
    }
};
