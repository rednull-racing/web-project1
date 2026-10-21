import dotenv from "dotenv";
dotenv.config();

import process from "process";
import { Sequelize } from "sequelize";

import configFile from "../config/config.js";

import AddressModel from "./address.js";
import BankAccountModel from "./bank_account.js";
import BanksModel from "./banks.js";
import BlogModel from "./blog.js";
import BlogCategoryOptionModel from "./blog_category_option.js";
import BranchesModel from "./branches.js";
import BrandAliasesModel from "./brand_aliases.js";
import BrandsModel from "./brands.js";
import CancelModel from "./cancel.js";
import CancelFeeReturnOptionModel from "./cancel_fee_return_option.js";
import CartModel from "./cart.js";
import CategoriesModel from "./categories.js";
import ChatModel from "./chat.js";
import ComOrFreeOptionModel from "./com_or_free_option.js";
import CommentModel from "./comment.js";
import CommentLikeModel from "./comment_like.js";
import CommentReportModel from "./comment_report.js";
import CommentReportOptionModel from "./comment_report_option.js";
import CouponModel from "./coupon.js";
import CouponCategoryModel from "./coupon_category.js";
import CouponItemModel from "./coupon_item.js";
import CouponShopModel from "./coupon_shop.js";
import CouponUserModel from "./coupon_user.js";
import DeliveryModel from "./delivery.js";
import DeliveryStatusOptionModel from "./delivery_status_option.js";
import FollowModel from "./follow.js";
import GenderOptionModel from "./gender_option.js";
import IdCardModel from "./id_card.js";
import InquiryModel from "./inquiry.js";
import ItemModel from "./item.js";
import ItemBuyerReportModel from "./item_buyer_report.js";
import ItemBuyerReportOptionModel from "./item_buyer_report_option.js";
import ItemConditionOptionModel from "./item_condition_option.js";
import ItemDeleteLogsModel from "./item_delete_logs.js";
import ItemDeletedModel from "./item_deleted.js";
import ItemDraftModel from "./item_draft.js";
import ItemEditingModel from "./item_editing.js";
import ItemLikeModel from "./item_like.js";
import ItemReportModel from "./item_report.js";
import ItemReportOptionModel from "./item_report_option.js";
import ItemShippingProfileModel from "./item_shipping_profile.js";
import ItemTrashModel from "./item_trash.js";
import JournalModel from "./journal.js";
import JournalReasonOptionModel from "./journal_reason_option.js";
import KanjyoOptionModel from "./kanjyo_option.js";
import NameModel from "./name.js";
import NotificationModel from "./notification.js";
import OrderDeletedSystemsModel from "./order_deleted.js";
import OrdersModel from "./orders.js";
import PaymentMethodOptionModel from "./payment_method_option.js";
import PermitModel from "./permit.js";
import PointLotsModel from "./point_lots.js";
import PointReasonOptionModel from "./point_reason_option.js";
import PointsHistoryModel from "./points_history.js";
import PointsUriageOverModel from "./points_uriage_over.js";
import PurchaseSessionModel from "./purchase_session.js";
import ReferenceCodeModel from "./reference_code.js";
import RefreshTokensModel from "./refresh_tokens.js";
import S3MetadataModel from "./s3_metadata.js";
import SaleModel from "./sale.js";
import SalesHistoryModel from "./sales_history.js";
import SearchModel from "./search.js";
import SearchWordsModel from "./search_words.js";
import ShippingDayOptionModel from "./shipping_day_option.js";
import ShippingServiceOptionModel from "./shipping_service_option.js";
import ShopInfoModel from "./shop_info.js";
import ShopInfoEditModel from "./shop_info_edit.js";
import ShopSignupModel from "./shop_signup.js";
import StarHistoryModel from "./star_history.js";
import SuggestWordsModel from "./suggest_words.js";
import TodouhukenOptionModel from "./todouhuken_option.js";
import TokenEmailChangeModel from "./token_email_change.js";
import TokenPasswordResetModel from "./token_password_reset.js";
import TokenSignupVerificationModel from "./token_signup_verification.js";
import TransReasonOptionModel from "./trans_reason_option.js";
import TransferModel from "./transfer.js";
import UriagekinHistoryModel from "./uriagekin_history.js";
import UriagekinLotsModel from "./uriagekin_lots.js";
import UriagekinReasonOptionModel from "./uriagekin_reason_option.js";
import UserModel from "./user.js";
import UserDeleteLogsModel from "./user_delete_logs.js";
import VideoModel from "./video.js";
import WatchHistoryModel from "./watch_history.js";

const env = (process.env.NODE_ENV as "development" | "test" | "production") || "development";
const config = configFile[env];

let sequelize: Sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable] as string, config);
} else {
    sequelize = new Sequelize(config.database as string, config.username as string, config.password as string, config);
}

