"use client";

import Image from "next/image";
import styles from "./peek.module.css";

type Props = {
    data: {
        itemName: string;
        price: number | string;
        firstImageUrl: string;
        genderType: "men" | "women" | "unisex";
        ageType: "adult" | "kids" | "both";
        soldout: boolean;
    };
};

export const ItemPeek = ({ data }: Props) => {
    const handleScroll = () => {
        const target = document.getElementById("itemName");
        target?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    return (
        <section className={styles.itemPeek} onClick={handleScroll} role="button" aria-label="商品説明へスクロール">
            <div className={styles.imageName}>
                <Image src={data.firstImageUrl} alt="商品画像1枚目" width={45} height={45} className={styles.image} />

                <div className={styles.nameType}>
                    <p className={styles.name}>{data.itemName}</p>

                    {(["men", "women", "unisex"].includes(data.genderType) || data.ageType === "kids") && (
                        <div className={styles.typeRow}>
                            {data.genderType === "men" && <span className={styles.typeText}>メンズ</span>}
                            {data.genderType === "women" && <span className={styles.typeText}>レディース</span>}
                            {data.genderType === "unisex" && <span className={styles.typeText}>ユニセックス</span>}

                            {data.ageType === "kids" && (
                                <>
                                    {["men", "women", "unisex"].includes(data.genderType) && (
                                        <span className={styles.typeText}>/</span>
                                    )}
                                    <span className={styles.typeText}>キッズ</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <p
                className={`${styles.price}
            ${data.soldout ? `${styles.sold}` : ""}`}
            >
                {data.soldout ? "SOLD OUT" : `￥${data.price.toLocaleString()}`}
            </p>
        </section>
    );
};
