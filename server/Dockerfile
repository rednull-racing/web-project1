FROM node:26.12.1 AS builder

RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build


FROM node:26.12.1

RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY migrations ./migrations
COPY config ./config
COPY .sequelizerc ./

COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["npm", "start"]