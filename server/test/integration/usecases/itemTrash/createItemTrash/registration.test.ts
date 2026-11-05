import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../../../../src/usecases/itemTrash/createItemTrash.js", () => ({ createItemTrashUseCase: mocks.create }));
vi.mock("../../../../../src/middleware/authMiddleware.js", () => ({
    authenticateToken: (req: Request, _res: Response, next: NextFunction) => {
        req.user = { id: 7, email: "registration@example.invalid", admin: false };
        next();
    },
}));
// 対象外Routerを遮断し、cronや実DBを初期化せず実registerRoutesを呼ぶ。
vi.mock("../../../../../src/routes/address.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/admin/itemAdmin.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/admin/userAdmin.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/auth.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/bankAccount.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/banks.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/branches.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/brands.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/cart.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/categories.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/comment.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/commentLike.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/commentReport.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/delivery.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/follow.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/idCard.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/inquiry.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/itemDraft.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/itemEditing.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/itemLike.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/itemReport.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/items.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/name.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/notification.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/orders.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/pointsHistory.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/purchaseSession.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/referenceCode.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/sale.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/search.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/shopInfo.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/shopInfoEdit.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/suggestWords.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/transfer.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/uriagekinHistory.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/users.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/users/me/items.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/video.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/watchHistory.js", () => ({ default: express.Router() }));

afterEach(() => {
    vi.restoreAllMocks();
});
it("HTTP-12: 実registerRoutesがPOST /api/item-trashを対象controllerへ接続", async () => {
    const { registerRoutes } = await import("../../../../../src/routes/index.js");
    const { errorHandler } = await import("../../../../../src/middleware/errorHandler.js");
    const app = express();
    app.use(express.json());
    registerRoutes(app);
    app.use(errorHandler);
    const r = await request(app).post("/api/item-trash").send({ itemId: 123 });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ message: "商品を削除しました" });
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemId: 123 });
});
