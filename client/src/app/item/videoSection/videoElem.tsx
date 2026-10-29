"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";
import { fetchOnPlay } from "../api/video";
import styles from "./video.module.css";

type Props = {
    sellerMe?: boolean;
    normalPage?: boolean;
    data: {
        videoId?: string;
        thumbnailUrl: string;
        convertedUrl: string | null;
        originalUrl: string;
    };
};

export const VideoElem = ({ sellerMe, normalPage, data }: Props) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        const url = data.convertedUrl || data.originalUrl;
        if (!url) return;

        let hls: Hls | null = null;

        if (Hls.isSupported() && url.endsWith(".m3u8")) {
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(videoEl);
        } else {
            videoEl.src = url;
        }

        return () => {
            if (hls) hls.destroy();
        };
    }, [data]);

    const playCount = async () => {
        if (sellerMe || !normalPage || !data.videoId) return;

        fetchOnPlay(data.videoId);
    };

    return (
        <>
            {data.convertedUrl || data.originalUrl ? (
                <video
                    ref={videoRef}
                    controls
                    poster={data.thumbnailUrl ?? "/no-image(16x9).png"}
                    playsInline
                    onPlay={playCount}
                    className={styles.videoPlayer}
                >
                    お使いのブラウザは動画再生に対応していません。
                </video>
            ) : (
                <p className="text-base">動画がありません。</p>
            )}
        </>
    );
};
