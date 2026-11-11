import { Metadata } from "next";
import { UploadedItemList } from "./uploadedItemList";
import ItemListHeaderUI from "../itemListHeaderUI";
import { TabHeader } from "../tabHeader";

type Props = {
    searchParams: {
        tab?: "all" | "selling";
    };
};

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "出品した商品",
        description: "出品した商品を確認できます。",
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function Page({ searchParams }: Props) {
    const tab = (await searchParams)?.tab ?? "all";

    return (
        <>
            <TabHeader tab={tab} />

            <ItemListHeaderUI>
                <UploadedItemList uploadedTab={tab} />
            </ItemListHeaderUI>
        </>
    );
}
