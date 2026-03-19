# AI Studio 单词本 (Vocabulary App)

这是一个基于 React + Vite + Tailwind CSS + Firebase 构建的极简背单词应用。
专为在 Google AI Studio Build (https://ai.studio/build) 环境下运行和迭代而设计。

## 核心功能

*   **智能添加单词:** 支持批量粘贴英文单词，自动调用 Gemini AI 生成中文释义、例句和记忆法。
*   **科学复习算法:** 基于艾宾浩斯遗忘曲线（Spaced Repetition System, SRS），自动安排下一次复习时间。
*   **活动热力图:** 类似 GitHub 的贡献图，记录每天的复习活跃度，激励持续学习。
*   **极简设计:** 采用类似 Notion 的黑白灰极简风格，专注于学习本身。

## 技术栈

*   **前端框架:** React 18 + Vite
*   **样式方案:** Tailwind CSS + Lucide React (图标)
*   **后端服务:** Express (Node.js) 作为代理服务器
*   **数据库:** Firebase Firestore
*   **AI 能力:** Google Gemini API (`@google/genai`)

## 开发与运行

本项目配置了全栈运行模式（Express + Vite 中间件），以解决跨域和 Cookie 状态保持问题。

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 启动生产服务器

```bash
npm start
```

## 环境变量

请参考 `.env.example` 文件配置必要的环境变量。
主要需要配置 `GEMINI_API_KEY` 用于 AI 生成释义功能。

## 目录结构

*   `/src/components`: React UI 组件 (按钮、输入框、复习卡片等)
*   `/src/services`: 核心业务逻辑 (数据交互 `data.ts`, AI 调用 `ai.ts`)
*   `/server.ts`: Express 代理服务器入口，处理 Firebase 交互和 Cookie 鉴权
*   `/firestore.rules`: Firebase 数据库安全规则
*   `/firebase-blueprint.json`: 数据库结构蓝图 (IR)

## 为什么在 AI Studio 中运行？

本项目利用了 AI Studio 提供的开箱即用的 HTTPS 预览环境。由于应用使用了 `secure: true` 的 Cookie 来维持会话状态，在本地非 HTTPS 环境（如 `http://localhost`）下可能会遇到登录失效的问题。在 AI Studio 中，这一切都已配置妥当，你可以专注于产品功能的迭代。
