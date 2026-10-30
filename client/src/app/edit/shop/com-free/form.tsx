"use client";

import { Button, InputTitle } from "@/components/inputForm";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../../lib/api/apiError";
import { sleep } from "../../../../lib/sleep";
import { fetchComFreeEdit } from "../../api/shop/shopEdit/client";
import styles from "../../edit.module.css";
import EditUI from "../../editUI";
import { ComOrFreeOption, ShopInfo } from "../../types";

type Props = {
    shopId: string;
    shopInfo: ShopInfo;
    ComOrFreeOption: ComOrFreeOption[];
};

export const Form = ({ shopId, shopInfo, ComOrFreeOption }: Props) => {
    const [selectOption, setSelectOption] = useState(shopInfo.ComOrFreeOption?.id);

    const router = useRouter();

    const submit = async () => {
        if (selectOption === null || selectOption === undefined) {
            toast.error("事業形態を選択してください");
            return;
        }

        if (shopInfo.ComOrFreeOption?.id === selectOption) {
            toast.error("事業形態が変更されていません");
            return;
        }

        try {
            const data = await fetchComFreeEdit(shopId, selectOption);

            toast.success("事業形態を更新しました");
            await sleep(1500);

            router.push(`/edit/shop/com-free/confirm/${String(data.editId)}`);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.code === "INVALID_COM_FREE_ID") {
                    toast.error("事業形態が変更されていません");
                } else {
                    toast.error("事業形態の更新に失敗しました");
                }

                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <EditUI title="事業形態の変更">
            <section className={styles.radioSection}>
                <InputTitle title="事業形態：" />
                <div className={styles.radioColumn}>
                    {ComOrFreeOption.map((option) => (
                        <label key={option.id} className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="comfree"
                                value={option.name}
                                checked={selectOption === option.id}
                                onChange={() => setSelectOption(option.id)}
                                className={styles.radio}
                                required
                            />
                            <p className={styles.radioText}>{option.name}</p>
                        </label>
                    ))}
                </div>
            </section>

            <p className={clsx(styles.centerSmall, "mt-4")}>
                ※事業形態の変更は審査が必要になります。登録される事業形態の変更は審査が完了し次第となります。審査には1~2週間ほどお時間を頂戴しております。
            </p>

            <Button onClick={submit}>次へ</Button>
        </EditUI>
    );
};
