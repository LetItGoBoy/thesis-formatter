# 论文格式化工具 — Thesis Formatter

呼伦贝尔学院本科论文格式自动化工具。内部工具，供本校学生使用。

---

## 项目结构

```
thesis-formatter/
├── frontend/                        # Next.js 14 + TypeScript
│   ├── app/
│   │   ├── page.tsx                 # 上传页面
│   │   ├── review/page.tsx          # 分块确认页面（核心）
│   │   └── done/page.tsx            # 下载完成页面
│   ├── lib/
│   │   └── api.ts                   # 封装所有后端API调用
│   └── package.json
├── backend/                         # Python Flask
│   ├── app.py                       # Flask主文件
│   ├── lib/
│   │   ├── ai_client.py             # AI多模型适配层（批量识别）
│   │   ├── parser.py                # 解析.docx提取段落
│   │   └── formatter.py             # 格式化核心逻辑
│   ├── requirements.txt
│   └── Dockerfile
├── config/
│   └── formats/
│       └── hulunbeier_univ.json     # 格式规则配置
└── CLAUDE.md
```

---

## 技术栈

### 前端

Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · Zustand

### 后端

Python Flask · python-docx · mammoth · 多模型AI适配层

### 部署

Sealos云平台，前后端各一个开发箱

- 后端公网地址：https://hnhkyqaiecoj.sealoshzh.site
- 前端通过环境变量 NEXT_PUBLIC_API_URL 配置后端地址

---

## 环境变量

```
# 后端 .env
AI_PROVIDER=moonshot
MOONSHOT_API_KEY=你的Key
MOONSHOT_MODEL=moonshot-v1-8k
FLASK_PORT=5000

# 前端 .env.local
NEXT_PUBLIC_API_URL=https://hnhkyqaiecoj.sealoshzh.site
```

---

## AI模型配置

通过环境变量 AI_PROVIDER 切换，支持：

- moonshot（Kimi，当前使用，¥0.01/篇）
- deepseek（推荐备选，¥0.01/篇）
- zhipu（GLM，免费版可用于测试）
- qwen（通义千问）
- claude（效果最好但最贵，备用）

所有模型通过 backend/lib/ai_client.py 统一调用。
切换模型只改环境变量，业务代码不动。

---

## 核心交互流程 ⚠️ 最重要

```
用户上传 .docx
    ↓
Flask 解析文档 → 提取所有段落（一段不漏）
    ↓
AI 一次性批量识别所有段落类型 + 置信度（1次API调用，不是N次）
    ↓
前端显示【分块确认页面】
按5个大块展示：目录 / 摘要 / 正文 / 总结 / 参考文献
    ↓  ← 格式化按钮此时禁用
用户逐块逐段确认（可修改类型和文字内容）
    ↓
所有段落 confirmed=true → 格式化按钮激活
    ↓
Flask 按格式规则重建 .docx → 用户下载
```

---

## 分块确认页面规格 ⚠️ 强制要求

### 总体要求

- 页面顶部显示总进度条：已确认 X / 总数 N 段，实时更新
- 格式化按钮：所有段落 confirmed=true 之前永远禁用，代码层面强制
- 五个大块按顺序排列：目录 → 摘要 → 正文 → 总结 → 参考文献

### 每个大块的交互

- 有块标题和该块进度（已确认X/Y段）
- 可以折叠/展开
- 有独立的"全部确认本块"按钮
- 有独立的重构预览区域
- 过滤：全部 / 待确认 / 低置信 / 已确认
- 每段可单独编辑类型（下拉）和文字内容（textarea）
- 每段有单独确认和撤销按钮
- 置信度低于70%：橙色左边框 + 警告提示

### 重构预览功能

- 每个大块有独立预览按钮
- 用户修改下拉类型后，预览同步刷新
- 预览体现标题、正文、关键词、图表说明等样式差异
- 各大块之间显示"另起一页"分隔提示
- 关键词预览必须显示为空格分隔，不允许出现分号

### 各块下拉选项（各块只显示本块类型）

**目录块：**

```
toc_title → 目录标题
toc_h1    → 一级目录
toc_h2    → 二级目录
toc_h3    → 三级目录
```

**摘要块：**

```
paper_title       → 论文题目
author_line       → 作者
instructor        → 指导老师
abstract_title_cn → 摘要标题（中文）
abstract_body_cn  → 摘要正文（中文）
keywords_cn       → 关键词（中文）
abstract_title_en → Abstract标题
abstract_body_en  → 摘要正文（英文）
keywords_en       → 关键词（英文）
```

**正文块（禁止出现 cover）：**

```
h1             → 一级标题
h2             → 二级标题
h3             → 三级标题
body           → 正文
numbered_item  → 数字序号
table_caption  → 表说明
table          → 表
formula        → 公式
formula_number → 公式序号
figure_caption → 图说明
caption        → 图表题注（兼容旧类型）
```

