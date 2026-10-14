import cron from "node-cron";
import { cronPerfectDeleteUseCase } from "../usecases/items/cron/cronPerfectDelete.js";

export const startItemDeleteCron = () => {
    // 論理削除後30日経過item削除、ItemDeleteLogs作成
    cron.schedule(
        "0 12 * * *",
        async () => {
            try {
                const deletedCount = await cronPerfectDeleteUseCase();

                if (deletedCount === 0) {
                    console.log("[cron] 30日削除アイテムはありません。");
                    return;
                }

                console.log(`[cron] 30日経過アイテムを${deletedCount}件削除しました。`);
            } catch (err) {
                console.error("[cron] itemDeleteエラー：", err);
            }
        },
        {
            timezone: "Asia/Tokyo",
        },
    );
};
