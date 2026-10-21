import { DatabaseError } from "sequelize";

export const invalidJsonResponse = { code: "INVALID_JSON", message: "JSONの形式を確認してください。" };
export const internalErrorResponse = { error: "INTERNAL_SERVER_ERROR", message: "サーバーエラーが発生しました" };
export const privateMarker = "test-only-private-input";

export const makeParseError = () =>
    Object.assign(new SyntaxError(`Unexpected token ${privateMarker}`), {
        type: "entity.parse.failed",
        status: 400,
        statusCode: 400,
        body: `{"token":"${privateMarker}",}`,
        expose: true,
    });
export const makeDatabaseError = () =>
    new DatabaseError(
        Object.assign(new Error(privateMarker), {
            sql: `SELECT '${privateMarker}'`,
            parameters: { token: privateMarker },
            code: "42P01",
        }),
    );
export const invalidBodies = [
    { label: "閉じ括弧欠落", body: `{"token":"${privateMarker}"` },
    { label: "末尾comma", body: `{"token":"${privateMarker}",}` },
    { label: "配列comma", body: "[1,]" },
    { label: "JSON外文字列", body: privateMarker },
];
