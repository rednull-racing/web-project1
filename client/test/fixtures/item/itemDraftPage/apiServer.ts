import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import type { ItemDraft } from "../../../../src/app/item/draft/types";

type Entry = { draft: ItemDraft; status?: number; disconnect?: boolean; requests: number };
export const startDraftApi = async (port = 4011) => {
    const entries = new Map<string, Entry>();
    const unknown: string[] = [];
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
        if (req.method === "OPTIONS") {
            res.end();
            return;
        }
        if (url.pathname === "/__test__/draft" && req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const entry = JSON.parse(Buffer.concat(chunks).toString()) as Entry;
            entries.set(String(entry.draft.id), { ...entry, requests: 0 });
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (url.pathname === "/__test__/state") {
            res.end(JSON.stringify({ entries: Object.fromEntries(entries), unknown }));
            return;
        }
        const match = /^\/item-draft\/(\d+)$/.exec(url.pathname);
        if (match && req.method === "GET") {
            const entry = entries.get(match[1]);
            if (!entry) {
                res.statusCode = 404;
                res.end(JSON.stringify({ code: "ITEM_DRAFT_NOT_FOUND" }));
                return;
            }
            entry.requests++;
            if (entry.disconnect) {
                req.socket.destroy();
                return;
            }
            res.statusCode = entry.status ?? 200;
            res.end(JSON.stringify(res.statusCode === 200 ? { itemDraft: entry.draft } : { code: "TEST_ERROR" }));
            return;
        }
        unknown.push(`${req.method} ${url.pathname}`);
        res.statusCode = 501;
        res.end(JSON.stringify({ code: "UNEXPECTED_TEST_API", path: url.pathname }));
    });
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
    });
    return {
        close: () =>
            new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    };
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await startDraftApi(Number(process.env.ITEM_DRAFT_BROWSER_API_PORT ?? 4011));
}
