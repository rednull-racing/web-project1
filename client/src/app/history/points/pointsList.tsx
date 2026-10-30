"use client";

import { IconCoins, IconShoppingCart } from "@tabler/icons-react";
import { AlertMoney } from "../../../components";
import { useInfinitePagination } from "../../../hooks/useInfinitePagination";
import { formatRelativeTime } from "../../../lib/formatRelativeTime";
import { getPointsHistoryApiKey } from "../apiKey";
import styles from "../styles.module.css";
import { PointsHistory, PointsHistoryResponse, User } from "../types";

type Props = {
    user: User;
};

export const PointsList = ({ user }: Props) => {
    // 無限スクロール
    const { items: history, loadMoreRef } = useInfinitePagination<PointsHistoryResponse, PointsHistory>({
        apiKey: getPointsHistoryApiKey,
        getItems: (page) => page.history,
        hasMore: (page) => page.hasMore,
    });

    const pointLots = user.PointLots;

    return (
        <>
            <section className={styles.currentMoneySection}>
                <div className={styles.currentMoneyFlex}>
                    <p className={styles.currentMoneyTitle}>現在のポイント</p>

                    <p className={styles.currentMoney}>
                        <span className={styles.currentMoneyNumber}>{user.points.toLocaleString()}</span>pt
                    </p>
                </div>

                {pointLots && pointLots?.alertPoints > 0 && <AlertMoney pointLots={pointLots} mode="points" />}
            </section>

            {history.length > 0 && (
                <section className={styles.historyListWrapper}>
                    {history.map((pointsHistory) => {
                        if (!pointsHistory) return;
                        const plus = pointsHistory.points >= 0;

                        return (
                            <section className={styles.historySection} key={pointsHistory.id}>
                                <div className={`${styles.historyIconBox} ${plus ? styles.plus : styles.minus}`}>
                                    {plus ? (
                                        <IconCoins size={20} stroke={1.5} />
                                    ) : (
                                        <IconShoppingCart size={20} stroke={1.5} />
                                    )}
                                </div>

                                <div className={styles.historyInfo}>
                                    <p className={styles.reason}>{pointsHistory.PointReasonOption?.name}</p>

                                    <p className={styles.date}>{formatRelativeTime(pointsHistory.createdAt)}</p>
                                </div>

                                <span className={`${styles.value} ${plus ? styles.plus : styles.minus}`}>
                                    {plus ? "+" : ""}
                                    {pointsHistory.points.toLocaleString()}pt
                                </span>
                            </section>
                        );
                    })}
                </section>
            )}

            {history.length === 0 && <p className={styles.noHistory}>ポイント履歴がありません</p>}

            <div ref={loadMoreRef} />
        </>
    );
};
