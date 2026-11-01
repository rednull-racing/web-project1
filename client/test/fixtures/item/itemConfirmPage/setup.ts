import "./dialog";
import { createElement, type ImgHTMLAttributes, type ReactNode } from "react";
import { beforeEach, vi } from "vitest";

const mocked = vi.hoisted(() => ({
    push: vi.fn(),
    back: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    token: vi.fn<() => Promise<string | null>>(),
    sleep: vi.fn<(ms: number) => Promise<unknown>>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocked.push, back: mocked.back }) }));
vi.mock("react-hot-toast", () => ({ default: { error: mocked.error, success: mocked.success } }));
vi.mock("@/lib/getAccessToken", () => ({ getAccessToken: mocked.token }));
vi.mock("@/lib/sleep", () => ({ sleep: mocked.sleep }));
vi.mock("next/image", () => ({
    default: ({
        fill,
        priority,
        ...props
    }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
        void fill;
        void priority;
        return createElement("img", props);
    },
}));
vi.mock("swiper/react", () => ({
    Swiper: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    SwiperSlide: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
// 非同期Server Componentの保証はPlaywrightへ分離する。
vi.mock("@/app/item/videoSection/videoTitle", () => ({
    VideoTitle: ({ title }: { title: string }) => createElement("h3", null, title),
}));
vi.mock("@/components", async () => ({
    Back: (await vi.importActual<typeof import("@/components/title-back/back")>("@/components/title-back/back")).Back,
    Container: (
        await vi.importActual<typeof import("@/components/container/container")>("@/components/container/container")
    ).Container,
}));

beforeEach(() => {
    mocked.push.mockReset();
    mocked.back.mockReset();
    mocked.error.mockReset();
    mocked.success.mockReset();
    mocked.token.mockReset().mockResolvedValue("test-access-token");
    mocked.sleep.mockReset().mockResolvedValue(undefined);
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://confirm-api.test");
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
});
export const API = "http://confirm-api.test";

export const runtime = mocked;
