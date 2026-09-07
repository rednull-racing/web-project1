import { Address, BankAccount, IdCard, Name, Permit, ShopSignup } from "../../../models/index.js";

export type OldShopSignup = {
    ShopSignup: InstanceType<typeof ShopSignup> & {
        Address?: InstanceType<typeof Address> | null;
        RepresentativeName?: InstanceType<typeof Name> | null;
        ContactName?: InstanceType<typeof Name> | null;
        BankAccount?: InstanceType<typeof BankAccount> | null;
        IdCard?: InstanceType<typeof IdCard> | null;
        Permit?: InstanceType<typeof Permit> | null;
    };
};
