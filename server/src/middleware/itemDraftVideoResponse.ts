import type { RequestHandler } from "express-serve-static-core";
import type { OutgoingHttpHeader, OutgoingHttpHeaders } from "node:http";

export const itemDraftVideoResponse: RequestHandler = (req, res, next) => {
    if (req.method === "PATCH" && /^\/api\/item-draft\/[^/]+\/convert\/?$/i.test(req.path)) {
        const writeHead = res.writeHead;
        // parser・認証も含め、内部の判定や本文を変えず送信時のHTTPだけを揃える。
        res.writeHead = function (
            _statusCode: number,
            statusMessageOrHeaders?: string | OutgoingHttpHeaders | OutgoingHttpHeader[],
            headers?: OutgoingHttpHeaders | OutgoingHttpHeader[],
        ) {
            this.statusMessage = "Accepted";
            return writeHead.call(
                this,
                202,
                typeof statusMessageOrHeaders === "string" ? headers : statusMessageOrHeaders,
            );
        };
    }
    next();
};