**总结块（禁止出现 future_work）：**

```
conclusion_title → 总结标题
conclusion_body  → 总结正文
```

**参考文献块：**

```
references_title → 参考文献标题
reference_item   → 参考文献正文
ref              → 参考文献（兼容旧类型）
```

---

## 全局格式规则 ⚠️ 所有格式化必须遵守

### 规则一：取消文档网格（最高优先级）

所有段落在设置任何格式之前，必须先调用：

```python
disable_snap_to_grid(paragraph)
```

实现：

```python
def disable_snap_to_grid(paragraph):
    pPr = paragraph._p.get_or_add_pPr()
    snapToGrid = pPr.find(qn('w:snapToGrid'))
    if snapToGrid is None:
        snapToGrid = OxmlElement('w:snapToGrid')
        pPr.append(snapToGrid)
    snapToGrid.set(qn('w:val'), '0')
```

无一例外，所有段落都要先取消文档网格，再设置行间距。

### 规则二：中英文混排字体（字符级别）

论文中所有数字和英文字母（包括标题编号、图表编号、公式编号、参考文献中的英文）一律使用 Times New Roman。
中文字符使用各段落指定的中文字体。
实现：

```python
run.font.name = chinese_font
run._element.rPr.rFonts.set(qn('w:eastAsia'), chinese_font)
run._element.rPr.rFonts.set(qn('w:ascii'), 'Times New Roman')
run._element.rPr.rFonts.set(qn('w:hAnsi'), 'Times New Roman')
run._element.rPr.rFonts.set(qn('w:cs'), 'Times New Roman')
```

用正则 [\u4e00-\u9fff] 区分中文和ASCII字符，分别设置字体。

### 规则三：表格不跨页

所有表格整体必须在同一页，不允许跨页断行。
实现：对每行设置 cantSplit=1。
若表格超过一整页高度，界面提示用户手动处理。

### 规则四：三线表

上下框线 1.5 磅，中间框线 1 磅，无其他边框线。

### 规则五：关键词空格分隔

中文关键词和英文关键词之间必须使用空格分隔。
禁止使用分号（;）或顿号（、）。
后端格式化时自动将 ; ； , ， 等替换为空格，多个空格合并为一个。

### 规则六：每个大块另起一页

```
目录大块   → 独立起始页
摘要大块   → 另起一页
正文大块   → 另起一页
总结大块   → 另起一页
参考文献大块 → 另起一页
```

正文中每个一级标题（h1）也必须另起一页。

### 规则七：数字序号格式

正文中数字序号使用英文点号（.），禁止使用中文顿号（、）。
后端自动将 1、2、3、替换为 1. 2. 3.

---

## 页面设置

```python
section.top_margin    = Cm(2.5)
section.bottom_margin = Cm(2.0)
section.left_margin   = Cm(3.0)
section.right_margin  = Cm(2.0)
# 装订线：0，方向：纵向，页码范围：普通
```

---

## 段落格式规格

### 目录模块

**toc_title 目录标题**

- 字体：黑体
- 字号：三号（16pt）
- 加粗：是
- 对齐：居中
- 内容：目   录（中间三个空格）

**toc_h1 一级目录**

- 字体：宋体
- 字号：小四（12pt）
- 行间距：1.5倍
- 缩进：无
- 与目录标题间隔一行

**toc_h2 二级目录**

- 字体：宋体
- 字号：小四（12pt）
- 行间距：1.5倍
- 缩进：前置两个空格

**toc_h3 三级目录**

- 字体：宋体
- 字号：小四（12pt）
- 行间距：1.5倍
- 缩进：前置四个空格

---

### 摘要模块

**paper_title 论文题目**

- 字体：宋体
- 字号：小二（18pt）
- 加粗：是
- 对齐：居中

**author_line 作者**

- 字体：仿宋
- 字号：小四（12pt）
- 对齐：居中
- 行间距：1.5倍
- 与题目空一行

**instructor 指导老师**

- 字体：仿宋
- 字号：小四（12pt）
- 对齐：居中
- 行间距：1.5倍

**abstract_title_cn 摘要标题（中文）**

- 字体：仿宋
- 字号：小四（12pt）
- 加粗：是
- 对齐：顶格（左对齐，无缩进）
- 提示：字数建议200-400字

**abstract_body_cn 摘要正文（中文）**

- 字体：仿宋
- 字号：小四（12pt）
- 行间距：1.5倍

**keywords_cn 关键词（中文）**

- 字体：仿宋
- 字号：小四（12pt）
- 加粗：是
- 对齐：顶格
- 与摘要正文空一行
- 关键词之间用空格分隔

**abstract_title_en Abstract标题**

- 字体：Times New Roman
- 字号：小四（12pt）
- 加粗：是
- 对齐：左对齐
- 与上文空一行

**abstract_body_en 摘要正文（英文）**

- 字体：Times New Roman
- 字号：小四（12pt）
- 行间距：固定值1.5倍

