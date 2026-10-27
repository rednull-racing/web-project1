import CStyles from "../itemCommon.module.css";
import { Container } from "../../../components";
import { DeleteItemDraft } from "./delete";
import { EditButton } from "./editButton";
import { ItemDraft } from "./types";

type Props = {
    id: string;
    itemDraft: ItemDraft;
};

export const ItemDraftPage = ({ id, itemDraft }: Props) => {
    const soldout = itemDraft.attributes.inventory?.current === 0;

    return (
        <Container>
            <EditButton id={id} />

            <main className={CStyles.main2column}>
                {/* videoSection */}
                {/* itemSection */}
            </main>

            <EditButton id={id} />
            <DeleteItemDraft id={id} />
        </Container>
    );
};