// モデルを読み込む
const models = {
    Address: AddressModel,
    BankAccount: BankAccountModel,
    Banks: BanksModel,
    BlogCategoryOption: BlogCategoryOptionModel,
    Blog: BlogModel,
    Branches: BranchesModel,
    BrandAliases: BrandAliasesModel,
    Brands: BrandsModel,
    CancelFeeReturnOption: CancelFeeReturnOptionModel,
    Cancel: CancelModel,
    Cart: CartModel,
    Categories: CategoriesModel,
    Chat: ChatModel,
    ComOrFreeOption: ComOrFreeOptionModel,
    CommentLike: CommentLikeModel,
    CommentReportOption: CommentReportOptionModel,
    CommentReport: CommentReportModel,
    Comment: CommentModel,
    Coupon: CouponModel,
    CouponUser: CouponUserModel,
    CouponItem: CouponItemModel,
    CouponShop: CouponShopModel,
    CouponCategory: CouponCategoryModel,
    DeliveryStatusOption: DeliveryStatusOptionModel,
    Delivery: DeliveryModel,
    Follow: FollowModel,
    GenderOption: GenderOptionModel,
    IdCard: IdCardModel,
    Inquiry: InquiryModel,
    ItemBuyerReportOption: ItemBuyerReportOptionModel,
    ItemBuyerReport: ItemBuyerReportModel,
    ItemConditionOption: ItemConditionOptionModel,
    ItemDeleted: ItemDeletedModel,
    ItemDeleteLogs: ItemDeleteLogsModel,
    ItemDraft: ItemDraftModel,
    ItemEditing: ItemEditingModel,
    ItemLike: ItemLikeModel,
    ItemReportOption: ItemReportOptionModel,
    ItemReport: ItemReportModel,
    ItemShippingProfile: ItemShippingProfileModel,
    ItemTrash: ItemTrashModel,
    Item: ItemModel,
    JournalReasonOption: JournalReasonOptionModel,
    Journal: JournalModel,
    KanjyoOption: KanjyoOptionModel,
    Name: NameModel,
    Notification: NotificationModel,
    OrderDeletedSystems: OrderDeletedSystemsModel,
    Orders: OrdersModel,
    PaymentMethodOption: PaymentMethodOptionModel,
    Permit: PermitModel,
    PointReasonOption: PointReasonOptionModel,
    PointLots: PointLotsModel,
    PointsHistory: PointsHistoryModel,
    PointsUriageOver: PointsUriageOverModel,
    PurchaseSession: PurchaseSessionModel,
    ReferenceCode: ReferenceCodeModel,
    RefreshTokens: RefreshTokensModel,
    S3Metadata: S3MetadataModel,
    Sale: SaleModel,
    SalesHistory: SalesHistoryModel,
    Search: SearchModel,
    SearchWords: SearchWordsModel,
    ShippingDayOption: ShippingDayOptionModel,
    ShippingServiceOption: ShippingServiceOptionModel,
    ShopInfoEdit: ShopInfoEditModel,
    ShopSignup: ShopSignupModel,
    ShopInfo: ShopInfoModel,
    StarHistory: StarHistoryModel,
    SuggestWords: SuggestWordsModel,
    TodouhukenOption: TodouhukenOptionModel,
    TokenEmailChange: TokenEmailChangeModel,
    TokenPasswordReset: TokenPasswordResetModel,
    TokenSignupVerification: TokenSignupVerificationModel,
    TransReasonOption: TransReasonOptionModel,
    Transfer: TransferModel,
    UriagekinHistory: UriagekinHistoryModel,
    UriagekinLots: UriagekinLotsModel,
    UriagekinReasonOption: UriagekinReasonOptionModel,
    User: UserModel,
    UserDeleteLogs: UserDeleteLogsModel,
    Video: VideoModel,
    WatchHistory: WatchHistoryModel,
};

export type ModelRegistry = typeof models;

const db: ModelRegistry & { sequelize: Sequelize; Sequelize: typeof Sequelize } = {
    sequelize,
    Sequelize,
    ...models,
};

// リレーションを設定
Object.values(models).forEach((model) => {
    if ("associate" in model) {
        model.associate();
    }
});

export const {
    Address,
    BankAccount,
    Banks,
    BlogCategoryOption,
    Blog,
    Branches,
    BrandAliases,
    Brands,
    CancelFeeReturnOption,
    Cancel,
    Cart,
    Categories,
    Chat,
    ComOrFreeOption,
    CommentLike,
    CommentReportOption,
    CommentReport,
    Comment,
    Coupon,
    CouponCategory,
    CouponItem,
    CouponShop,
    CouponUser,
    DeliveryStatusOption,
    Delivery,
    Follow,
    GenderOption,
    IdCard,
    Inquiry,
    ItemBuyerReportOption,
    ItemBuyerReport,
    ItemConditionOption,
    ItemDeleted,
    ItemDraft,
    ItemEditing,
    ItemLike,
    ItemReportOption,
    ItemReport,
    ItemShippingProfile,
    ItemTrash,
    Item,
    ItemDeleteLogs,
    JournalReasonOption,
    Journal,
    KanjyoOption,
    Name,
    Notification,
    OrderDeletedSystems: OrderDeleted,
    Orders,
    PaymentMethodOption,
    Permit,
    PointReasonOption,
    PointLots,
    PointsHistory,
    PointsUriageOver,
    PurchaseSession,
    ReferenceCode,
    RefreshTokens,
    S3Metadata,
    Sale,
    SalesHistory,
    Search,
    SearchWords,
    ShippingDayOption,
    ShippingServiceOption,
    ShopInfoEdit,
    ShopSignup,
    ShopInfo,
    StarHistory,
    SuggestWords,
    TodouhukenOption,
    TokenEmailChange,
    TokenPasswordReset,
    TokenSignupVerification,
    TransReasonOption,
    Transfer,
    UriagekinHistory,
    UriagekinLots,
    UriagekinReasonOption,
    User,
    UserDeleteLogs,
    Video,
    WatchHistory,
} = db;

export default db;
