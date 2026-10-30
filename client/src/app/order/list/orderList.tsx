"use client";

import { fetcher } from "@/lib/fetcher";
import { faAnglesLeft, faAnglesRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Orders } from "../types";
import styles from "./order.module.css";

type Props = {
    page: "purchased" | "sold";
    tab: "all" | "wait" | "shipping" | "complete";
};

type Response = {
    ordersList: Orders[];
    totalPages: number;
};

export const OrderList = ({ page, tab }: Props) => {
    const [pageNumber, setPageNumber] = useState(1);

    // apiフェッチ
    const getApiQuery = () => {
        if (page === "purchased") {
            if (tab === "all") return `?type=purchased&page=${pageNumber}`;
            if (tab === "wait") return `?type=purchased&page=${pageNumber}&status=paid`;
            if (tab === "shipping") return `?type=purchased&page=${pageNumber}&status=shipped`;
            if (tab === "complete") return `?type=purchased&page=${pageNumber}&status=completed`;
        } else if (page === "sold") {
            if (tab === "all") return `?type=sold&page=${pageNumber}`;
            if (tab === "wait") return `?type=sold&page=${pageNumber}&status=paid`;
            if (tab === "shipping") return `?type=sold&page=${pageNumber}&status=shipped`;
            if (tab === "complete") return `?type=sold&page=${pageNumber}&status=completed`;
        }

        return null;
    };

    const apiQuery = getApiQuery();

    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/orders${apiQuery}`;

    const { data } = useSWR<Response>(apiUrl, fetcher);

    const ordersList = data?.ordersList;
    const totalPages = data?.totalPages ?? 1;

    // ページネーション
    const renderPagination = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
        if (totalPages <= 1) return null;

        const pages: (number | string)[] = [];
        const delta = typeof window !== "undefined" && window.innerWidth >= 768 ? 2 : 1;

        pages.push(1);

        if (currentPage - delta > 2) pages.push("...");

        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            pages.push(i);
        }

        if (currentPage + delta < totalPages - 1) pages.push("...");

        if (totalPages > 1) pages.push(totalPages);

        return (
            <div className={styles.pagination}>
                <button
                    type="button"
                    disabled={currentPage === 1}
                    className={styles.pageButtonIcon}
                    onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                    title="前へ"
                >
                    <FontAwesomeIcon icon={faAnglesLeft} className={styles.pageIcon} />
                </button>

                {pages.map((p, idx) =>
                    p === "..." ? (
                        <span key={idx} className={styles.ellipsis}>
                            ...
                        </span>
                    ) : (
                        <button
                            type="button"
                            key={idx}
                            className={`${styles.pageButton} ${currentPage === p ? styles.active : ""}`}
                            onClick={() => onPageChange(p as number)}
                        >
                            {p}
                        </button>
                    ),
                )}

                <button
                    type="button"
                    disabled={currentPage === totalPages}
                    className={styles.pageButtonIcon}
                    onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                    title="次へ"
                >
                    <FontAwesomeIcon icon={faAnglesRight} className={styles.pageIcon} />
                </button>
            </div>
        );
    };

    return (
        <>
            {ordersList && ordersList.length > 0 && (
                <main className={styles.orderListSection}>
                    {ordersList.map((order) => {
                        const link =
                            page === "purchased"
                                ? `/order/purchased/${order.id}`
                                : page === "sold"
                                  ? `/order/sold/${order.id}`
                                  : "";

                        return (
                            <section key={order.id} className={styles.orderSection}>
                                <div className={styles.orderFlex}>
                                    <Link href={link} className={styles.orderLinkArea}>
                                        <div className={styles.imageText}>
                                            <div className={styles.imageDiv}>
                                                <Image
                                                    src={order.purchase_snapshot.item_image || "/no-image(1x1).png"}
                                                    alt="商品画像"
                                                    width={80}
                                                    height={80}
                                                    className={styles.image}
                                                />
                                            </div>

                                            <div className={styles.itemTextArea}>
                                                <h2 className={`${styles.itemName} ${styles.line1}`}>
                                                    {order.purchase_snapshot.item_name || ""}
                                                </h2>

                                                <div
                                                    className={`${styles.transDiv} ${
                                                        ["cancelled", "returned"].includes(order.status)
                                                            ? styles.transCancel
                                                            : ""
                                                    }`}
                                                >
                                                    <p className={styles.transLabel}>配送状況：</p>
                                                    <p className={`${styles.transText} ${styles.line1}`}>
                                                        {order.Delivery?.DeliveryStatusOption?.name}
                                                    </p>
                                                </div>

                                                {["cancelled", "returned"].includes(order.status) && (
                                                    <p className={styles.cancel}>
                                                        {order.status === "returned" ? "返品" : "キャンセル"}
                                                    </p>
                                                )}
                                            </div>

                                            <div className={styles.priceColumn}>
                                                <h3 className={styles.price}>
                                                    ￥{order.total_amount.toLocaleString()}
                                                </h3>

                                                {page === "purchased" && order.point_used > 0 && (
                                                    <div className={styles.pointDiv}>
                                                        <p className={styles.pointLabel}>ポイント利用：</p>
                                                        <p className={styles.point}>
                                                            {order.point_used.toLocaleString()}P
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </section>
                        );
                    })}

                    {renderPagination(pageNumber, totalPages, (p) => {
                        setPageNumber(p);
                    })}
                </main>
            )}

            {ordersList?.length === 0 && (
                <p className={styles.noList}>
                    {page === "purchased"
                        ? "購入した商品がありません"
                        : page === "sold"
                          ? "売却した商品はありません"
                          : ""}
                </p>
            )}
        </>
    );
};
