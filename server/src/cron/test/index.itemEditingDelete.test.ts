import { afterEach, expect, it, vi } from "vitest";
const start = vi.hoisted(() => vi.fn());
vi.mock("../itemEditingDelete.js", () => ({ startItemEditingDeleteCron: start }));
vi.mock("../buyDelete.js", () => ({ startBuyDeleteCron: vi.fn() }));
vi.mock("../commentSortDecay.js", () => ({ startCommentSortDecayCron: vi.fn() }));
vi.mock("../dataDelete.js", () => ({ DataDeleteCron: vi.fn() }));
vi.mock("../expiredMoney.js", () => ({ StartExpiredMoneyCron: vi.fn() }));
vi.mock("../itemSortDecay.js", () => ({ startItemSortDecayCron: vi.fn() }));
vi.mock("../token.js", () => ({ startTokenCron: vi.fn() }));
vi.mock("../trustScore.js", () => ({ startTrustScoreCron: vi.fn() }));
import { startAllCrons } from "../index.js";
afterEach(() => vi.restoreAllMocks());
it("C04: startAllCronsからItemEditing Cronを1回登録する", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    startAllCrons();
    expect(start).toHaveBeenCalledExactlyOnceWith();
});
