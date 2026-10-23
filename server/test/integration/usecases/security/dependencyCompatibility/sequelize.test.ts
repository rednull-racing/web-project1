import { createRequire } from "node:module";
import { DataTypes, Sequelize, Transaction } from "sequelize";
import { describe, expect, it } from "vitest";

const uuidPattern = (version: number) =>
    new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${version}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, "i");

const makeSequelize = () => new Sequelize({ dialect: "postgres", logging: false });

describe("P0: 修正済みuuidと実Sequelizeの互換性（DB非接続）", () => {
    it.each([
        [1, DataTypes.UUIDV1],
        [4, DataTypes.UUIDV4],
    ] as const)("N01: UUIDv%sのModel既定値生成と検証が成功する", async (version, defaultValue) => {
        const sequelize = makeSequelize();
        try {
            const Entry = sequelize.define("UuidCompatibility", {
                id: { type: DataTypes.UUID, defaultValue, primaryKey: true },
            });
            const first = Entry.build();
            const second = Entry.build();
            expect(first.get("id")).toMatch(uuidPattern(version));
            expect(second.get("id")).toMatch(uuidPattern(version));
            expect(first.get("id")).not.toBe(second.get("id"));
            await first.validate();
            await second.validate();
        } finally {
            await sequelize.close();
        }
    });

    it("N02: PostgreSQLのtransaction識別子を異なるUUIDv4として生成する", async () => {
        const sequelize = makeSequelize();
        try {
            const first = new Transaction(sequelize, {});
            const second = new Transaction(sequelize, {});
            expect(first).toHaveProperty("id", expect.stringMatching(uuidPattern(4)));
            expect(second).toHaveProperty("id", expect.stringMatching(uuidPattern(4)));
            expect(first).not.toHaveProperty("id", Reflect.get(second, "id"));
        } finally {
            await sequelize.close();
        }
    });

    it.each(["v3", "v5"] as const)("E01: ORM配下uuidの%sは出力bufferの境界超過を拒否する", (method) => {
        const ormRequire = createRequire(createRequire(import.meta.url).resolve("sequelize"));
        const uuid: Record<
            "v3" | "v5",
            (value: string, namespace: string, buffer: Uint8Array, offset: number) => unknown
        > = ormRequire("uuid");
        expect(() =>
            uuid[method]("security-regression", "6ba7b810-9dad-11d1-80b4-00c04fd430c8", new Uint8Array(8), 4),
        ).toThrow(RangeError);
    });
});
