# 四象限备忘录 · 前端

第二天练习项目的前端仓库：React + TypeScript + Vite 实现登录页、备忘录列表与四象限拖放页面。

- 配套后端仓库：https://github.com/uurotation/intern-day-2-backend
- 配套后端 PR：https://github.com/uurotation/intern-day-2-backend/pull/1
- 本次联调使用的后端分支/提交：`main` 的 `1ab2da7`

## 一、页面与功能

| 页面 | 路径 | 做什么 |
| --- | --- | --- |
| 登录页 | `/login` | 账号、密码、登录按钮、错误提示；提交时按钮进入加载态并禁止重复提交 |
| 备忘录 | `/memo` | 新增事件（内容 + 截止时间 + 标签）、点击左侧圆点划掉、长按拖动调整顺序、删除 |
| 四象限 | `/matrix` | 左侧「待分类」池，把卡片拖进四个格子；拖回池即取消分类 |

必做流程：打开登录页 → 输入账号密码 → 后端校验 → 进入备忘录页 → 显示当前用户 → 增删改查与排序 → 退出登录。

自选功能就是「备忘录 + 四象限」这一整套，两个页面都通过受保护的后端接口读写数据。

### 交互细节

- **标签分两行**：新增事件时先回答「这件事重要吗」——选「重要」或「不重要」；再回答「这件事紧急吗」——选「紧急」或「不紧急」。两行都选了才能提交，提交时再合成象限编号；缺哪一行就提示哪一行。颜色成对：重要深红实心、不重要同族淡红；紧急实心琥珀、不紧急同族淡琥珀。
- **点击圆点划掉**：点左侧圆圈变实心打勾，标题加删除线，同时 `PATCH /memos/{id} {"done":true}` 落到后端；刷新后状态还在。
- **长按拖动排序**：按住任意一行约 0.28 秒后进入拖动，上下移动会出现插入位置的横线，松手后把整份顺序提交给 `POST /memos/reorder`。不按够时间就松手，只是普通点击，不会误触排序。
- **四象限拖放**：使用浏览器原生 drag & drop。拖进格子立即乐观更新界面并 `PATCH /memos/{id} {"quadrant":n}`；失败则回滚并提示。

## 二、技术栈与版本

| 组件 | 版本 |
| --- | --- |
| React | 18.3 |
| TypeScript | 5.9 |
| Vite | 6.4 |
| react-router-dom | 6.30 |
| pnpm | 9.15.4（`packageManager` 字段固定） |

依赖清单 `package.json`，锁文件 `pnpm-lock.yaml`，镜像构建按锁文件安装（`--frozen-lockfile`）。

## 三、目录结构

```text
intern-day-2-frontend/
├── .devcontainer/          开发容器（Git + Node.js + pnpm）
├── .github/pull_request_template.md
├── src/
│   ├── api.ts              接口封装：基地址、Bearer 头、401 与错误信息解析
│   ├── auth.tsx            登录状态：localStorage 凭证 + 启动时向后端复验
│   ├── types.ts            类型与象限元数据
│   ├── utils.ts            截止时间文案、错误提示提取
│   ├── App.tsx             路由与受保护路由
│   ├── styles.css          全部样式
│   ├── components/Layout.tsx        顶栏、导航、退出、路由守卫
│   └── pages/
│       ├── LoginPage.tsx
│       ├── MemoPage.tsx           列表、划掉、长按拖动排序
│       └── MatrixPage.tsx         四象限拖放
├── Dockerfile
├── compose.yaml
├── index.html
├── package.json
├── pnpm-lock.yaml
└── .env.example
```

## 四、环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | 浏览器访问后端的地址（宿主机端口） |

复制 `.env.example` 为 `.env` 后按需修改。构建/启动时也可以用环境变量直接注入，
`compose.yaml` 就是这么做的。

**注意**：这里填的必须是**浏览器能访问到的地址**。容器内的 `localhost` 指容器自己，
Compose 服务名只在本项目内可解析，两个独立 Compose 项目之间不能靠服务名互访。

## 五、启动方式

### 1. 开发容器

VS Code 打开本目录 → `Reopen in Container`，容器内已备 `git / node / pnpm`。

