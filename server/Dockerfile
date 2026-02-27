FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN mkdir -p /data

ENV PORT=3000
ENV NODE_ENV=production
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["npm", "start"]
