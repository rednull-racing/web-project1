import { PointsUriageOver } from "../../models/index.js";
import {
    CreateOverConfiscatedParams,
    CreatePoint180Params,
    CreateUriage180Params,
} from "../../types/serviceType/pointUriageOver.js";

export const createPoint180 = async ({ data, transaction }: CreatePoint180Params) => {
    await PointsUriageOver.create(data, { transaction });
};

export const createUriage180 = async ({ data, transaction }: CreateUriage180Params) => {
    await PointsUriageOver.create(data, { transaction });
};

export const createOverConfiscated = async ({ data, transaction }: CreateOverConfiscatedParams) => {
    await PointsUriageOver.create(data, { transaction });
};
