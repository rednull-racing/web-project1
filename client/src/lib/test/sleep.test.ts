// @vitest-environment node
import { expect, it, vi } from "vitest";
import { sleep } from "../sleep";
import { formatRelativeTime } from "../formatRelativeTime";
it("U-S09 sleepは1499msで未完了、1500msで解決", async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const pending = sleep(1500).then(done);
    await vi.advanceTimersByTimeAsync(1499);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(done).toHaveBeenCalledOnce();
});
it.each([59, 60, 3540, 3600, 82800, 86400, 604800, 691200])("U-S09 %s秒前のDate/ISO表示は同値", (seconds) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T03:00:00Z"));
    const date = new Date(Date.now() - seconds * 1000);
    expect(formatRelativeTime(date)).toBe(formatRelativeTime(date.toISOString()));
});
