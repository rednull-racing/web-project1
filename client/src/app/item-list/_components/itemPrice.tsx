import styles from "./listParts.module.css";

export const ItemPrice = ({
    data,
    showSale,
}: {
    data: {
        price: number;
        sale_flag: boolean;
        before_price: number;
        discount_rate: number;
        discount_amount: number;
    };
    showSale: boolean;
}) => (
    <div className={styles.priceColumn}>
        <h3 className={styles.price}>￥{data.price.toLocaleString()}</h3>
        {showSale && data.sale_flag && (
            <>
                <p className={styles.beforePrice}>￥{data.before_price.toLocaleString()}</p>
                {data.discount_rate > 0 && (
                    <span className={styles.sale}>{data.discount_rate.toLocaleString()}% OFF</span>
                )}
                {data.discount_amount > 0 && (
                    <span className={styles.sale}>{data.discount_amount.toLocaleString()}円引き</span>
                )}
            </>
        )}
    </div>
);
