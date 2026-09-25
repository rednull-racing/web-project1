"use client";

import { Button, InputStr, InputTitle } from "@/components/inputForm";
import { ja } from "date-fns/locale";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import toast from "react-hot-toast";
import useSWR from "swr";
import { SITE } from "../../../config/site";
import { ApiError } from "../../../lib/api/apiError";
import { apiFetch } from "../../../lib/api/client";
import { sleep } from "../../../lib/sleep";
import { showAddressErrorToast } from "../address/addressErrorMessage";
import { fetchGetAddress } from "../api/address/client";
import { fetchHonninSubmit } from "../api/honnin/client";
import styles from "../edit.module.css";
import EditUI from "../editUI";
import { GenderOption, User } from "../type";
import { showHonninErrorToast } from "./honninErrorMessage";

type Props = {
    user: User;
    genderOptions: GenderOption[];
    campaign?: boolean;
};

export const HonninEditForm = ({ user, genderOptions, campaign }: Props) => {
    const { data } = useSWR<{ user: User }>("/user/honnin", apiFetch);
    const frontS3Metadata = data?.user.IdCard?.FrontIdCard;
    const rearS3Metadata = data?.user.IdCard?.RearIdCard;

    const frontImageUrl = frontS3Metadata ? `${process.env.NEXT_PUBLIC_API_URL}/user/files/${frontS3Metadata.id}` : "";

    const rearImageUrl = rearS3Metadata ? `${process.env.NEXT_PUBLIC_API_URL}/user/files/${rearS3Metadata.id}` : "";

    const [sei, setSei] = useState(user.Name?.sei);
    const [mei, setMei] = useState(user.Name?.mei);
    const [seiKana, setSeiKana] = useState(user.Name?.sei_kana);
    const [meiKana, setMeiKana] = useState(user.Name?.mei_kana);

    const [birthday, setBirthday] = useState<Date | null>(user.birthday);

    const [idCardFront, setIdCardFront] = useState<File>();
    const [idFrontPreview, setIdFrontPreview] = useState("");
    const [idFrontUpload, setIdFrontUpload] = useState<boolean>(false);
    const [idCardRear, setIdCardRear] = useState<File>();
    const [idRearPreview, setIdRearPreview] = useState("");
    const [idRearUpload, setIdRearUpload] = useState<boolean>(false);

    const [postNumber, setPostNumber] = useState(user.Address?.post_number);
    const [todouhuken, setTodouhuken] = useState(user.Address?.AddressTodouhuken?.name);
    const [shikutyouson, setShikutyouson] = useState(user.Address?.shikutyouson);
    const [banchi, setBanchi] = useState(user.Address?.banchi);
    const [building, setBuilding] = useState(user.Address?.building);

    const [phoneNumber, setPhoneNumber] = useState(user.phone_number);

    const [selectedGender, setSelectedGender] = useState(user.GenderOption?.id);

    const router = useRouter();

    const idFrontRef = useRef<HTMLInputElement | null>(null);
    const idRearRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const handleZipSearch = async () => {
            if (!postNumber || postNumber.length < 7) {
                toast.error("7桁の郵便番号を入力してください");
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

        if (postNumber && postNumber.length === 7) {
            handleZipSearch();
        }
    }, [postNumber]);

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
        const normalizedPostNumber = postNumber?.replace(/-/g, "");
        if (!/^[0-9]{7}$/.test(normalizedPostNumber || "")) {
            toast.error("郵便番号は半角数字7桁で入力してください");
            return;
        }

        const hasFrontFile = idFrontUpload && idCardFront instanceof File;
        const hasRearFile = idRearUpload && idCardRear instanceof File;

        const body = {
            sei,
            mei,
            seiKana,
            meiKana,
            birthday,
            postNumber,
            todouhuken,
            shikutyouson,
            banchi,
            building,
            phoneNumber,
            selectedGender,
            frontIdCard: hasFrontFile ? idCardFront : undefined,
            rearIdCard: hasRearFile ? idCardRear : undefined,
        };

        const requiredBody = [
            sei,
            mei,
            seiKana,
            meiKana,
            birthday,
            postNumber,
            todouhuken,
            shikutyouson,
            banchi,
            phoneNumber,
            selectedGender,
        ];

        if (requiredBody.some((v) => v === "" || v === undefined || v === null) || !hasFrontFile || !hasRearFile) {
            toast.error("未入力の必須項目があります");
            return;
        }

        try {
            await fetchHonninSubmit(body);

            toast.success("本人確認情報を送信しました");
            await sleep(1500);

            router.push("/my-page");
        } catch (err) {
            if (err instanceof ApiError) {
                showHonninErrorToast(err.code);
                return;
            }

            alert("システムエラーが発生しました。時間をおいて再試行してください。");
        }
    };

    return (
        <EditUI title="本人確認情報入力">
            <div className={styles.nameFlex}>
                <InputStr title="姓" type="text" value={sei || ""} onChange={setSei} placeholder="山田" hissu />
                <InputStr title="名" type="text" value={mei || ""} onChange={setMei} placeholder="太郎" hissu />
            </div>

            <div className={styles.nameFlex}>
                <InputStr
                    title="セイ"
                    type="text"
                    value={seiKana || ""}
                    onChange={setSeiKana}
                    placeholder="ヤマダ"
                    hissu
                />
                <InputStr
                    title="メイ"
                    type="text"
                    value={meiKana || ""}
                    onChange={setMeiKana}
                    placeholder="タロウ"
                    hissu
                />
            </div>

            <div className={styles.inputDiv}>
                <InputTitle title="生年月日" hissu />

                <DatePicker
                    selected={birthday}
                    onChange={(date) => setBirthday(date)}
                    dateFormat="yyyy年MM月dd日"
                    locale={ja}
                    placeholderText="生年月日を選択"
                    className={styles.input}
                    maxDate={new Date()}
                    showYearDropdown
                    showMonthDropdown
                    dropdownMode="select"
                    required
                />
            </div>

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

            <InputStr
                title="郵便番号 ※ハイフン無し"
                type="text"
                value={postNumber || ""}
                onChange={setPostNumber}
                placeholder={SITE.inputPostNumber}
                hissu
                numeric
                patternNum
            />
            <InputStr
                title="都道府県"
                type="text"
                value={todouhuken || ""}
                onChange={setTodouhuken}
                placeholder={SITE.inputTodouhuken}
                hissu
            />
            <InputStr
                title="市区町村"
                type="text"
                value={shikutyouson || ""}
                onChange={setShikutyouson}
                placeholder={SITE.inputShikutyouson}
                hissu
            />
            <InputStr
                title="町名・番地"
                type="text"
                value={banchi || ""}
                onChange={setBanchi}
                placeholder={SITE.inputBanchi}
                hissu
            />
            <InputStr
                title="建物名・部屋番号"
                type="text"
                value={building || ""}
                onChange={setBuilding}
                placeholder={SITE.inputBuilding}
                hissu={false}
            />

            <InputStr
                title="電話番号"
                type="tel"
                value={phoneNumber}
                onChange={setPhoneNumber}
                placeholder="電話番号"
                hissu
                patternNum
            />

            <div className={styles.radioSection}>
                <InputTitle title="性別：" hissu />
                <div className={styles.radioColumn}>
                    {genderOptions.map((option) => (
                        <label key={option.id} className={styles.radioLabel}>
                            <input
                                type="radio"
                                name="gender"
                                value={option.name}
                                checked={selectedGender === option.id}
                                onChange={() => setSelectedGender(option.id)}
                                className={styles.radio}
                                required
                            />
                            <p className={styles.radioText}>{option.name}</p>
                        </label>
                    ))}
                </div>
            </div>

            {campaign && (
                <p className={styles.campaignText}>
                    ※本人確認完了後に{SITE.honninPointCampaign.toLocaleString()}pt配布キャンペーン実施中！
                </p>
            )}

            <Button onClick={submit}>送信する</Button>
        </EditUI>
    );
};
