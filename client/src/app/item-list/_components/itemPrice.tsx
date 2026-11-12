import styles from "./listParts.module.css";

const formatPrice = (price: number | string): string => {
    if (typeof price === "string" && (price.trim() === "" || !Number.isFinite(Number(price)))) {
        return price;
    }
    return `${Number(price).toLocaleString("ja-JP")}円`;
};

export const ItemPrice = ({
    data,
    showSale,
}: {
    data: {
        price: number | string;
        sale_flag: boolean;
        before_price: number | string;
        discount_rate: number | string;
        discount_amount: number | string;
    };
    showSale: boolean;
}) => (
    <div className={styles.priceColumn}>
        <h3 className={styles.price}>{formatPrice(data.price)}</h3>
        {showSale && data.sale_flag && (
            <>
                <p className={styles.beforePrice}>{formatPrice(data.before_price)}</p>
                {Number(data.discount_rate) > 0 && (
                    <span className={styles.sale}>{Number(data.discount_rate).toLocaleString("ja-JP")}% OFF</span>
                )}
                {Number(data.discount_amount) > 0 && (
                    <span className={styles.sale}>{Number(data.discount_amount).toLocaleString("ja-JP")}円引き</span>
                )}
            </>
        )}
    </div>
);
