import { Metadata } from "next";
import { fetchShopEditRepNamePage } from "../../../../../api/name/server";
import { NameEditForm } from "../../../../nameEditForm";

type Props = {
    params: { id: string };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "代表者氏名の設定・変更",
        description: "代表者氏名の変更ができます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const data = await fetchShopEditRepNamePage(id);

    return <NameEditForm name={data.shopEdit?.RepresentativeNameEdit} page="rep-com-free" shopEditId={id} />;
}
