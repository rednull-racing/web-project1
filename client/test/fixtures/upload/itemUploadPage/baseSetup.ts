import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    token: vi.fn<() => Promise<string | null>>(),
    success: vi.fn(),
    error: vi.fn(),
    assign: vi.fn(),
    back: vi.fn(),
    sleep: vi.fn<(ms: number) => Promise<unknown>>(),
}));
vi.mock("@/lib/getAccessToken", () => ({ getAccessToken: mocked.token }));
vi.mock("@/lib/sleep", () => ({ sleep: mocked.sleep }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: mocked.back, push: vi.fn() }) }));
vi.mock("react-hot-toast", () => ({ default: { success: mocked.success, error: mocked.error } }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props) }));
// barrelの無関係なServer Componentを除外し、利用する3部品は実装を実行する。
vi.mock("@/components", async () => ({
    Container: (await import("@/components/container/container")).Container,
    TitleAndBack: (await import("@/components/title-back/title-back")).TitleAndBack,
    TopLoader: (await import("@/components/loading/topLoader")).TopLoader,
}));
const originalCreateURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
afterEach(() => {
    for (const [name, descriptor] of [
        ["createObjectURL", originalCreateURL],
        ["revokeObjectURL", originalRevokeURL],
    ] as const) {
        if (descriptor) Object.defineProperty(URL, name, descriptor);
        else Reflect.deleteProperty(URL, name);
    }
});
export const API = "http://upload-api.test";
beforeEach(() => {
    Object.values(mocked).forEach((mock) => mock.mockReset());
    mocked.token.mockResolvedValue("test-access-token");
    mocked.sleep.mockResolvedValue(undefined);
    vi.stubEnv("NEXT_PUBLIC_API_URL", API);
    // jsdomのLocation.assignは置換不可。window参照のlocationだけを観測用にする。
    const original = globalThis.window;
    vi.stubGlobal(
        "window",
        new Proxy(original, {
            get(target, key) {
                return key === "location" ? { assign: mocked.assign } : Reflect.get(target, key);
            },
        }),
    );
    vi.spyOn(globalThis, "alert").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: vi.fn(() => "blob:test-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
});

export const runtime = mocked;
