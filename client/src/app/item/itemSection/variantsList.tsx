"use client";

import Image from "next/image";
import { useState } from "react";
import { ItemAttributes } from "../../../types/itemAttributes";
import styles from "./variants.module.css";

type Props = {
    itemAttributes: ItemAttributes;
};

export const VariantsList = ({ itemAttributes }: Props) => {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className={styles.variantList}>
            {itemAttributes.colorVariants?.map((variant, i) => {
                if (!variant) return null;
                const initialInventory = variant.inventory?.initial ?? 0;
                const currentInventory = variant.inventory?.current ?? 0;

                const isSoldout = currentInventory === 0;
                const isLowStock =
                    currentInventory > 0 && currentInventory / initialInventory <= (variant.inventory?.low_stock_ratio ?? 0.2);

                return (
                    <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        aria-label={variant.color ?? "バリエーション"}
                        aria-expanded={openIndex === i}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setOpenIndex(openIndex === i ? null : i);
                            }
                        }}
                        className={`
                        ${styles.variantCard}
                        ${openIndex === i ? styles.active : ""}
                    `}
                        onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    >
                        <div className={styles.imageWrapper}>
                            <Image
                                src={variant.image_url ?? ""}
                                alt="バリエーション画像"
                                width={100}
                                height={100}
                                className={styles.variantImage}
                            />
                            {isSoldout && (
                                <div className={styles.sold}>
                                    <span className={styles.soldText}>SOLD</span>
                                </div>
                            )}
                            {isLowStock && (
                                <div className={styles.low}>
                                    <span className={styles.lowText}>残りわずか</span>
                                </div>
                            )}
                        </div>

                        <div className={styles.meta}>
                            {variant.color && (
                                <p className={styles.metaText}>
                                    <span className={styles.colorLabel}>カラー</span>
                                    {variant.color}
                                    {variant.sizes && variant.sizes?.length > 0 && (
                                        <span className={styles.expandIcon}>▼</span>
                                    )}
                                </p>
                            )}

                            {variant.sizes && variant.sizes?.length > 0 && (
                                <div className={styles.sizeExpand}>
                                    <div className={styles.sizeGrid}>
                                        {variant.sizes?.map((size, i) => {
                                            if (!size) return;

                                            const initial = size.inventory.initial;
                                            const current = size.inventory.current;
                                            const soldout = current === 0;
                                            const lowStock =
                                                current > 0 && current / initial <= size.inventory.low_stock_ratio;

                                            return (
                                                <span
                                                    key={i}
                                                    className={`
                                                    ${styles.sizeChip}
                                                    ${soldout ? styles.soldChip : ""}
                                                    ${lowStock ? styles.lowChip : ""}
                                                `}
                                                >
                                                    {size.size}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </section>
    );
};
