import { render } from "@testing-library/react";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, vi } from "vitest";
import { TrashItemList } from "@/app/item-list/trash/trashItemList";
import { base } from "./fixtures";

vi.mock("@/lib/getAccessToken", () => ({ getAccessToken: async () => "test-token" }));
vi.mock("next/image", () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img {...props} />
    ),
}));
beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", base);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T00:00:00.000Z"));
});
export const mount = (children: ReactNode = <TrashItemList />) => render(
    <SWRConfig value={{
        provider: () => new Map(), revalidateOnFocus: false, revalidateOnReconnect: false,
        shouldRetryOnError: false, dedupingInterval: 0,
    }}>{children}</SWRConfig>,
);
