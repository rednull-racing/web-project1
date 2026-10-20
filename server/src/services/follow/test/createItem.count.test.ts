import { beforeEach, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
const model = vi.hoisted(() => ({ create: vi.fn(), findOne: vi.fn(), findByPk: vi.fn(), count: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ Follow: model }));
import { countFollower } from "../follow.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => vi.resetAllMocks());
it.each([true, false])("S05 S06 S08: tあり=%sで集計条件・数値・Error", async (withTransaction) => { const args = { userId: 7, ...(withTransaction ? { transaction } : {}) }; model.count.mockResolvedValue(3); expect(await countFollower(args)).toBe(3); expect(model.count).toHaveBeenCalledExactlyOnceWith({ where: { follower_user_id: 7 }, ...(withTransaction ? { transaction } : {}) }); const failure = new Error("count"); model.count.mockRejectedValue(failure); await expect(countFollower(args)).rejects.toBe(failure); });
