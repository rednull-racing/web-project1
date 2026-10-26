import { Back, Container } from "@/components";
import Footer from "@/components/footer/footer";
import Header from "@/components/header/header";
import { Items } from "@/types/itemListTypes";
import Link from "next/link";
import { DeleteButton } from "./admin/deleteButton";
import { CommentSection } from "./commentSection/commentSection";
import { Title } from "./confirm/title";
import { UploadButton } from "./confirm/uploadButton";
import { PerfectDelete } from "./deleted/perfectDelete";
import { Restore } from "./deleted/restore";
import { EditButton } from "./draft/editButton";
import styles from "./itemCommon.module.css";
import { ItemListSection } from "./itemListSection";
import { Item, User } from "./itemPageTypes";
import { Main } from "./main";
import { DeleteItem } from "./sellerSection/deleteItem";
import { SellerSectionBottom } from "./sellerSection/sellerSectionBottom";

type Props = {
    id: string;
    item: Item;
    itemList?: Items[];
    sellerMe?: boolean;
    page: "normal" | "admin" | "draft" | "confirm" | "deleted";
    commentCount?: number;
    likeCount?: number;
    isLike?: boolean;
    reportCount?: number;
    userId: string | null;
    loggedIn: boolean;
    me?: User | null;
    confirmPage?: "normal" | "edit";
};

export const ItemPage = ({
    id,
    item,
    itemList,
    sellerMe,
    page,
    commentCount,
    likeCount,
    isLike,
    reportCount,
    userId,
    loggedIn,
    me,
    confirmPage,
}: Props) => {
    if (!["normal", "admin", "draft", "confirm", "deleted"].includes(page)) {
        console.error("ページ信号が正しくありません。page：", page);
        return;
    }

    let buttonLink = "";
    let buttonText = "";
    if (page === "normal") {
        buttonLink = `/money-management/item/${id}`;
        buttonText = "売上管理";
    } else if (page === "admin") {
        buttonLink = `/admin/fileEdit/${id}`;
        buttonText = "ファイル編集";
    }

    return (
        <>
            {page === "normal" && <Header />}

            <Container header={page === "normal"}>
                {page === "deleted" && <Restore id={id} item={item} />}
                {page === "confirm" && <Title />}
                {page === "draft" && <EditButton id={id} />}
                {page === "admin" && <DeleteButton id={id} item={item} />}
                {["normal", "admin", "draft"].includes(page) && <Back />}

                <Main
                    id={id}
                    item={item}
                    sellerMe={sellerMe}
                    page={page}
                    likeCount={likeCount}
                    isLike={isLike}
                    reportCount={reportCount}
                    userId={userId}
                    loggedIn={loggedIn}
                />
                {["normal", "admin"].includes(page) && (
                    <>
                        {page === "normal" && <ItemListSection itemList={itemList} sellerMe={sellerMe} />}
                        {(page === "admin" || sellerMe) && (
                            <Link href={buttonLink} className={styles.uriageButton}>
                                {buttonText}
                            </Link>
                        )}

                        <CommentSection
                            id={id}
                            sellerMe={sellerMe}
                            loggedIn={loggedIn}
                            commentCount={commentCount}
                            page={page as "normal" | "admin"}
                            item={item}
                            me={me ?? null}
                        />
                        {sellerMe && page === "normal" && <SellerSectionBottom id={id} item={item} page={page} />}
                    </>
                )}

                {page === "draft" && (
                    <>
                        <EditButton id={id} />
                        <DeleteItem id={id} page={page} />
                    </>
                )}
                {page === "confirm" && confirmPage && <UploadButton id={id} page={confirmPage} />}
                {page === "deleted" && (
                    <>
                        <Restore id={id} item={item} />
                        <PerfectDelete id={id} />
                    </>
                )}
            </Container>

            {page === "normal" && <Footer />}
        </>
    );
};
