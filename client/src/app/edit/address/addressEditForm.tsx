"use client";

import { Button, InputStr } from "@/components/inputForm";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { SITE } from "../../../config/site";
import { ApiError } from "../../../lib/api/apiError";
import { sleep } from "../../../lib/sleep";
import { fetchAddressEdit, fetchGetAddress, fetchShopAddressEdit } from "../api/address/client";
import styles from "../edit.module.css";
import EditUI from "../editUI";
import { Address } from "../types";
import { showAddressErrorToast } from "./addressErrorMessage";

type Props = {
    address: Address;
    page: "normal" | "purchase" | "shop" | "shop-signup" | "com-free";
    purchaseSessionId?: string;
    shopId?: string;
    shopEditId?: string;
};

export const AddressEditForm = ({ address, page, purchaseSessionId, shopId, shopEditId }: Props) => {
    const [postNumber, setPostNumber] = useState(address?.post_number ?? "");
    const [todouhuken, setTodouhuken] = useState(address?.AddressTodouhuken?.name ?? "");
    const [shikutyouson, setShikutyouson] = useState(address?.shikutyouson ?? "");
    const [banchi, setBanchi] = useState(address?.banchi ?? "");
    const [building, setBuilding] = useState(address?.building ?? "");

    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const router = useRouter();

    useEffect(() => {
        if (isInitialLoad) {
            setIsInitialLoad(false);
            return;
        }

        if (postNumber.length === 7) {
            handleZipSearch();
        }
    }, [postNumber, isInitialLoad]);

    const handleZipSearch = async () => {
        if (!postNumber || postNumber.length < 7) {
            toast.error("7桁の郵便番号を入力してください。");
            return;
        }

        try {
            const address = await fetchGetAddress(postNumber);

            setTodouhuken(address.todouhuken_name);
            setShikutyouson(address.shikutyouson);
            setBanchi(address.banchi);
        } catch (err) {
            if (err instanceof ApiError) {
                showAddressErrorToast(err.code);
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const submit = async () => {
        if (!postNumber || !todouhuken || !shikutyouson || !banchi) {
            toast.error("必須項目が空になっています");
            return;
        }

        const normalizedPostNumber = postNumber.replace(/-/g, "");
        if (!/^[0-9]{7}$/.test(normalizedPostNumber)) {
            toast.error("郵便番号は半角数字7桁で入力してください");
            return;
        }

        const body = {
            postNumber: normalizedPostNumber,
            todouhuken,
            shikutyouson,
            banchi,
            building,
        };

        try {
            if (page === "shop") {
                if (!shopId) throw new Error();

                await fetchShopAddressEdit(shopId, body);

                toast.success("住所変更の受付が完了しました。審査完了までしばらくお待ちください");
                await sleep(1500);

                router.push(`/shop-info/${shopId}`);
                return;
            }

            await fetchAddressEdit(address.id, body);

            toast.success("住所を更新しました");
            await sleep(1500);

            if (page === "purchase") {
                router.push(`/buy/trans/${purchaseSessionId}`);
            } else if (page === "shop-signup") {
                router.push(`/shop-signup/step5/${shopId}`);
            } else if (page === "com-free") {
                router.push(`/edit/shop/com-free/confirm/${shopEditId}`);
            } else {
                router.push("/my-page");
            }
        } catch (err) {
            if (err instanceof ApiError) {
                showAddressErrorToast(err.code);
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    return (
        <EditUI title="住所の設定・変更">
            <InputStr
                title="郵便番号 ※ハイフン無し"
                type="text"
                value={postNumber}
                onChange={setPostNumber}
                placeholder={SITE.inputPostNumber}
                hissu
                numeric
                patternNum
            />
            <InputStr
                title="都道府県"
                type="text"
                value={todouhuken}
                onChange={setTodouhuken}
                placeholder={SITE.inputTodouhuken}
                hissu
            />
            <InputStr
                title="市区町村"
                type="text"
                value={shikutyouson}
                onChange={setShikutyouson}
                placeholder={SITE.inputShikutyouson}
                hissu
            />
            <InputStr
                title="町名・番地"
                type="text"
                value={banchi}
                onChange={setBanchi}
                placeholder={SITE.inputBanchi}
                hissu
            />
            <InputStr
                title="建物名・部屋番号"
                type="text"
                value={building}
                onChange={setBuilding}
                placeholder={SITE.inputBuilding}
                hissu={false}
            />

            {page === "shop" && (
                <p className={clsx(styles.centerSmall, "mt-4")}>
                    ※会社所在地の変更は審査が必要になります。登録される所在地の変更は審査が完了し次第となります。審査には1~2週間ほどお時間を頂戴しております。
                </p>
            )}

            <Button onClick={submit}>登録する</Button>
        </EditUI>
    );
};
