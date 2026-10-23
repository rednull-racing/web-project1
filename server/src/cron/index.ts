import { startBuyDeleteCron } from "./buyDelete.js";
import { startCommentSortDecayCron } from "./commentSortDecay.js";
import { DataDeleteCron } from "./dataDelete.js";
import { StartExpiredMoneyCron } from "./expiredMoney.js";
import { startItemEditingDeleteCron } from "./itemEditingDelete.js";
import { startItemSortDecayCron } from "./itemSortDecay.js";
import { startTokenCron } from "./token.js";
import { startTrustScoreCron } from "./trustScore.js";

export const startAllCrons = () => {
    console.log("Starting all cron job...");
    DataDeleteCron();
    startItemEditingDeleteCron();
    startItemSortDecayCron();
    startTokenCron();
    startCommentSortDecayCron();
    startBuyDeleteCron();
    startTrustScoreCron();
    StartExpiredMoneyCron();
};
