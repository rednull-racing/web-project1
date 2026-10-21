import { ComOrFreeOption } from "../../models/index.js";

export const getComFreeOptionAll = () => {
    return ComOrFreeOption.findAll();
};
