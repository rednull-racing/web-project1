import { ItemAttributes } from "../../../types/itemAttributes";
import styles from "./item.module.css";

type Props = {
    data: {
        itemAttributes: ItemAttributes;
        condition: string;
        shippingService: string;
        shippingPlace: string;
        shippingDay: string;
    };
};

export const DeliverySection = ({ data }: Props) => {
    const inventory = data.itemAttributes.inventory;
    const materials = data.itemAttributes.materials;
    const materialTotalRatio = materials?.reduce((sum, m) => sum + (m.ratio ?? 0), 0);

    return (
        <section className={styles.deliverySection}>
            <p className={styles.syohinText}>商品の情報</p>

            <div className={styles.infoRow}>
                <span className={styles.label}>商品の状態</span>
                <span className={styles.value}>{data.condition}</span>
            </div>

            <div className={styles.infoRow}>
                <span className={styles.label}>配送の方法</span>
                <span className={styles.value}>{data.shippingService}</span>
            </div>

            <div className={styles.infoRow}>
                <span className={styles.label}>発送元地域</span>
                <span className={styles.value}>{data.shippingPlace}</span>
            </div>

            <div className={styles.infoRow}>
                <span className={styles.label}>発送までの日数</span>
                <span className={styles.value}>{data.shippingDay}</span>
            </div>

            {inventory && inventory.initial >= 2 && (
                <div className={styles.infoRow}>
                    <span className={styles.label}>在庫</span>
                    {(inventory.initial <= 4
                        ? inventory.current >= 2
                        : inventory.current > inventory.initial * inventory.low_stock_ratio) && (
                        <span className={`${styles.value} ${styles.full}`}>在庫あり</span>
                    )}
                    {(inventory.initial <= 4
                        ? inventory.current === 1
                        : inventory.current <= inventory.initial * inventory.low_stock_ratio &&
                          inventory.current >= 1) && (
                        <span className={`${styles.value} ${styles.low}`}>残りわずか</span>
                    )}

                    {inventory.current === 0 && <span className={`${styles.value} ${styles.sold}`}>SOLD OUT</span>}
                </div>
            )}

            {materials && materials.length > 0 && materialTotalRatio === 100 && (
                <div className={styles.infoRow}>
                    <span className={styles.label}>素材</span>

                    <div className={styles.materialColumn}>
                        {materials.map((m, i) => (
                            <div key={i} className={styles.materialRow}>
                                <span className={styles.value}>{m.name}</span>
                                <span className={styles.materialBar}>-</span>
                                <span className={styles.value}>{m.ratio}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