```bash
pnpm install
pnpm run dev        # http://localhost:5173
pnpm run typecheck  # 类型检查
pnpm run build      # 类型检查 + 生产构建
```

### 2. Docker Compose（独立启动）

```bash
docker compose config
docker compose up --build -d
docker compose ps
docker compose logs --tail=100
```

访问 `http://localhost:5173`。

**说明**：这里用 `vite dev` 启动，是练习用的开发启动方式，不是生产部署方案
（没有 Nginx、没有静态产物、没有压缩优化）。验收要求本身就是"能在容器中启动并联调"。

### 3. 联调

先起后端（另一个仓库）：

```bash
cd ../intern-day-2-backend && docker compose up --build -d
docker compose exec api uv run python -m app.seed
```

再起前端，浏览器打开 `http://localhost:5173`，用 README 里初始化的练习账号登录。
后端需要放行 `http://localhost:5173`（见后端 README 的 `CORS_ORIGINS`）。

## 六、登录状态怎么处理

- 登录成功后，令牌存在 `localStorage` 的 `memo.access_token`，每次请求带 `Authorization: Bearer <token>`。
- **刷新页面的行为**：只要本地有令牌，就用它向后端 `GET /auth/me` 复验一次；
  复验通过才认为"已登录"，失败则清掉本地状态并回到登录页。**不靠前端标志位认定身份**。
- 未登录直接输入 `/memo` 或 `/matrix`：路由守卫重定向到 `/login`，受保护内容不会渲染。
- 任何接口返回 `401`：清空本地凭证，路由把用户送回登录页。
- 退出：调用 `POST /auth/logout` 让服务端删除会话，然后清空本地状态并跳转登录页；
  即使退出接口失败，本地凭证也会清掉。

## 七、自测记录

| 检查项 | 操作 | 结果 |
| --- | --- | --- |
| 类型检查 | `pnpm run typecheck` | 0 错误 |
| 生产构建 | `pnpm run build` | 39 modules，构建成功 |
| 正常登录 | `demo` + 练习密码 | 进入 `/memo`，右上角显示后端返回的 `display_name` |
| 错误密码 | 输错密码 | 停留在登录页，提示「账号或密码错误」（文案来自后端） |
| 空值提交 | 账号或密码留空 | 前端拦截，提示「请填写账号和密码」 |
| 重复提交 | 连续点击登录 | 按钮进入加载态并禁用，只发出一次请求 |
| 页面保护 | 未登录直接访问 `/memo` | 跳回 `/login` |
| 刷新保持 | 登录后刷新 | 用本地令牌向 `/auth/me` 复验，通过则留在原页 |
| 凭证失效 | 后端删除会话后再操作 | 收到 `401`，清理本地状态，回到登录页 |
| 划掉 | 点左侧圆点 | 变实心打勾 + 标题划线，刷新后仍是已划掉 |
| 排序 | 长按行 0.3 秒后上下拖动 | 出现插入线，松手后顺序变化，刷新后顺序保持 |
| 四象限 | 拖「待分类」卡片进「重要 · 不紧急」 | 卡片进格，回备忘录页显示「不紧急」「重要」两个标签 |
| 移出象限 | 点卡片上的「移出」 | 回到待分类池，标签变「未分类」 |
| 空状态 | 清空所有备忘录 | 显示「还什么都没写」引导文案 |
| 网络异常 | 停掉后端再登录 | 提示「连不上后端服务，请确认后端已启动」，恢复后可重新操作 |
| 退出 | 点右上角「退出」 | 回登录页，用旧令牌调接口返回 `401` |

## 八、已知问题与限制

1. **用 Vite 开发服务器演示**，非生产构建；没有做代码分割与产物优化。
2. **长按拖动是手写的指针事件**，没有引入拖拽库；桌面浏览器体验正常，移动端未做充分验证。
3. **四象限用原生 HTML5 drag & drop**，触屏浏览器（尤其 iOS Safari）不支持，需要改成指针事件才能支持手机。
4. **截止时间按本地时间显示**，与后端一致，不做时区换算。
5. **没有分页**，备忘录条数很多时一次性全部渲染。
6. 令牌保存在 `localStorage`，理论上受 XSS 影响；这是与后端约定的取舍，见后端 README 第七节。
