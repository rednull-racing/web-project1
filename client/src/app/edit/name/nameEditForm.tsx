"use client";

import { Button, InputStr, InputTitle } from "@/components/inputForm";
import { getAccessToken } from "@/lib/getAccessToken";
import clsx from "clsx";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import useSWR from "swr";
import { ApiError } from "../../../lib/api/apiError";
import { apiFetch } from "../../../lib/api/client";
import { sleep } from "../../../lib/sleep";
import { fetchNameEdit, fetchShopEditRepNameCreate, fetchShopRepNamePatch } from "../api/name/client";
import styles from "../edit.module.css";
import EditUI from "../editUI";
import { Name, ShopInfo, ShopSignup } from "../type";

type Props = {
    name?: Name;
    page:
        | "normal"
        | "purchase"
        | "rep-shop"
        | "rep-shop-signup"
        | "rep-com-free"
        | "con-shop"
        | "con-shop-signup"
        | "con-com-free";
    purchaseSessionId?: string;
    shopId?: string;
    shopEditId?: string;
};

export const NameEditForm = ({ name, page, purchaseSessionId, shopId, shopEditId }: Props) => {
    const { data } = useSWR<{ shopSignup?: ShopSignup; shop?: ShopInfo }>(
        shopId && (page === "rep-shop" || page === "rep-shop-signup")
            ? `/${page === "rep-shop-signup" ? "shop-signup" : "shop-info"}/${shopId}/rep-name`
            : null,
        apiFetch,
    );
    const idCard = (page === "rep-shop-signup" ? data?.shopSignup : data?.shop)?.IdCard;
    const frontS3Metadata = idCard?.FrontIdCard;
    const rearS3Metadata = idCard?.RearIdCard;

    const frontImageUrl = frontS3Metadata
        ? page === "rep-shop"
            ? `${process.env.NEXT_PUBLIC_API_URL}/shop-info/${shopId}/files/${frontS3Metadata.id}`
            : page === "rep-com-free"
              ? `${process.env.NEXT_PUBLIC_API_URL}/shop-info-edit/${shopEditId}/files/${frontS3Metadata.id}`
              : page === "rep-shop-signup"
                ? `${process.env.NEXT_PUBLIC_API_URL}/shop-signup/${shopId}/files/${frontS3Metadata.id}`
                : ""
        : "";
    const rearImageUrl = rearS3Metadata
        ? page === "rep-shop"
            ? `${process.env.NEXT_PUBLIC_API_URL}/shop-info/${shopId}/files/${rearS3Metadata.id}`
            : page === "rep-com-free"
              ? `${process.env.NEXT_PUBLIC_API_URL}/shop-info-edit/${shopEditId}/files/${rearS3Metadata.id}`
              : page === "rep-shop-signup"
                ? `${process.env.NEXT_PUBLIC_API_URL}/shop-signup/${shopId}/files/${rearS3Metadata.id}`
                : ""
        : "";

    const [seiValue, setSeiValue] = useState(name?.sei ?? "");
    const [meiValue, setMeiValue] = useState(name?.mei ?? "");
    const [seiKanaValue, setSeiKanaValue] = useState(name?.sei_kana ?? "");
    const [meiKanaValue, setMeiKanaValue] = useState(name?.mei_kana ?? "");

    const [idCardFront, setIdCardFront] = useState<File>();
    const [idFrontPreview, setIdFrontPreview] = useState("");
    const [idFrontUpload, setIdFrontUpload] = useState<boolean>(false);

    const [idCardRear, setIdCardRear] = useState<File>();
    const [idRearPreview, setIdRearPreview] = useState("");
    const [idRearUpload, setIdRearUpload] = useState<boolean>(false);

    const idFrontRef = useRef<HTMLInputElement | null>(null);
    const idRearRef = useRef<HTMLInputElement | null>(null);

    const router = useRouter();

    const handleChangeFront = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setIdCardFront(selectedFile);
            setIdFrontPreview(URL.createObjectURL(selectedFile));
            setIdFrontUpload(true);
        }
    };

    const handleChangeRear = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setIdCardRear(selectedFile);
            setIdRearPreview(URL.createObjectURL(selectedFile));
            setIdRearUpload(true);
        }
    };

    const submit = async () => {
        if (!seiValue || !meiValue || !seiKanaValue || !meiKanaValue) {
            toast.error("空の項目があります");
            return;
        }

        const body = {
            sei: seiValue.trim(),
            mei: meiValue.trim(),
            seiKana: seiKanaValue.trim(),
            meiKana: meiKanaValue.trim(),
        };

        try {
            await fetchNameEdit(name?.id ?? "", body);

            toast.success("氏名を更新しました");
            await sleep(1500);

            if (page === "purchase") {
                router.push(`/buy/trans/${purchaseSessionId}`);
            } else if (page === "con-shop") {
                router.push(`/shop-info/${shopId}`);
            } else if (page === "con-shop-signup") {
                router.push(`/shop-signup/step5/${shopId}`);
            } else if (page === "rep-com-free" || page === "con-com-free") {
                router.push(`/edit/shop/com-free/confirm/${shopEditId}`);
            } else {
                router.push("/my-page");
            }
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error("氏名の変更に失敗しました");
            }
            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    const repSubmit = async () => {
        if (!shopId) return;

        if (!seiValue || !meiValue || !seiKanaValue || !meiKanaValue) {
            toast.error("空の項目があります");
            return;
        }

        if (!idCardFront || !idCardRear) {
            toast.error("身分証がアップロードされていません");
            return;
        }

        let frontFileName: string | undefined;
        let frontFileType: string | undefined;
        let rearFileName: string | undefined;
        let rearFileType: string | undefined;

        if (idFrontUpload && idCardFront instanceof File) {
            frontFileName = idCardFront.name;
            frontFileType = idCardFront.type;
        }

        if (idRearUpload && idCardRear instanceof File) {
            rearFileName = idCardRear.name;
            rearFileType = idCardRear.type;
        }

        const body = {
            sei: seiValue.trim(),
            mei: meiValue.trim(),
            seiKana: seiKanaValue.trim(),
            meiKana: meiKanaValue.trim(),
            frontFileName,
            frontFileType,
            rearFileName,
            rearFileType,
            idFrontUpload,
            idRearUpload,
        };

        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                alert("認証に失敗しました。時間を置いて再試行するか、再度ログインしてください");
                return;
            }

            if (page === "rep-shop") {
                const data = await fetchShopEditRepNameCreate(shopId, body);

                if (idFrontUpload && data.frontSignedUrl && idCardFront instanceof File) {
                    const uploadFrontRes = await fetch(data.frontSignedUrl, {
                        method: "PUT",
                        headers: {
                            "Content-Type": idCardFront.type,
                        },
                        body: idCardFront,
                    });

                    if (!uploadFrontRes.ok) {
                        toast.error("身分証（表面）のアップロードに失敗しました");
                        return;
                    }
                }

                if (idRearUpload && data.rearSignedUrl && idCardRear instanceof File) {
                    const uploadFrontRes = await fetch(data.rearSignedUrl, {
                        method: "PUT",
                        headers: {
                            "Content-Type": idCardRear.type,
                        },
                        body: idCardRear,
                    });

                    if (!uploadFrontRes.ok) {
                        toast.error("身分証（裏面）のアップロードに失敗しました");
                        return;
                    }
                }

                toast.success("代表者氏名の変更を受け付けました。審査完了までしばらくお待ちください");
                await sleep(1500);

                router.push(`/shop-info/${shopId}`);
            } else if (page === "rep-shop-signup") {
                await fetchShopRepNamePatch(shopId, {
                    sei: body.sei,
                    mei: body.mei,
                    seiKana: body.seiKana,
                    meiKana: body.meiKana,
                    frontIdCard: idCardFront,
                    rearIdCard: idCardRear,
                });

                toast.success("代表者氏名を変更しました");
                await sleep(1500);

                router.push(`/shop-signup/step5/${shopId}`);
            }
        } catch (err) {
            if (err instanceof ApiError) {
                switch (err.code) {
                    case "S3_METADATA_NOT_FOUND":
                        toast.error("身分証を選び直して、もう一度お試しください。");
                        break;
                    case "FRONT_URL_EMPTY":
                        toast.error("身分証表面がありません");
                        break;
                    case "REAR_URL_EMPTY":
                        toast.error("身分証裏面がありません");
                        break;
                    default:
                        toast.error("氏名の変更に失敗しました");
                }
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください");
        }
    };

    let title = "氏名の設定・変更";
    if (page === "rep-shop" || page === "rep-shop-signup" || page === "rep-com-free") {
        title = "代表者氏名の設定・変更";
    } else if (page === "con-shop" || page === "con-shop-signup" || page === "con-com-free") {
        title = "ショップ担当者氏名の設定・変更";
    }

    const submitOption =
        page === "rep-shop" || page === "rep-shop-signup" || page === "rep-com-free" ? repSubmit : submit;

    return (
        <EditUI title={title}>
            <div className={styles.nameFlex}>
                <InputStr title="姓" type="text" value={seiValue} onChange={setSeiValue} placeholder="山田" hissu />
                <InputStr title="名" type="text" value={meiValue} onChange={setMeiValue} placeholder="太郎" hissu />
            </div>

            <div className={styles.nameFlex}>
                <InputStr
                    title="セイ"
                    type="text"
                    value={seiKanaValue}
                    onChange={setSeiKanaValue}
                    placeholder="ヤマダ"
                    hissu
                />
                <InputStr
                    title="メイ"
                    type="text"
                    value={meiKanaValue}
                    onChange={setMeiKanaValue}
                    placeholder="タロウ"
                    hissu
                />
            </div>

            {(page === "rep-shop" || page === "rep-shop-signup" || page === "rep-com-free") && (
                <>
                    <h2 className={styles.subtitle}>代表者身分証</h2>

                    <div className={styles.imageInputDiv}>
                        <InputTitle title="身分証（表面）" hissu />
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleChangeFront}
                            className={styles.imageInput}
                            placeholder="画像ファイルをアップロード"
                            ref={idFrontRef}
                        />
                        <Image
                            src={idFrontPreview || frontImageUrl || "/no-image(1x1).png"}
                            alt="身分証（表面）"
                            width={120}
                            height={120}
                            className={styles.preview}
                        />

                        <InputTitle title="身分証（裏面）" hissu />
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleChangeRear}
                            className={styles.imageInput}
                            placeholder="画像ファイルをアップロード"
                            ref={idRearRef}
                            required
                        />
                        <Image
                            src={idRearPreview || rearImageUrl || "/no-image(1x1).png"}
                            alt="身分証（裏面）"
                            width={120}
                            height={120}
                            className={styles.preview}
                        />

                        <p className={styles.centerSmall}>
                            ※顔写真付きのもの
                            <br />
                            ※顔写真と生年月日がわかる面を表にして撮影
                            <br />
                            ※表裏合わせて計2枚撮影
                        </p>
                    </div>

                    <p className={clsx(styles.centerSmall, "mt-4")}>
                        ※代表者氏名の変更は審査が必要になります。登録される代表者氏名の変更は審査が完了し次第となります。審査には1~2週間ほどお時間を頂戴しております。
                    </p>
                </>
            )}

            <Button onClick={submitOption}>登録する</Button>
        </EditUI>
    );
};
