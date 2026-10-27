import { Item } from "../itemPageTypes";
import { BuySection } from "./buySection/buySection";
import { CategoryText } from "./categoryText";
import { DeliverySection } from "./deliverySection";
import { Detail } from "./detail";
import styles from "./item.module.css";
import { ItemHeader } from "./itemHeader";
import { Slideshow } from "./slideshow";
import { VariantsList } from "./variantsList";

type Props = {
    id: string;
    item: Item;
    sellerMe?: boolean;
    page: "normal" | "admin" | "draft" | "confirm" | "deleted";
    loggedIn: boolean;
};

export const ItemSection = ({ id, item, sellerMe, page, loggedIn }: Props) => {
    const status = item.status;
    const variants = item.attributes.colorVariants;

    return (
        <section className={styles.itemSection}>
            <Slideshow images={item.image_url} />
            <ItemHeader
                data={{
                    itemName: item.name,
                    price: item.price,
                    genderType: item.gender_type,
                    ageType: item.age_type,
                    recommend: item.recommend,
                    soldout: item.status === "soldout",
                    saleFlag: item.Sale?.sale_flag ?? false,
                    beforePrice: item.Sale?.before_price ?? item.price,
                    discountRate: item.Sale?.discount_rate ?? 0,
                    discountAmount: item.Sale?.discount_amount ?? 0,
                }}
                page={page}
            />
            {!sellerMe && page === "normal" && !(status === "soldout") && <BuySection id={id} loggedIn={loggedIn} />}
            {variants && variants.length > 0 && <VariantsList itemAttributes={item.attributes} />}
            <Detail
                data={{ itemId: id, detail: item.detail, soldout: item.status === "soldout" }}
                sellerMe={sellerMe}
                page={page}
            />
            <CategoryText categoryName={item.Category?.name ?? ""} />
            {status !== "soldout" && (
                <DeliverySection
                    data={{
                        itemAttributes: item.attributes,
                        condition: item.ItemConditionOption?.name ?? "-",
                        shippingService: item.ItemShippingProfile?.ShippingServiceOption?.name ?? "-",
                        shippingPlace: item.ItemShippingProfile?.TodouhukenOption?.name ?? "-",
                        shippingDay: item.ItemShippingProfile?.ShippingDayOption?.name ?? "-",
                    }}
                />
            )}
        </section>
    );
};
