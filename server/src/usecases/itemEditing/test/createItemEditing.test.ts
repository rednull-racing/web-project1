import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../services/itemEditing/command.js", () => ({ createItemEditing: mocks.create }));
import { createItemEditingUseCase } from "../createItemEditing.js";

beforeEach(() => vi.resetAllMocks());

describe("P0: 新規編集セッションの初期状態", () => {
    it("N01: 認証ユーザーとstatus normalを指定して作成しIDを返す", async () => {
        mocks.create.mockResolvedValue({ id: 456 });

        expect(await createItemEditingUseCase({ userId: 7 })).toBe(456);
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({
            data: { status: "normal", item_id: null, seller_id: 7 },
        });
    });
});
