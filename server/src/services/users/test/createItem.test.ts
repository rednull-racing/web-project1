import { beforeEach, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
const model = vi.hoisted(() => ({ create: vi.fn(), findOne: vi.fn(), findByPk: vi.fn(), count: vi.fn() }));
vi.mock("../../../models/index.js", () => ({ User: model }));
import { getUser } from "../query.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => vi.resetAllMocks());
it.each([true, false])("S07 S08: tあり=%s・列指定と返値/Error", async (withTransaction) => { const attributes: Parameters<typeof getUser>[0]["attributes"] = ["id", "user_name", "user_introduction", "penalty_points"]; const args = { userId: 7, attributes, ...(withTransaction ? { transaction } : {}) }; const row = { id: 7 }; model.findByPk.mockResolvedValueOnce(row).mockResolvedValueOnce(null); expect(await getUser(args)).toBe(row); expect(await getUser(args)).toBeNull(); expect(model.findByPk).toHaveBeenNthCalledWith(1, 7, { transaction: withTransaction ? transaction : undefined, attributes }); const failure = new Error("user"); model.findByPk.mockRejectedValueOnce(failure); await expect(getUser(args)).rejects.toBe(failure); });
it("S08: t/attributesなしの既存形式", async () => { model.findByPk.mockResolvedValue(null); expect(await getUser({ userId: 7 })).toBeNull(); expect(model.findByPk).toHaveBeenCalledExactlyOnceWith(7); });
