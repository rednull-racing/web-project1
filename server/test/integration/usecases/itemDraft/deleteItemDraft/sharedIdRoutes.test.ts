import { randomBytes } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBody } from "../../../../fixtures/itemEditing/updateConfirm/fixtures.js";
const mocks = vi.hoisted(() => ({ reached: vi.fn() }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("../../../../../src/controllers/categories/categories.js", () => ({
    categoriesGetByIdLevel2Controller: mocks.reached,
}));
vi.mock("../../../../../src/controllers/itemEditing/itemEditing.js", () => ({
    createItemEditingController: mocks.reached,
    updateItemEditingConfirmController: mocks.reached,
    createItemEditingCopyController: mocks.reached,
    createItemEditingDraftController: mocks.reached,
}));
let app: ReturnType<typeof express>, secret: string;
beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    secret = randomBytes(32).toString("hex");
    vi.stubEnv("NEXTAUTH_SECRET", secret);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.reached.mockImplementation((_req, res) => {
        res.status(200).json({ reached: true });
    });
    const [{ default: categories }, { default: editing }, { errorHandler }] = await Promise.all([
        import("../../../../../src/routes/categories.js"),
        import("../../../../../src/routes/itemEditing.js"),
        import("../../../../../src/middleware/errorHandler.js"),
    ]);
    app = express();
    app.use(express.json());
    app.use("/api/categories", categories);
    app.use("/api/item-editing", editing);
    app.use(errorHandler);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});
describe("P1: 共有ID上限の既存Router回帰", () => {
    it.each(["読取", "更新"].flatMap((method) => [1, 2147483647, 2147483648].map((id) => ({ method, id }))))(
        "O05: $methodのid=$idは共通schemaに従う",
        async ({ method, id }) => {
            const req =
                method === "読取"
                    ? request(app).get(`/api/categories/${id}/level2`)
                    : request(app)
                          .put(`/api/item-editing/${id}`)
                          .set("Authorization", `Bearer ${jwt.sign({ id: 7 }, secret)}`)
                          .send(makeBody());
            const result = await req;
            expect(result.status).toBe(id <= 2147483647 ? 200 : 400);
            if (id <= 2147483647) {
                expect(mocks.reached).toHaveBeenCalledOnce();
                expect(mocks.reached.mock.calls[0][0].validatedParams).toEqual({ id });
            } else {
                expect(result.body).toEqual({ code: "INVALID_PARAMS", message: "INVALID_PARAMS" });
                expect(mocks.reached).not.toHaveBeenCalled();
            }
        },
    );
});
