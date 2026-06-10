# 🃏 德州扑克训练

> React 19 + TypeScript + Vite 构建的德州扑克训练器，集成 LLM AI 对手与 GTO 策略指导

**[English](./README_EN.md)** | 中文

[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 6](https://img.shields.io/badge/Vite-6-purple?logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [LLM 配置](#llm-配置)
- [项目结构](#项目结构)
- [截图](#截图)

## 功能特性

### 🎮 完整扑克引擎
- 手牌评估、底池计算、边池、全下(All-in)、摊牌(Showdown)
- 5人对局：你 + 4 个 AI 对手

### 🤖 LLM AI 对手
- 支持接入大语言模型（DeepSeek / GLM / OpenAI 等），让 AI 真正"思考"下注
- 不配置 LLM 也可正常运行（使用内置决策逻辑）

### 🎭 5 种 AI 风格
每局随机分配，玩家需通过观察行为来判断对手类型：

| 风格 | 缩写 | 特点 |
|------|------|------|
| 紧凶 | TAG | 少入池，下注凶猛 |
| 松凶 | LAG | 多入池，积极施压 |
| 跟注站 | — | 什么牌都跟 |
| 岩石 | NIT | 极其保守 |
| 疯子 | — | 不可预测的疯狂打法 |

### 💭 AI 思考过程展示
每个 AI 决策后显示思考气泡，帮助你学习不同风格的决策逻辑。

### 📖 GTO 建议
- 翻牌前 / 翻牌后 GTO 策略指导
- 实时显示当前局面的最优打法建议

### 📝 手牌测验模式
- 12 个精选场景，覆盖 5 个类别：基础、价值下注、底池赔率、诈唬、位置
- 测试并提升你的决策能力

### 📊 数据统计
- 决策准确率、胜率、筹码变化
- 数据持久化存储在浏览器 localStorage

### 🏆 锦标赛模式
- 盲注递增，10 个级别
- 模拟真实锦标赛体验

### 🎓 新手教程
- 引导式教学，从零开始学习德州扑克

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 5 | 类型安全 |
| Vite | 6 | 构建工具 |

- **纯前端**，无后端依赖
- LLM 配置存储在浏览器 localStorage

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 `http://localhost:5173` 即可开始游戏。

## LLM 配置

1. 点击界面右上角的 🤖 **AI设置** 按钮
2. 填写 API 配置信息
3. 支持任何 **OpenAI 兼容接口**

**默认配置：**

| 配置项 | 默认值 |
|--------|--------|
| API Base | `https://open.bigmodel.cn/api/coding/paas/v4` |
| Model | `glm-5-turbo` |

> ⚠️ API Key 仅存储在浏览器本地，不会发送到任何第三方服务器。

## 项目结构

```
src/
├── components/       # UI 组件
├── engine/           # 扑克引擎（手牌评估、底池计算等）
├── ai/               # AI 决策逻辑
├── hooks/            # React hooks
├── utils/            # 工具函数
├── types/            # TypeScript 类型定义
└── App.tsx           # 应用入口
```

## 截照

<!-- 截图占位 -->
```
游戏主界面
手牌测验
数据统计
```

---

**德州扑克训练** — 在实战中提升你的扑克策略 🚀
