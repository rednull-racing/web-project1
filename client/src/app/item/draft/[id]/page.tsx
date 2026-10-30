import { authOptions } from "@/lib/auth";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { cache } from "react";
import { fetchItemDraftPage, fetchItemDraftPageMetadata } from "../api/server";
import { ItemDraftPage } from "../itemDraftPage";

type Props = {
    params: Promise<{ id: string }>;
};

const getItemDraft = cache(async (id: string) => {
    const session = await getServerSession(authOptions);

    if (!session) redirect("/login");

    const data = await fetchItemDraftPage(id);
    const userId = String(session.user.id).trim();
    const sellerId = String(data.itemDraft.seller_id).trim();

    if (userId !== sellerId) redirect("/");

    return data.itemDraft;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) redirect("/login");

    const { itemDraft } = await fetchItemDraftPageMetadata(id);
    const name = itemDraft.name || "商品名未入力";

    return {
        title: `${name} | 下書き`,
        description: `「${name}」の下書き`,
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ params }: Props) {
    const { id } = await params;
    const itemDraft = await getItemDraft(id);

    return <ItemDraftPage id={id} itemDraft={itemDraft} />;
}
