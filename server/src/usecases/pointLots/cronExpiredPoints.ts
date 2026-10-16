import { getExpiredAll } from "../../services/pointLots/pointLots.js";
import { createPoint180 } from "../../services/pointsUriageOver/pointsUriageOver.js";

// 180日経過ポイント回収
export const cronExpiredPointsUseCase = async () => {
    const allExpiredData = await getExpiredAll({ expiredBefore: new Date() });

    let sumPoints = 0;

    for (const data of allExpiredData) {
        const available = data.points - data.used_points;

        await createPoint180({
            data: {
                points_180: available,
            },
        });

        sumPoints += available;
    }

    return {
        expiredCount: allExpiredData.length,
        sumPoints,
    };
};
