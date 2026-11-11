import Image from "next/image";
import styles from "./listParts.module.css";

export const ItemImage = ({
    data,
    showSold,
}: {
    data: {
        first_image_url: string;
        status: "active" | "soldout" | null;
    };
    showSold: boolean;
}) => (
    <div className={styles.imageDiv}>
        <Image
            src={data.first_image_url || "/no-image(1x1).png"}
            alt="商品画像"
            width={80}
            height={80}
            className={styles.image}
        />
        {showSold && data.status === "soldout" && (
            <div className={styles.sold}>
                <p className={styles.soldP}>SOLD</p>
            </div>
        )}
    </div>
);
