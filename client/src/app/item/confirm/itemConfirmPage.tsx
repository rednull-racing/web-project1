import { Back, Container } from "@/components";
import CStyles from "../itemCommon.module.css";
import { Title } from "./title";
import { ItemEditing } from "./types";
import { UploadButton } from "./uploadButton";
import { VideoSection } from "./videoSection";
import { ItemSection } from "./itemSection";

type Props = {
    id: string;
    itemEditing: ItemEditing;
    page: "normal" | "edit";
};

export const ItemConfirmPage = ({ id, itemEditing, page }: Props) => {
    const soldout = itemEditing.attributes.inventory?.current === 0;

    return (
        <Container>
            <Title page={page} />
            <Back />

            <main className={CStyles.main2column}>
                <VideoSection itemEditing={itemEditing} soldout={soldout} />
                <ItemSection itemEditing={itemEditing} soldout={soldout} />
            </main>

            <UploadButton id={id} page={page} />
        </Container>
    );
};
