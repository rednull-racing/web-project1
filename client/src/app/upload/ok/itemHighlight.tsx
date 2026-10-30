import Image from "next/image";
import Link from "next/link";
import { Item } from "../types/types";
import styles from "./ok.module.css";

type Props = {
    itemId: string;
    item: Item;
};

export const ItemHighlight = ({ itemId, item }: Props) => {
    return (
        <Link className={styles.itemHighlight} href={`/item/${itemId}`} aria-label={`${item.name}`}>
            <div className={styles.imageName}>
                <Image
                    src={item.first_image_url ?? ""}
                    alt="商品画像1枚目"
                    width={80}
                    height={80}
                    className={styles.image}
                />

                <div className={styles.nameType}>
                    <h2 className={styles.name}>{item.name}</h2>

                    {(["men", "women", "unisex"].includes(item.gender_type) || item.age_type === "kids") && (
                        <div className={styles.typeRow}>
                            {item.gender_type === "men" && <span className={styles.typeText}>メンズ</span>}
                            {item.gender_type === "women" && <span className={styles.typeText}>レディース</span>}
                            {item.gender_type === "unisex" && <span className={styles.typeText}>ユニセックス</span>}

                            {item.age_type === "kids" && (
                                <>
                                    <span className={styles.typeText}>/</span>
                                    <span className={styles.typeText}>キッズ</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <h3 className={styles.price}>￥{item.price.toLocaleString()}</h3>
        </Link>
    );
};
