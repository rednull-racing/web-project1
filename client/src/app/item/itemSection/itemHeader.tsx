import { faFire } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./item.module.css";

type Props = {
    data: {
        itemName: string;
        price: number | string;
        genderType: "men" | "women" | "unisex";
        ageType: "adult" | "kids" | "both";
        recommend: boolean;
        soldout: boolean;
        saleFlag: boolean;
        beforePrice: number;
        discountRate: number;
        discountAmount: number;
    };
    page: "normal" | "admin" | "draft" | "confirm" | "deleted";
};

export const ItemHeader = ({ data, page }: Props) => {
    return (
        <div className={styles.itemHeader}>
            <div id="itemName" className={styles.itemNameDiv}>
                <h1 className={styles.itemName}>{data.itemName}</h1>
                {data.recommend && ["normal", "admin"].includes(page) && (
                    <FontAwesomeIcon icon={faFire} className={styles.recommendFire} />
                )}
            </div>

            <div className={styles.priceBlock}>
                {data.soldout ? (
                    <p className={styles.soldOutInline}>SOLD OUT</p>
                ) : (
                    <>
                        <div className={styles.priceRow}>
                            <h2 className={styles.price}>￥{data.price.toLocaleString()}</h2>

                            {data.saleFlag && (
                                <div className={styles.saleBadges}>
                                    {data.discountRate > 0 && (
                                        <span className={styles.saleBadge}>{data.discountRate}% OFF</span>
                                    )}
                                    {data.discountAmount > 0 && (
                                        <span className={styles.saleBadge}>
                                            {data.discountAmount.toLocaleString()}円引き
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {data.saleFlag && (
                            <small className={styles.beforePrice}>￥{data.beforePrice.toLocaleString()}</small>
                        )}
                    </>
                )}
            </div>

            {(["men", "women", "unisex"].includes(data.genderType) || data.ageType === "kids") && (
                <div className={styles.typeTagsRow}>
                    {data.genderType === "men" && <span className={styles.typeTag}>メンズ</span>}
                    {data.genderType === "women" && <span className={styles.typeTag}>レディース</span>}
                    {data.genderType === "unisex" && <span className={styles.typeTag}>ユニセックス</span>}
                    {data.ageType === "kids" && <span className={`${styles.typeTag} ${styles.kidsTag}`}>キッズ</span>}
                </div>
            )}
        </div>
    );
};
