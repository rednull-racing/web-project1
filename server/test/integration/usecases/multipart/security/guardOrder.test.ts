import express from "express";
import type { ErrorRequestHandler, RequestHandler } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Route/実parserが対象。認証・Redis・controllerの先は境界で遮断する。
const mocks = vi.hoisted(() => ({
    auth: vi.fn<RequestHandler>(),
    limit: vi.fn<RequestHandler>(),
    controller: vi.fn<RequestHandler>(),
}));
vi.mock("../../../../../src/middleware/authMiddleware.js", () => ({ authenticateToken: mocks.auth }));
vi.mock("../../../../../src/controllers/shopSignup/shopSignup.js", () => ({
    getShopSignup1Controller: mocks.controller,
    getShopSignup2Controller: mocks.controller,
    getShopSignup3Controller: mocks.controller,
    getShopSignup5Controller: mocks.controller,
    getShopSignupAddressController: mocks.controller,
    getShopSignupBankAccountController: mocks.controller,
    getShopSignupConNameController: mocks.controller,
    getShopSignupFileController: mocks.controller,
    getShopSignupRepNameController: mocks.controller,
    shopSignupPostRootController: mocks.controller,
    updateShopSignup2Controller: mocks.controller,
    updateShopSignup3Controller: mocks.controller,
    updateShopSignup5Controller: mocks.controller,
    updateShopSignupEditController: mocks.controller,
    updateShopSignupOptionController: mocks.controller,
    updateShopSignupRepNameController: mocks.controller,
}));
vi.mock("../../../../../src/middleware/rateLimit/shopSignup.js", () => ({
    createShopSignupRateLimit: mocks.limit,
    getShopSignup1RateLimit: mocks.limit,
    getShopSignup2RateLimit: mocks.limit,
    getShopSignup3RateLimit: mocks.limit,
    getShopSignup5RateLimit: mocks.limit,
    getShopSignupAddressRateLimit: mocks.limit,
    getShopSignupBankAccountRateLimit: mocks.limit,
    getShopSignupConNameRateLimit: mocks.limit,
    getShopSignupFileRateLimit: mocks.limit,
    getShopSignupRepNameRateLimit: mocks.limit,
    shopSignup4RateLimit: mocks.limit,
    shopSignup5EditRateLimit: mocks.limit,
    shopSignup5RateLimit: mocks.limit,
    shopSignupRepNameEditRateLimit: mocks.limit,
    signup2RateLimit: mocks.limit,
    signup3RateLimit: mocks.limit,
}));
import router from "../../../../../src/routes/shopSignup.js";
const app = express();
app.use("/api/shop-signup", router);
const errors: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.sendStatus(400);
};
app.use(errors);
beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockImplementation((_req, _res, next) => {
        next();
    });
    mocks.limit.mockImplementation((_req, _res, next) => {
        next();
    });
});
describe("P0: ショップ身分証の実Routerにおける解析前拒否", () => {
    it("M06: 認証拒否は不正multipart解析前に401、制限とcontrollerを呼ばない", async () => {
        mocks.auth.mockImplementation((_req, res) => {
            res.sendStatus(401);
        });
        const result = await request(app)
            .patch("/api/shop-signup/123/id-card")
            .set("Content-Type", "multipart/form-data; boundary=broken")
            .send("malformed");
        expect(result.status).toBe(401);
        expect(mocks.auth).toHaveBeenCalledTimes(1);
        expect(mocks.limit).not.toHaveBeenCalled();
        expect(mocks.controller).not.toHaveBeenCalled();
    });
    it("M07: 制限拒否は不正multipart解析前に429、controllerを呼ばない", async () => {
        mocks.limit.mockImplementation((_req, res) => {
            res.sendStatus(429);
        });
        const result = await request(app)
            .patch("/api/shop-signup/123/id-card")
            .set("Content-Type", "multipart/form-data; boundary=broken")
            .send("malformed");
        expect(result.status).toBe(429);
        expect(mocks.auth).toHaveBeenCalledTimes(1);
        expect(mocks.limit).toHaveBeenCalledTimes(1);
        expect(mocks.controller).not.toHaveBeenCalled();
    });
    it("M08: 両境界通過時は実parserが同じ不正multipartを400で拒否する", async () => {
        const result = await request(app)
            .patch("/api/shop-signup/123/id-card")
            .set("Content-Type", "multipart/form-data; boundary=broken")
            .send("malformed");
        expect(result.status).toBe(400);
        expect(mocks.auth).toHaveBeenCalledTimes(1);
        expect(mocks.limit).toHaveBeenCalledTimes(1);
        expect(mocks.controller).not.toHaveBeenCalled();
    });
});
