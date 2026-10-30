"use client";

import { Button, InputStr } from "@/components/inputForm";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { ApiError } from "../../../../lib/api/apiError";
import { sleep } from "../../../../lib/sleep";
import { fetchCompanyNameEdit } from "../../api/shop/shopEdit/client";
import styles from "../../edit.module.css";
import EditUI from "../../editUI";
import { ShopInfo } from "../../types";

type Props = {
    shopId: string;
    shopInfo: ShopInfo;
};

export const Form = ({ shopId, shopInfo }: Props) => {
    const [companyName, setCompanyName] = useState(shopInfo.company_name);
    const router = useRouter();

    const comFree = shopInfo.ComOrFreeOption?.id;

    const submit = async () => {
        if (!companyName) {
            toast.error(`${title}を入力してください`);
            return;
        }

        try {
            await fetchCompanyNameEdit(shopId, companyName);

            const alertText =
                comFree === 1 ? "会社名の変更を受け付けました。審査完了までお待ちください" : "屋号を変更しました";

            toast.success(`${alertText}`);
            await sleep(1500);

            router.push(`/shop-info/${shopId}`);
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("更新に失敗しました");
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const title = comFree === 1 ? "会社名" : "屋号";

    const placeholder = comFree === 1 ? "株式会社〇〇" : "〇〇〇〇";

    return (
        <EditUI title={`${title}の変更`}>
            <InputStr
                title={`新しい${title}`}
                type="text"
                value={companyName}
                onChange={setCompanyName}
                placeholder={placeholder}
                hissu
            />

            {comFree === 1 && (
                <p className={clsx(styles.centerSmall, "mt-4")}>
                    ※会社名の変更は審査が必要になります。登録される会社名の変更は審査が完了し次第となります。審査には1~2週間ほどお時間を頂戴しております。
                </p>
            )}

            <Button onClick={submit}>登録する</Button>
        </EditUI>
    );
};
