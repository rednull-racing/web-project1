import { vi } from "vitest";
import type { Transaction } from "sequelize";
import { makeEditing, makeTarget } from "./fixtures.js";
const mocks = vi.hoisted(() => ({
    transaction: vi.fn(), getMyItemEditing: vi.fn(), getMyItemForUpdate: vi.fn(),
    getUser: vi.fn(), getCategories: vi.fn(), validateMaster: vi.fn(),
    updateVideo: vi.fn(), updateSale: vi.fn(), updateShipping: vi.fn(), updateItem: vi.fn(),
    deleteItemEditing: vi.fn(), createNotification: vi.fn(),
}));
vi.mock("../../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../src/services/itemEditing/query.js", () => ({ getMyItemEditing: mocks.getMyItemEditing }));
vi.mock("../../../../src/services/itemEditing/command.js", () => ({ deleteItemEditing: mocks.deleteItemEditing }));
vi.mock("../../../../src/services/items/query/relation.js", () => ({ getMyItemForUpdate: mocks.getMyItemForUpdate }));
vi.mock("../../../../src/services/items/command/update.js", () => ({ updateItem: mocks.updateItem }));
vi.mock("../../../../src/services/users/query.js", () => ({ getUser: mocks.getUser }));
vi.mock("../../../../src/services/categories/categories.js", () => ({ getCategories: mocks.getCategories }));
vi.mock("../../../../src/services/video/video.js", () => ({ updateVideo: mocks.updateVideo }));
vi.mock("../../../../src/services/sale/sale.js", () => ({ updateSale: mocks.updateSale }));
vi.mock("../../../../src/services/itemShippingProfile/itemShippingProfile.js", () => ({ updateShipping: mocks.updateShipping }));
vi.mock("../../../../src/services/notification/notification.js", () => ({ createNotification: mocks.createNotification }));
export const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
export const setup = () => {
    vi.resetAllMocks();
    const editing = makeEditing(), target = makeTarget();
    mocks.transaction.mockImplementation(async (callback: (t: Transaction) => Promise<unknown>) => callback(transaction));
    mocks.getMyItemEditing.mockResolvedValue(editing);
    mocks.getMyItemForUpdate.mockResolvedValue(target);
    mocks.getUser.mockResolvedValue({ id: 7, user_name: " ＵＳＥＲ " });
    mocks.validateMaster.mockResolvedValue({ id: 21, name: " シャツ ", parent_id: 28 });
    mocks.getCategories.mockResolvedValue({ id: 28, name: " ＴＯＰＳ " });
    for (const key of ["updateVideo", "updateSale", "updateShipping", "updateItem", "deleteItemEditing", "createNotification"] as const)
        mocks[key].mockResolvedValue(undefined);
    return { editing, target };
};

export { mocks };
