import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, vi } from "vitest";
import { DraftItemList } from "@/app/item-list/draft/draftItemList";
import { base } from "./fixtures";

const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), back: vi.fn() }));
vi.mock("@/lib/getAccessToken", () => ({ getAccessToken: async () => "test-token" }));
vi.mock("react-hot-toast", () => ({ default: notifications }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: notifications.back }) }));
vi.mock("next/image", () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img {...props} />
    ),
}));

beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", base);
    vi.spyOn(window, "alert").mockImplementation(() => {});
    notifications.success.mockReset();
    notifications.error.mockReset();
    notifications.back.mockReset();
});
export const mount = (children: ReactNode = <DraftItemList />) =>
    render(
        <SWRConfig
            value={{
                provider: () => new Map(),
                revalidateOnFocus: false,
                revalidateOnReconnect: false,
                shouldRetryOnError: false,
                dedupingInterval: 0,
            }}
        >
            {children}
        </SWRConfig>,
    );
export const remove = async (name = "検証用シャツ101") => {
    const link = screen.getByRole("link", { name: new RegExp(name) });
    const section = link.closest("section");
    const icon = section?.querySelector('[data-icon="ellipsis-vertical"]');
    if (!icon) throw new Error("削除メニューがありません");
    const user = userEvent.setup();
    await user.click(icon);
    await user.click(screen.getByText("下書きから削除"));
};

export { notifications };
