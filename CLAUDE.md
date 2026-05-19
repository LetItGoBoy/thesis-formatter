# 论文格式化工具 — Thesis Formatter

将格式混乱的本科论文自动格式化为呼伦贝尔学院标准格式的网页工具。内部工具，供本校学生使用。

## 项目结构

thesis-formatter/
├── frontend/          # Next.js 14 + TypeScript
├── backend/           # Python Flask
│   └── lib/
│       └── ai_client.py  # AI多模型适配层
├── config/
│   └── formats/
│       └── hulunbeier_univ.json
└── CLAUDE.md

## 技术栈

### 前端（frontend/）
Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Zustand

### 后端（backend/）
Python Flask · python-docx · mammoth · 多模型AI适配层

### 部署
Sealos云平台，前后端各一个开发箱

## AI模型配置

通过环境变量 AI_PROVIDER 切换模型，支持：
- deepseek（推荐，¥0.01/篇）
- qwen（通义千问）
- zhipu（GLM，免费版可用于开发测试）
- moonshot（Kimi，长文本强）
- claude（效果最好但最贵，备用）
- openai（海外备用）

所有模型通过 backend/lib/ai_client.py 统一调用，切换模型只改环境变量，业务代码不动。

## 核心交互流程 ⚠️ 最重要

用户上传.docx
    ↓
Flask解析文档 → 提取所有段落（一段不漏）
    ↓
AI识别每个段落类型 + 置信度
    ↓
前端显示【全量识别结果确认页面】
    ↓ 格式化按钮此时禁用
用户逐段确认（可修改类型和文字内容）
    ↓
所有段落 confirmed=true → 格式化按钮激活
    ↓
Flask按格式规则重建.docx → 用户下载

## 全量确认页面规格 ⚠️ 强制要求

- 显示论文所有段落，一段都不能省略
- 每段显示：编号、AI识别类型（可修改）、原文内容（可编辑）、置信度进度条
- 置信度低于70%：橙色左边框 + 警告提示，加载后自动滚动到第一个低置信段落
- 顶部进度条显示已确认X/总数N段，实时更新
- 支持过滤：全部 / 待确认 / 低置信 / 已确认
- 支持批量操作：全选 → 批量修改类型 → 批量确认
- 支持单段编辑：修改类型（下拉）+ 修改文字（textarea）→ 确认
- 支持撤销：已确认的段落可撤销重改
- 格式化按钮：所有段落confirmed=true之前永远禁用，代码层面强制

## 段落类型定义

h1        一级标题
h2        二级标题
h3        三级标题
abstract  摘要正文
body      正文段落
ref       参考文献条目
caption   图表题注
cover     封面信息
toc       目录内容
keywords  关键词行
conclusion 总结正文

## 关键技术规则 ⚠️ 必须实现

### 中英文混排字体（字符级别）
全文所有段落，中文字符用该段落指定字体，数字和英文字母一律使用Times New Roman。
实现：对每个paragraph的run进行字符级扫描，用正则[\u4e00-\u9fff]区分中文和ASCII，分别设置不同字体的run。

### 表格不跨页
所有表格整体必须在同一页，不允许跨页断行。
实现：对table每行设置cantSplit=1。若表格超过一整页高度，界面提示用户手动处理。

### 三线表
上下框线1.5磅，中间框线1磅，无其他边框线。

## API接口约定

POST /api/parse
  入参：multipart/form-data，字段名 file（.docx文件）
  返参：{paragraphs:[{index, type, text, confidence}]}

POST /api/format
  入参：{paragraphs:[{index, type, text}], template:"hulunbeier_univ"}
  返参：.docx文件流

## 环境变量

AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

FLASK_URL=http://localhost:5000
FLASK_PORT=5000
NEXT_PUBLIC_API_URL=http://localhost:5000

## 开发规范

- 平台相关代码放在 frontend/lib/ 和 backend/lib/ 适配层
- 格式逻辑只读 config/formats/ 下的JSON，不硬编码任何格式数值
- AI调用只通过 backend/lib/ai_client.py，不在其他地方直接调用模型API
- 环境变量统一在 .env 文件管理，代码里不出现任何API Key

## 付费功能规划（第二阶段，暂不开发）

- 免费：基础格式对齐，每天3次
- 付费1元/篇：参考文献GB/T 7714标准化、图表编号检查、历史记录、无限次
- 支付：微信支付（先收款码手动验证，再接API）

## 当前进度

- [ ] 项目初始化
- [ ] backend/lib/ai_client.py 多模型适配层
- [ ] Flask基础服务 + /api/parse接口
- [ ] AI段落识别（含置信度）
- [ ] 前端上传页面
- [ ] 全量确认页面（核心）
- [ ] python-docx格式化输出（含混排字体+表格不跨页）
- [ ] 部署到Sealos
