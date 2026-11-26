FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# 该基础镜像已自带 git 2.49 / curl 7.88 / Node 22 / npm / corepack，无需再用 apt 安装，
# 也就不受宿主网络访问 debian 源的影响。
#
# 容器内直连 registry.npmjs.org 常被 TLS 中断，这里把全局 registry 指向国内镜像。
# 只写在镜像的全局 npmrc 里，属于开发环境配置，不进项目仓库，
# 也不影响 pnpm-lock.yaml 的解析结果（锁文件里只有 integrity 哈希）。
RUN npm config set registry https://registry.npmmirror.com --global

# 直接装 pnpm，不用 corepack prepare —— 后者不读 npm 的全局源，会去连官方 registry 而失败。
# 版本与 package.json 的 packageManager 字段保持一致（pnpm@9.15.4）。
RUN npm install -g pnpm@9.15.4
