import type { Item } from "../types";
import styles from "./listParts.module.css";

export const ItemPrice = ({ item, showSale }: { item: Pick<Item, "price" | "Sale">; showSale: boolean }) => (
    <div className={styles.priceColumn}>
        <h3 className={styles.price}>￥{item.price.toLocaleString()}</h3>
        {showSale && item.Sale?.sale_flag && (
            <>
                <p className={styles.beforePrice}>￥{item.Sale?.before_price.toLocaleString()}</p>
                {item.Sale?.discount_rate > 0 && (
                    <span className={styles.sale}>{item.Sale?.discount_rate.toLocaleString()}% OFF</span>
                )}
                {item.Sale?.discount_amount > 0 && (
                    <span className={styles.sale}>{item.Sale?.discount_amount.toLocaleString()}円引き</span>
                )}
            </>
        )}
    </div>
);
