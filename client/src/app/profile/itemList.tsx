"use client";

import { formatDuration } from "@/lib/formatDuration";
import { Items } from "@/types/itemListTypes";
import { faAnglesLeft, faAnglesRight, faList, faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "../../styles/components-style/profileItemList.module.css";
import { fetchIL, fetchVL } from "./api/itemList";
import pageStyle from "./profile.module.css";

type Res = {
    items: Items[] | null;
    hasItemCount: number;
    totalPages: number;
};

type Props = {
    userId: string;
    defaultVideoList: Res;
    adminPage?: boolean;
};

export const ItemList = ({ userId, defaultVideoList, adminPage }: Props) => {
    const [visibleIL, setVisibleIL] = useState(false);
    const [videoList, setVideoList] = useState<Items[] | null>(defaultVideoList.items);
    const [itemList, setItemList] = useState<Items[] | null>(null);
    const [pageVL, setPageVL] = useState(1);
    const [pageIL, setPageIL] = useState(1);
    const [totalPagesVL, setTotalPagesVL] = useState(defaultVideoList.totalPages);
    const [totalPagesIL, setTotalPagesIL] = useState(1);
    const [limitVL] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? 6 : 15));
    const [limitIL] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? 18 : 36));
    // 初回のモバイル向け取得は、従来どおりマウント時のユーザーを対象にする。
    const initialUserId = useRef(userId);

    useEffect(() => {
        const isDesktop = window.innerWidth >= 768;

        if (!isDesktop) {
            const loadVideoList = async () => {
                try {
                    const data = await fetchVL({ page: 1, limit: 6, userId: initialUserId.current });

                    setVideoList(data.items);
                    setVisibleIL(false);
                    setTotalPagesVL(data.totalPages);
                    setPageVL(1);
                } catch {}
            };

            loadVideoList();
        }
    }, []);

    const setVL = async (page: number, limit: number) => {
        try {
            const data = await fetchVL({ page, limit, userId });

            setVideoList(data.items);
            setVisibleIL(false);
            setTotalPagesVL(data.totalPages);
            setPageVL(page);
        } catch {}
    };

    const setIL = async (page: number, limit: number) => {
        try {
            const data = await fetchIL({ page, limit, userId });

            setItemList(data.items);
            setVisibleIL(true);
            setTotalPagesIL(data.totalPages);
            setPageIL(page);
        } catch {}
    };

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
                            className={clsx(styles.pageButton, currentPage === p && styles.active)}
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
        <div className="mt-4">
            <div className={pageStyle.itemHeader}>
                <p className={pageStyle.itemTitle}>出品した商品</p>

                {!visibleIL && (
                    <button type="button" className={styles.stateButton} onClick={() => setIL(1, limitIL)}>
                        <FontAwesomeIcon icon={faList} className={styles.stateIcon} />
                        商品一覧
                    </button>
                )}
                {visibleIL && (
                    <button type="button" className={styles.stateButton} onClick={() => setVL(1, limitVL)}>
                        <FontAwesomeIcon icon={faPlay} className={styles.stateIcon} />
                        動画一覧
                    </button>
                )}
            </div>

            <section className={styles.videoListWrapper}>
                {!visibleIL &&
                    videoList?.map((data) => {
                        if (!data) return null;
                        const itemLink = adminPage ? `/item/admin/${data.id}` : `/item/${data.id}`;

                        return (
                            <section className={styles.videoListSection} key={data.id}>
                                <Link href={itemLink} className={styles.thumbnail}>
                                    <Image
                                        src={
                                            data.Video?.thumbnail_url
                                                ? encodeURI(data.Video.thumbnail_url.trim())
                                                : "/no-image(16x9).png"
                                        }
                                        alt={data.Video?.title ?? "動画サムネイル"}
                                        fill
                                        priority={false}
                                    />

                                    <div className={styles.duration}>{formatDuration(data.Video?.duration)}</div>

                                    {data.status === "soldout" && (
                                        <div className={styles.soldoutOverlay}>
                                            <span className={styles.soldoutOverlayText}>SOLD OUT</span>
                                        </div>
                                    )}
                                </Link>

                                <div className={styles.itemData}>
                                    <Link href={itemLink} className={styles.videoUser}>
                                        <h4 className={styles.title}>{data.Video?.title}</h4>
                                    </Link>
                                    <Link href={itemLink} className={styles.itemNamePrice}>
                                        <p className={styles.syohin}>商品</p>
                                        <div className={styles.itemNameDiv}>
                                            <h2 className={styles.itemName}>{data.name}</h2>
                                        </div>
                                        <div className={styles.itemPriceSale}>
                                            {data.Sale?.sale_flag && (
                                                <p className={styles.beforePrice}>
                                                    ￥{data.Sale.before_price.toLocaleString()}
                                                </p>
                                            )}
                                            <h3 className={clsx(styles.price, data.Sale?.sale_flag ? styles.sale : "")}>
                                                ￥{data.price.toLocaleString()}
                                            </h3>
                                        </div>
                                    </Link>
                                </div>
                            </section>
                        );
                    })}
            </section>

            {!visibleIL &&
                renderPagination(pageVL, totalPagesVL, (p) => {
                    setPageVL(p);
                    setVL(p, limitVL);
                })}

            <section className={styles.itemListWrapper}>
                {visibleIL &&
                    itemList?.map((data) => {
                        if (!data) return null;
                        const itemLink = `/item/${data.id}`;

                        return (
                            <section className={styles.itemListSection} key={data.id}>
                                <Link href={itemLink}>
                                    <div className={styles.ILImageDiv}>
                                        <Image
                                            src={
                                                data.first_image_url
                                                    ? encodeURI(data.first_image_url.trim())
                                                    : "/no-image(1x1).png"
                                            }
                                            alt={data.name}
                                            fill
                                            sizes="(max-width: 768px) 33vw, 16.66vw"
                                            priority={false}
                                            className={styles.itemImage}
                                        />
                                        {data.status === "soldout" && (
                                            <div className={styles.ILSold}>
                                                <p className={styles.ILSoldP}>SOLD</p>
                                            </div>
                                        )}
                                        {data.Sale?.sale_flag && (
                                            <div className={styles.ILSaleDiv}>
                                                {data.Sale?.discount_rate > 0 && (
                                                    <p className={styles.ILSaleText}>{data.Sale.discount_rate}% OFF</p>
                                                )}
                                                {data.Sale?.discount_amount > 0 && (
                                                    <p className={styles.ILSaleText}>
                                                        {data.Sale.discount_amount.toLocaleString()}円引き
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        <div className={styles.ILPrice}>￥{data.price.toLocaleString()}</div>
                                    </div>
                                    <p className={clsx(styles.ILItemName, styles.line2)}>{data.name}</p>
                                </Link>
                            </section>
                        );
                    })}
            </section>

            {visibleIL &&
                renderPagination(pageIL, totalPagesIL, (p) => {
                    setPageIL(p);
                    setIL(p, limitIL);
                })}
        </div>
    );
};