**keywords_en 关键词（英文）**

- 字体：Times New Roman
- 字号：小四（12pt）
- 加粗：是
- 对齐：顶格
- 行间距：1.5倍
- 关键词之间用空格分隔

---

### 正文模块

**h1 一级标题**

- 字体：宋体
- 字号：小三（15pt）
- 加粗：是
- 对齐：居中
- 每章必须另起一页
- 章和标题之间自动规范为两个空格
- 示例：第一章  绪论

**h2 二级标题**

- 字体：宋体
- 字号：四号（14pt）
- 加粗：是
- 对齐：左对齐
- 与一级标题空一行

**h3 三级标题**

- 字体：宋体
- 字号：小四（12pt）
- 加粗：是
- 对齐：左对齐

**body 正文**

- 字体：宋体
- 字号：小四（12pt）
- 行间距：1.5倍
- 字符间距：标准
- 首行缩进：2字符
- 对齐：两端对齐

**numbered_item 数字序号**

- 字体：宋体
- 字号：小四（12pt）
- 行间距：1.5倍
- 编号格式：数字后用英文点号（.），禁止顿号（、）

**table_caption 表说明**

- 位置：表格上方
- 字体：宋体
- 字号：五号（10.5pt）
- 对齐：居中
- 示例：表2-1 实验参数设置

**table 表**

- 字体：宋体（中文）/ Times New Roman（数字英文）
- 字号：五号（10.5pt）
- 内容：水平居中，垂直居中
- 样式：三线表



**formula_number 公式序号**

- 字体：Times New Roman
- 字号：五号（10.5pt）
- 位置：公式所在行最右边
- 格式：(章号-序号) 例如 (2-1)

**figure_caption 图说明**

- 位置：图片下方
- 字体：宋体
- 字号：五号（10.5pt）
- 对齐：居中
- 图序与图题之间空一格
- 示例：图2-2 单管换热系统流程图



---

### 总结模块（不含 future_work）

**conclusion_title 总结标题**

- 固定内容：总  结（中间两个字符空格）
- 字体：宋体
- 字号：小三（15pt）
- 加粗：是
- 对齐：居中
- 本块必须另起一页

**conclusion_body 总结正文**

- 字体：宋体
- 字号：小四（12pt）
- 行间距：1.5倍
- 首行缩进：2字符
- 对齐：两端对齐

---

### 参考文献模块

**references_title 参考文献标题**

- 固定内容：参考文献
- 字体：宋体
- 字号：四号（14pt）
- 加粗：是
- 对齐：居中
- 行间距：1.5倍
- 本块必须另起一页

**reference_item 参考文献正文**

- 字体：仿宋
- 字号：小四（12pt）
- 对齐：左对齐
- 无首行缩进
- 英文和数字：Times New Roman

**ref 参考文献（兼容旧类型）**

- 格式同 reference_item

---

## API接口约定

```
POST /api/parse
  入参：multipart/form-data，字段名 file（.docx文件）
  返参：{paragraphs:[{index, type, text, confidence, block}]}
  说明：block字段表示该段落所属大块（toc/abstract/body/conclusion/references）

POST /api/format
  入参：{paragraphs:[{index, type, text}], template:"hulunbeier_univ"}
  返参：.docx文件流
```

---

## 开发规范

- 平台相关代码放在 frontend/lib/ 和 backend/lib/ 适配层
- 格式逻辑只读 config/formats/ 下的JSON，不硬编码任何格式数值
- AI调用只通过 backend/lib/ai_client.py，使用批量识别（1次API调用）
- 环境变量统一在 .env 管理，代码里不出现任何API Key
- 所有段落格式化前必须调用 disable_snap_to_grid()
- 正文下拉框禁止出现 cover
- 总结下拉框禁止出现 future_work

---

## 兼容性说明

- ref → 兼容旧类型，新格式优先使用 reference_item
- caption → 兼容旧类型，新格式优先使用 table_caption / figure_caption
- cover → 后端可兼容，但前端所有下拉框中禁止显示
- future_work → 后端可兼容，但前端所有下拉框中禁止显示

---

## 付费功能规划（第二阶段，暂不开发）

- 免费：基础格式对齐，每天3次
- 付费¥1/篇：参考文献GB/T 7714标准化、图表编号检查、历史记录、无限次
- 支付：微信支付（先收款码手动验证，再接API）

---

## 当前进度

- [ ] 项目初始化
- [ ] backend/lib/ai_client.py 多模型适配层
- [ ] Flask基础服务 + /api/parse /api/format 接口
- [ ] 前端上传页面
- [ ] AI批量识别（1次API调用）⬅ 进行中
- [ ] 分块确认页面（5个大块，各自下拉选项）
- [ ] 重构预览功能（每块独立预览）
- [ ] formatter.py 完整格式化（含取消网格+混排字体+分页）
- [ ] 部署到Sealos稳定运行
