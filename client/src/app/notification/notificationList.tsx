"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useInfinitePagination } from "../../hooks/useInfinitePagination";
import { ApiError } from "../../lib/api/apiError";
import { formatRelativeTime } from "../../lib/formatRelativeTime";
import { fetchReadTrue } from "./api/client";
import { getNotificationApiKey } from "./getApiKey";
import styles from "./styles.module.css";
import { Notification, NotificationResponse } from "./types";

export const NotificationList = () => {
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

    const router = useRouter();

    // 無限スクロール
    const {
        data,
        items: notificationList,
        mutate,
        loadMoreRef,
    } = useInfinitePagination<NotificationResponse, Notification>({
        apiKey: getNotificationApiKey,
        getItems: (page) => page.notificationList,
        hasMore: (page) => page.hasMore,
    });

    const unreadCount = data?.[0]?.unreadCount;

    // 既読
    const read = async (id: string) => {
        mutate(
            (current) =>
                current
                    ? current.map((page) => ({
                          ...page,
                          notificationList: page.notificationList.map((n) =>
                              n.id === id ? { ...n, read_flag: true } : n,
                          ),
                      }))
                    : undefined,
            false,
        );

        try {
            await fetchReadTrue(id);

            mutate();
        } catch (err) {
            mutate();

            if (err instanceof ApiError) return;

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    // シートアニメーション
    const sheetRef = useRef<HTMLDivElement>(null);

    const closeSheet = () => {
        const sheet = sheetRef.current;
        if (!sheet) return;

        sheet.classList.add(`${styles.closing}`);
        sheet.addEventListener(
            "animationend",
            () => {
                setSelectedNotification(null);
            },
            { once: true },
        );
    };

    return (
        <>
            <section className={styles.unreadCountSection}>
                <small className={styles.unreadCountText}>
                    未読
                    <span className={styles.countSpan}>{unreadCount?.toLocaleString()}</span>件
                </small>
            </section>

            {notificationList.length > 0 && (
                <section className={styles.notificationListSection}>
                    {notificationList.map((notification) => {
                        const messageStyle = notification.read_flag
                            ? styles.message
                            : `${styles.message} ${styles.unreadMessage}`;

                        return (
                            <section
                                key={notification.id}
                                className={styles.notificationSection}
                                onClick={() => {
                                    read(notification.id);
                                    if (notification.url) {
                                        router.push(notification.url);
                                        return;
                                    }
                                    // urlが無いときだけボトムシートを開く
                                    setSelectedNotification(notification);
                                }}
                            >
                                <Image
                                    src={notification.message_image ?? "/logo.png"}
                                    alt="お知らせ画像"
                                    width={45}
                                    height={45}
                                    className={styles.messageImage}
                                />

                                <div className={styles.textBlock}>
                                    <p className={messageStyle}>{notification.message}</p>
                                    <p className={styles.date}>{formatRelativeTime(notification.createdAt)}</p>
                                </div>
                            </section>
                        );
                    })}
                </section>
            )}

            {notificationList.length === 0 && <p className={styles.noNotification}>お知らせはありません</p>}

            {selectedNotification && (
                <>
                    <div className={styles.overlay} onClick={closeSheet} />

                    <section className={styles.sheet} ref={sheetRef}>
                        <div className={styles.handle} onClick={closeSheet} />

                        <div className={styles.sheetFlex}>
                            <Image
                                src={selectedNotification.message_image ?? "/logo.png"}
                                alt="お知らせ画像"
                                width={45}
                                height={45}
                                className={styles.messageImage}
                            />

                            <div className={styles.sheetTextBlock}>
                                <p className={styles.sheetMessage}>{selectedNotification.message}</p>
                                <p className={styles.sheetDate}>{formatRelativeTime(selectedNotification.createdAt)}</p>
                            </div>
                        </div>
                    </section>
                </>
            )}

            <div ref={loadMoreRef} />
        </>
    );
};
