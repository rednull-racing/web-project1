"use client";

import { IconCoins, IconShoppingCart } from "@tabler/icons-react";
import { AlertMoney } from "../../../components";
import { useInfinitePagination } from "../../../hooks/useInfinitePagination";
import { formatRelativeTime } from "../../../lib/formatRelativeTime";
import { getUriagekinHistoryApiKey } from "../apiKey";
import styles from "../styles.module.css";
import { UriagekinHistory, UriagekinHistoryResponse, User } from "../types";

type Props = {
    user: User;
};

export const UriagekinList = ({ user }: Props) => {
    // 無限スクロール
    const { items: history, loadMoreRef } = useInfinitePagination<UriagekinHistoryResponse, UriagekinHistory>({
        apiKey: getUriagekinHistoryApiKey,
        getItems: (page) => page.history,
        hasMore: (page) => page.hasMore,
    });

    const uriagekinLots = user.UriagekinLots;

    return (
        <>
            <section className={styles.currentMoneySection}>
                <div className={styles.currentMoneyFlex}>
                    <p className={styles.currentMoneyTitle}>現在の売上金</p>

                    <p className={styles.currentMoney}>
                        <span className={styles.currentMoneyNumber}>￥{user.uriagekin.toLocaleString()}</span>
                    </p>
                </div>

                {uriagekinLots && uriagekinLots?.alertUriagekin > 0 && (
                    <AlertMoney uriagekinLots={uriagekinLots} mode="uriagekin" />
                )}
            </section>

            {history.length > 0 && (
                <section className={styles.historyListWrapper}>
                    {history.map((uriagekinHistory) => {
                        if (!uriagekinHistory) return;
                        const plus = uriagekinHistory.uriagekin >= 0;

                        return (
                            <section className={styles.historySection} key={uriagekinHistory.id}>
                                <div className={`${styles.historyIconBox} ${plus ? styles.plus : styles.minus}`}>
                                    {plus ? (
                                        <IconShoppingCart size={20} stroke={1.5} />
                                    ) : (
                                        <IconCoins size={20} stroke={1.5} />
                                    )}
                                </div>

                                <div className={styles.historyInfo}>
                                    <p className={styles.reason}>{uriagekinHistory.UriagekinReasonOption?.name}</p>

                                    <p className={styles.date}>{formatRelativeTime(uriagekinHistory.createdAt)}</p>
                                </div>

                                <span className={`${styles.value} ${plus ? styles.plus : styles.minus}`}>
                                    {plus ? "+" : ""}
                                    {uriagekinHistory.uriagekin.toLocaleString()}円
                                </span>
                            </section>
                        );
                    })}
                </section>
            )}

            {history.length === 0 && <p className={styles.noHistory}>売上金履歴がありません</p>}

            <div ref={loadMoreRef} />
        </>
    );
};
