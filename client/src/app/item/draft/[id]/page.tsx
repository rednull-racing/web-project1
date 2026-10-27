import { authOptions } from "@/lib/auth";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { fetchItemMetadata } from "../../api/server";
import { fetchItemDraftPage } from "../api/server";
import { ItemDraftPage } from "../itemDraftPage";

type Props = {
    params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;

    const data = await fetchItemMetadata(id);
    const item = data.item;

    return {
        title: `${item.name} | 下書き`,
        description: `「${item.name}」の下書き`,
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;

    const session = await getServerSession(authOptions);

    if (!session) redirect("/login");

    const data = await fetchItemDraftPage(id);

    const userId = String(session?.user?.id).trim();
    const sellerId = String(data.itemDraft.seller_id).trim();

    if (userId !== sellerId) {
        redirect("/");
    }

    return <ItemDraftPage id={id} itemDraft={data.itemDraft} />;
}
