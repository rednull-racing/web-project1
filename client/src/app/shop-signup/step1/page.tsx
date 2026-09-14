import { Metadata } from "next";
import { fetchSignup1Page } from "../api/server";
import { Form } from "./form";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "事業者情報登録 | ショップ登録",
        description:
            "ショップ登録はこちら！事業者向けの複数在庫出品、在庫管理システム、売上管理システム、特別なオプションなど、申請するとショップ会員のみの特別な機能をご利用いただけます。（審査に約2週間ほどお時間を頂戴いたします。）",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page() {
    const data = await fetchSignup1Page();

    return <Form user={data.user} shopSignup={data.shopSignup || null} ComOrFreeOption={data.comFree} />;
}
