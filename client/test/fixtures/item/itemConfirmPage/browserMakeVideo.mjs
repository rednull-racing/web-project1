// 自作canvasの短いH.264動画。再生検証は静的MP4を使い、対象ブラウザーの録画APIには依存しない。
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    const body = await page.evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas context required");
        context.fillStyle = "red";
        context.fillRect(0, 0, 64, 64);
        const stream = canvas.captureStream(10);
        const mimeType = "video/mp4;codecs=avc1.42E01E";
        if (!MediaRecorder.isTypeSupported(mimeType))
            throw new Error("fixture generator requires MP4/H.264 recording support");
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks = [];
        const stopped = new Promise((resolve, reject) => {
            recorder.ondataavailable = (event) => chunks.push(event.data);
            recorder.onstop = resolve;
            recorder.onerror = () => reject(new Error("fixture encoding failed"));
        });
        recorder.start();
        const interval = setInterval(() => {
            context.fillStyle = context.fillStyle === "#ff0000" ? "blue" : "red";
            context.fillRect(0, 0, 64, 64);
        }, 50);
        setTimeout(() => {
            clearInterval(interval);
            recorder.stop();
            stream.getTracks().forEach((track) => track.stop());
        }, 600);
        await stopped;
        const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
        return btoa(String.fromCharCode(...bytes));
    });
    await writeFile(new URL("browserVideo.mp4", import.meta.url), Buffer.from(body, "base64"));
} finally {
    await browser.close();
}
