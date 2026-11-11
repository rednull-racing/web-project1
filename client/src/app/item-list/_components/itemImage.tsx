import Image from "next/image";
import type { Item } from "../types";
import styles from "./listParts.module.css";

export const ItemImage = ({
    item,
    showSold,
}: {
    item: Pick<Item, "first_image_url" | "status">;
    showSold: boolean;
}) => (
    <div className={styles.imageDiv}>
        <Image
            src={item.first_image_url || "/no-image(1x1).png"}
            alt="商品画像"
            width={80}
            height={80}
            className={styles.image}
        />
        {showSold && item.status === "soldout" && (
            <div className={styles.sold}>
                <p className={styles.soldP}>SOLD</p>
            </div>
        )}
    </div>
);
