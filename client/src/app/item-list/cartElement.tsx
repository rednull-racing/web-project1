"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { KeyedMutator } from "swr";
import { ApiError } from "../../lib/api/apiError";
import { fetchBuy } from "./api/buy";
import { fetchRemoveCart } from "./api/cart";
import styles from "./cart.module.css";
import { Item } from "./types";

type Response = {
    itemList: Item[];
    totalPages: number;
};

type Props = {
    item: Item;
    mutate: KeyedMutator<Response>;
};

export const CartElement = ({ item, mutate }: Props) => {
    const router = useRouter();

    const buy = async (itemId: string) => {
        try {
            const data = await fetchBuy(itemId);

            // 配送ページとカラー選択ページをできれば1つにまとめる
            router.push(`/buy/trans/${String(data.deliveryId)}`);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.code === "INVALID_ITEM") {
                    toast.error("この商品は販売中ではないため購入できません");
                } else {
                    toast.error("サーバーエラーが発生しました。時間を置いて、再度クリックをお試しください");
                }

                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const remove = async (itemId: string) => {
        // 楽観的更新
        mutate((currentData) => {
            if (!currentData) return currentData;

            return {
                ...currentData,
                itemList: currentData.itemList.filter((item) => item.id !== itemId),
            };
        }, false);

        try {
            await fetchRemoveCart(itemId);

            mutate();

            toast.success("カートから削除しました");
        } catch (err) {
            mutate(); // ロールバック

            if (err instanceof ApiError) return;

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <section className={styles.cartSection}>
            <button type="button" name="cart-remove" className={styles.remove} onClick={() => remove(item.id)}>
                カートから削除
            </button>

            <button type="button" name="buy" className={styles.buy} onClick={() => buy(item.id)}>
                購入手続きへ
            </button>
        </section>
    );
};
