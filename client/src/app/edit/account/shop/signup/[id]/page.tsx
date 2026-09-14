import { Metadata } from "next";
import { fetchShopSignupAccountPage } from "../../../../api/account/server";
import { AccountEditForm } from "../../../accountEditForm";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "口座情報の設定・変更",
        description: "口座情報を設定・変更できます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const data = await fetchShopSignupAccountPage(id);

    return <AccountEditForm account={data.data} page="shop-signup" shopId={id} />;
}
