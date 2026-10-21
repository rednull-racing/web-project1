import cron from "node-cron";
import { cronDeleteItemEditingUseCase } from "../usecases/itemEditing/cronDeleteItemEditing.js";

export const startItemEditingDeleteCron = () => {
    // cron 3日経過ItemEditing削除
    cron.schedule(
        "0 12 * * *",
        async () => {
            try {
                const deleteCount = await cronDeleteItemEditingUseCase();

                console.log(`[cron] ${deleteCount}件の3日経過ItemEditingを削除しました。`);
            } catch (err) {
                console.error("[cron] ItemEditing削除エラー", err);
            }
        },
        { timezone: "Asia/Tokyo" },
    );
};
