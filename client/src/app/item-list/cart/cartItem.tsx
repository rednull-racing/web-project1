import Link from "next/link";
import type { KeyedMutator } from "swr";
import { ItemImage } from "../_components/itemImage";
import { ItemPrice } from "../_components/itemPrice";
import type { Item } from "../types";
import { CartActions } from "./cartActions";
import styles from "./cartList.module.css";

export const CartItem = ({
    item,
    mutate,
}: {
    item: Item;
    mutate: KeyedMutator<{
        itemList: { item: Item }[];
        totalPages: number;
    }>;
}) => {
    const itemPageLink = `/item/${item.id}`;

    return (
        <section key={item.id} className={styles.itemSection}>
            <div className={styles.itemFlex}>
                <Link href={itemPageLink} className={styles.itemLinkArea}>
                    <div className={styles.itemImageText}>
                        <ItemImage
                            data={{
                                first_image_url: item.first_image_url,
                                status: item.status,
                            }}
                            showSold={false}
                        />
                        <div className={styles.itemTextArea}>
                            <h2 className={`${styles.itemName} ${styles.line1}`}>{item.name ?? ""}</h2>

                            {(["men", "women", "unisex"].includes(item.gender_type) || item.age_type === "kids") && (
                                <div className={styles.typeRow}>
                                    {item.gender_type === "men" && (
                                        <span className={`${styles.typeText} ${styles.line1}`}>メンズ</span>
                                    )}
                                    {item.gender_type === "women" && (
                                        <span className={`${styles.typeText} ${styles.line1}`}>レディース</span>
                                    )}
                                    {item.gender_type === "unisex" && (
                                        <span className={`${styles.typeText} ${styles.line1}`}>ユニセックス</span>
                                    )}

                                    {item.age_type === "kids" && (
                                        <span className={`${styles.typeText} ${styles.line1}`}>キッズ</span>
                                    )}
                                </div>
                            )}

                            <div className={styles.videoTitleDiv}>
                                <p className={styles.titleLabel}>動画：</p>
                                <h4 className={`${styles.videoTitle} ${styles.line1}`}>{item.Video?.title ?? ""}</h4>
                            </div>
                        </div>
                    </div>

                    <ItemPrice
                        data={{
                            price: item.price,
                            sale_flag: item.Sale?.sale_flag ?? false,
                            before_price: item.Sale?.before_price ?? 0,
                            discount_rate: item.Sale?.discount_rate ?? 0,
                            discount_amount: item.Sale?.discount_amount ?? 0,
                        }}
                        showSale={true}
                    />
                </Link>
            </div>

            {<CartActions item={item} mutate={mutate} />}
        </section>
    );
};
