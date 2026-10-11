FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 10000

CMD ["sh", "-c", "npm run db:migrate && npm run realtime"]
