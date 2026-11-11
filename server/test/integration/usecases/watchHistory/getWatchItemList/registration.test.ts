import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { afterEach, expect, it, vi } from "vitest";

import "../../../../fixtures/watchHistory/getWatchItemList/httpMocks.js";
vi.mock("../../../../../src/usecases/watchHistory/getWatchItemList.js", () => ({
    getWatchItemListUseCase: vi.fn().mockResolvedValue({ itemList: [], totalPages: 0 }),
}));
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
vi.mock("../../../../../src/routes/itemTrash.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/itemEditing.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/items.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/itemReport.js", () => ({ default: express.Router() }));
vi.mock("../../../../../src/routes/itemDraft.js", () => ({ default: express.Router() }));
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
vi.mock("../../../../../src/routes/itemLike.js", () => ({ default: express.Router() }));

afterEach(() => {
    vi.restoreAllMocks();
});
it("H09: 実registerRoutesがGET /api/watch-history/item-listを接続", async () => {
    const { registerRoutes } = await import("../../../../../src/routes/index.js");
    const { getWatchItemListUseCase } = await import("../../../../../src/usecases/watchHistory/getWatchItemList.js");
    const app = express();
    registerRoutes(app);
    const response = await request(app).get("/api/watch-history/item-list?page=2");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ itemList: [], totalPages: 0 });
    expect(getWatchItemListUseCase).toHaveBeenCalledExactlyOnceWith({
        userId: 7,
        page: 2,
        status: undefined,
        keyword: null,
    });
});
