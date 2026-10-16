import type { Request, Response } from "express-serve-static-core";
import { convertVideoUseCase } from "../../usecases/video/convert.js";
import { onPlayVideoUseCase } from "../../usecases/video/onPlay.js";
import { runDetachedTask } from "../../utils/runDetachedTask.js";

// PATCH /video/:id/onplay
// summary: 動画再生ログ更新
// page: /item
export const videoPatchByIdOnplayController = async (req: Request, res: Response): Promise<void> => {
    const videoId = Number(req.params.id);

    const userId = req.user?.id ?? null;

    runDetachedTask({
        taskName: "patchVideoOnPlay",
        target: { videoId },
        task: () => onPlayVideoUseCase({ videoId, userId }),
    });

    res.status(200).json({ message: "再生回数追加成功！" });
};

// PATCH /video/:id/convert
// summary: 動画HLS変換
// page: /upload
export const videoPatchByIdConvertController = async (req: Request, res: Response): Promise<void> => {
    const videoId = Number(req.params.id);

    const userId = req.user!.id;

    runDetachedTask({
        taskName: "convertVideo",
        target: { videoId },
        task: () => convertVideoUseCase({ videoId, userId }),
    });

    res.status(202).json({ message: "変換処理を受け付けました" });
};
