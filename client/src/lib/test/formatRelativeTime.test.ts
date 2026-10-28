// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "../formatRelativeTime";

const now = new Date("2026-10-28T03:00:00Z");
beforeEach(() => {
    vi.stubEnv("TZ", "Asia/Tokyo");
});
describe("保存日時の相対表示", () => {
    it.each([
        [59, "1分前"],
        [60, "1分前"],
        [59 * 60, "59分前"],
        [60 * 60, "1時間前"],
        [23 * 3600, "23時間前"],
        [24 * 3600, "1日前"],
        [7 * 86400, "7日前"],
    ])("U-V06 %s秒前は%s", (seconds, expected) => {
        vi.useFakeTimers();
        vi.setSystemTime(now);
        expect(formatRelativeTime(new Date(now.getTime() - seconds * 1000).toISOString())).toBe(expected);
    });
    it("U-V06 8日前はja-JP日付になる", () => {
        vi.useFakeTimers();
        vi.setSystemTime(now);
        const date = new Date(now.getTime() - 8 * 86400 * 1000);
        expect(formatRelativeTime(date)).toBe("2026/10/20");
    });
});
