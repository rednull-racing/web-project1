import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export const startConfirmApi = async (port = 4031) => {
    const entries = new Map();
    const unknown = [];
    const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
        if (req.method === "OPTIONS") { res.end(); return; }
        if (url.pathname === "/__test__/editing" && req.method === "POST") {
            const chunks = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const entry = JSON.parse(Buffer.concat(chunks).toString());
            entries.set(String(entry.editing.id), { ...entry, requests: 0, metadataRequests: 0 });
            res.end(JSON.stringify({ ok: true }));
            return;
        }
        if (url.pathname === "/__test__/state") {
            res.end(JSON.stringify({ entries: Object.fromEntries(entries), unknown }));
            return;
        }
        const match = /^\/item-editing\/(\d+)\/(confirm|metadata)$/.exec(url.pathname);
        if (match && req.method === "GET") {
            const entry = entries.get(match[1]);
            if (!entry) { res.statusCode = 404; res.end(JSON.stringify({ code: "ITEM_EDITING_NOT_FOUND" })); return; }
            const metadata = match[2] === "metadata";
            if (metadata) entry.metadataRequests++;
            else entry.requests++;
            const encoded = req.headers.authorization?.split(".")[1];
            let owner;
            try { owner = JSON.parse(Buffer.from(encoded ?? "", "base64url").toString()).id; } catch { owner = null; }
            const status = (metadata ? entry.metadataStatus : entry.status) ?? (Number(owner) === entry.editing.seller_id || entry.allowForeign ? 200 : 404);
            if (entry.delayMs) await new Promise((resolve) => setTimeout(resolve, entry.delayMs));
            res.statusCode = status;
            res.end(JSON.stringify(status === 200 ? {
                itemEditing: metadata ? {
                    id: entry.editing.id,
                    name: Object.hasOwn(entry, "metadataName") ? entry.metadataName : entry.editing.name,
                } : entry.editing,
            } : { code: "TEST_ERROR" }));
            return;
        }
        // ページ外のlayout等からの通信は記録する。確認APIの予期しない呼出しを成功扱いしない。
        unknown.push(`${req.method} ${url.pathname}`);
        res.statusCode = 501;
        res.end(JSON.stringify({ code: "UNEXPECTED_TEST_API" }));
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
    return { close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await startConfirmApi(Number(process.env.ITEM_CONFIRM_BROWSER_API_PORT ?? 4031));
}
