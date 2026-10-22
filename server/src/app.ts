import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import logger from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import { startAllCrons } from "./cron/index.js";
startAllCrons();

const app = express();

import { errorHandler } from "./middleware/errorHandler.js";
import { itemEditingVideoResponse } from "./middleware/itemEditingVideoResponse.js";
import { notFound } from "./middleware/notFount.js";
import { registerRoutes } from "./routes/index.js";

// view engine setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.set("trust proxy", 1);

const allowedOrigins = [process.env.CLIENT_URL, process.env.CLIENT_URL_PROD, process.env.CLIENT_URL_DEV];

app.use(logger("dev"));
app.use(itemEditingVideoResponse);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS blocked: ${origin}`));
            }
        },
        credentials: true,
    }),
);

app.use(express.static(path.join(__dirname, "public")));

registerRoutes(app);

// catch 404 and forward to error handler
app.use(notFound);

// error handler
app.use(errorHandler);

export default app;
