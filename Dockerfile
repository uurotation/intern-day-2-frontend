FROM node:22-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true

RUN corepack enable

WORKDIR /app

# 先装依赖，利用 Docker 层缓存；按锁文件安装，保证和本地一致。
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173

# 练习项目用 Vite 开发服务器演示，不是生产构建产物。
CMD ["pnpm", "run", "dev"]
