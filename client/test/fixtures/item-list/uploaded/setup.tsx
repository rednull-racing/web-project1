import { render } from "@testing-library/react";
import type { ImgHTMLAttributes, ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, vi } from "vitest";
import { base } from "./fixtures";
vi.mock("@/lib/getAccessToken", () => ({ getAccessToken: async () => "test-token" }));
vi.mock("next/image", () => ({
    default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img {...props} />
    ),
}));
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_URL", base));
export const mount = (children: ReactNode) =>
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
