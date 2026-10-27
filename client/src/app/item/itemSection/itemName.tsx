import { faFire } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./item.module.css";

type Props = {
    data: {
        itemName: string;
        recommend: boolean;
    };
    page: "normal" | "admin" | "draft" | "confirm" | "deleted";
};

export const ItemName = ({ data, page }: Props) => {
    return (
        <div id="itemName" className={styles.itemNameDiv}>
            <h1 className={styles.itemName}>{data.itemName}</h1>
            {data.recommend && ["normal", "admin"].includes(page) && (
                <FontAwesomeIcon icon={faFire} className={styles.recommendFire} />
            )}
        </div>
    );
};
