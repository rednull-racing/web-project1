import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../../../test/fixtures/server";
import { BrandInput, type BrandValue } from "../brandInput";
function setup(initial: BrandValue = { id: null, name: "" }) {
    const change = vi.fn();
    function Host() {
        const [value, set] = useState(initial);
        return (
            <BrandInput
                value={value}
                onChange={(next) => {
                    change(next);
                    set(next);
                }}
            />
        );
    }
    return { ...render(<Host />), change };
}
beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test");
});
describe("BrandInput", () => {
    it("U11 300ms debounce・候補選択・選択中検索抑止", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const requests: string[] = [];
        server.use(
            http.get("https://api.test/brands/suggest", ({ request }) => {
                requests.push(new URL(request.url).searchParams.get("keyword") ?? "");
                return HttpResponse.json({ brands: [{ id: "4", name: "BrandA", name_normalized: "branda" }] });
            }),
        );
        const { change } = setup();
        const input = screen.getByPlaceholderText("ブランド名を入力");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "B" } });
        await act(() => vi.advanceTimersByTimeAsync(100));
        fireEvent.change(input, { target: { value: "Br" } });
        await act(() => vi.advanceTimersByTimeAsync(299));
        expect(requests).toEqual([]);
        await act(() => vi.advanceTimersByTimeAsync(1));
        await waitFor(() => expect(requests).toEqual(["Br"]));
        fireEvent.mouseDown(await screen.findByText("BrandA"));
        expect(change).toHaveBeenLastCalledWith({ id: "4", name: "BrandA" });
        await act(() => vi.advanceTimersByTimeAsync(499));
        expect(requests).toEqual(["Br"]);
        await act(() => vi.advanceTimersByTimeAsync(301));
        await waitFor(() => expect(requests).toEqual(["Br", "BrandA"]));
        fireEvent.focus(input);
        expect(await screen.findByText("BrandA")).toBeInTheDocument();
        fireEvent.blur(input);
        await act(() => vi.advanceTimersByTimeAsync(150));
        expect(screen.queryByText("BrandA")).not.toBeInTheDocument();
    });
    it.each(["empty", "http", "network", "json"])("U11 %sの候補失敗/空応答", async (kind) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const request = vi.fn();
        server.use(
            http.get("https://api.test/brands/suggest", () => {
                request();
                return kind === "network"
                    ? HttpResponse.error()
                    : kind === "json"
                      ? new HttpResponse("invalid")
                      : HttpResponse.json(kind === "http" ? { message: "error" } : { brands: [] }, {
                            status: kind === "http" ? 500 : 200,
                        });
            }),
        );
        setup();
        await userEvent.type(screen.getByPlaceholderText("ブランド名を入力"), "x");
        await waitFor(() => expect(request).toHaveBeenCalledOnce());
        expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    });
    it("U11 unmountで予約検索を解除", async () => {
        vi.useFakeTimers();
        const request = vi.fn();
        server.use(
            http.get("https://api.test/brands/suggest", () => {
                request();
                return HttpResponse.json({ brands: [] });
            }),
        );
        const { unmount } = setup();
        fireEvent.change(screen.getByPlaceholderText("ブランド名を入力"), { target: { value: "ABC" } });
        unmount();
        await act(() => vi.advanceTimersByTimeAsync(1000));
        expect(request).not.toHaveBeenCalled();
    });
    it("AF-F7 選択済みブランドの手入力変更でidをクリア", () => {
        vi.useFakeTimers();
        const { change } = setup({ id: "4", name: "BrandA" });
        fireEvent.change(screen.getByPlaceholderText("ブランド名を入力"), { target: { value: "別ブランド" } });
        expect(change).toHaveBeenCalledWith({ id: null, name: "別ブランド" });
    });
    it("AF-F7 検索語&/#をencodeして全文を送る", async () => {
        const urls: string[] = [];
        server.use(
            http.get("https://api.test/brands/suggest", ({ request }) => {
                urls.push(request.url);
                return HttpResponse.json({ brands: [] });
            }),
        );
        setup();
        fireEvent.change(screen.getByPlaceholderText("ブランド名を入力"), { target: { value: "A&B#C" } });
        await waitFor(() => expect(urls).toHaveLength(1));
        expect(new URL(urls[0]).searchParams.get("keyword")).toBe("A&B#C");
    });
    it("U11 外部から空入力へ変更すると候補を消し、再入力でも古い候補を復活させない", async () => {
        server.use(
            http.get("https://api.test/brands/suggest", ({ request }) => {
                const keyword = new URL(request.url).searchParams.get("keyword") ?? "";
                return HttpResponse.json({
                    brands: [{ id: keyword, name: `候補${keyword}`, name_normalized: keyword }],
                });
            }),
        );
        const onChange = vi.fn();
        const { rerender } = render(<BrandInput value={{ id: null, name: "A" }} onChange={onChange} />);
        fireEvent.focus(screen.getByPlaceholderText("ブランド名を入力"));
        expect(await screen.findByText("候補A")).toBeInTheDocument();

        rerender(<BrandInput value={{ id: null, name: "" }} onChange={onChange} />);
        expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
        rerender(<BrandInput value={{ id: null, name: "B" }} onChange={onChange} />);
        expect(screen.queryByText("候補A")).not.toBeInTheDocument();
        expect(await screen.findByText("候補B")).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });
    it("AF-F7 古い応答は新しいブランド候補を上書きしない", async () => {
        let release!: () => void;
        const delayed = new Promise<void>((resolve) => {
            release = resolve;
        });
        let started = false;
        server.use(
            http.get("https://api.test/brands/suggest", async ({ request }) => {
                const keyword = new URL(request.url).searchParams.get("keyword");
                if (keyword === "A") {
                    started = true;
                    await delayed;
                }
                return HttpResponse.json({
                    brands: [{ id: keyword, name: `候補${keyword}`, name_normalized: keyword }],
                });
            }),
        );
        const originalFetch = globalThis.fetch;
        let oldParsed = false;
        vi.spyOn(globalThis, "fetch").mockImplementation(async (...args) => {
            const response = await originalFetch(...args);
            if (String(args[0]).includes("keyword=A")) {
                const parse = response.json.bind(response);
                response.json = async () => {
                    const data = await parse();
                    oldParsed = true;
                    return data;
                };
            }
            return response;
        });
        setup();
        const input = screen.getByPlaceholderText("ブランド名を入力");
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "A" } });
        await waitFor(() => expect(started).toBe(true));
        fireEvent.change(input, { target: { value: "B" } });
        expect(await screen.findByText("候補B")).toBeInTheDocument();
        await act(async () => {
            release();
        });
        await waitFor(() => expect(oldParsed).toBe(true));
        await waitFor(() => expect(screen.getByText("候補B")).toBeInTheDocument());
        expect(screen.queryByText("候補A")).not.toBeInTheDocument();
    });
});
