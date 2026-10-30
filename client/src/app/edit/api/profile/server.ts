import { apiFetchServer } from "../../../../lib/api/server";
import { User } from "../../types";

type ProfilePageParams = {
    user: User;
};

export const fetchProfilePage = async (): Promise<ProfilePageParams> => {
    return apiFetchServer("/user/profile-edit-data", {
        cache: "no-store",
    });
};
