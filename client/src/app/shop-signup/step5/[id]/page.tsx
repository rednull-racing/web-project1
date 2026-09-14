import { Metadata } from "next";
import { fetchSignup5Page } from "../../api/server";
import { Client } from "../client";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "確認 | ショップ登録",
        description:
            "ショップ登録はこちら！事業者向けの複数在庫出品、在庫管理システム、売上管理システム、特別なオプションなど、申請するとショップ会員のみの特別な機能をご利用いただけます。（審査に約2週間ほどお時間を頂戴いたします。）",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const data = await fetchSignup5Page(id);

    return <Client shopSignupId={id} shopSignup={data.shopSignup} />;
}
