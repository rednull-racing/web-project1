import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Form } from "../form";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "オプション選択 | ショップ登録",
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

    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access-token")?.value;

    if (!accessToken) redirect("/login");

    return <Form shopSignupId={id} />;
}
