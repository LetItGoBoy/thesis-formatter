# -*- coding: utf-8 -*-
"""生成 4 张 draw.io (.drawio) 图：系统功能模块图 / 论文规范交付闭环流程图 /
校本规则库构建流程图 / 技术架构图。配色采用 draw.io 经典柔和方案，适合项目申报。"""
import os

OUTDIR = '/home/user/thesis-formatter/docs/drawio'
os.makedirs(OUTDIR, exist_ok=True)

# 经典柔和配色 (fill, stroke)
PAL = {
    'blue':   ('#DAE8FC', '#6C8EBF'),
    'green':  ('#D5E8D4', '#82B366'),
    'orange': ('#FFE6CC', '#D79B00'),
    'purple': ('#E1D5E7', '#9673A6'),
    'gray':   ('#F5F5F5', '#666666'),
    'yellow': ('#FFF2CC', '#D6B656'),
    'red':    ('#F8CECC', '#B85450'),
    'teal':   ('#B0E3E6', '#0E8088'),
}
HEADER = {
    'blue': '#6C8EBF', 'green': '#82B366', 'orange': '#D79B00',
    'purple': '#9673A6', 'gray': '#7F7F7F', 'teal': '#0E8088',
}
BAND = ('#F7F9FC', '#AEB8C2')

# 字号常量（与正文小四/12pt 对齐，draw.io 单位约等于 pt）
FS_BODY   = 16   # 节点正文字号
FS_HEADER = 16   # 层标题字号
FS_TITLE  = 20   # 图题字号
FS_EDGE   = 15   # 箭头标签字号


def esc(s):
    return s.replace('&', '/').replace('<', '（').replace('>', '）')


class Doc:
    def __init__(self, name, w, h):
        self.name = name
        self.w, self.h = w, h
        self.cells = []
        self.i = 2

    def nid(self):
        self.i += 1
        return f'n{self.i}'

    def node(self, value, x, y, w, h, style, cid=None):
        cid = cid or self.nid()
        self.cells.append(
            f'<mxCell id="{cid}" value="{esc(value)}" style="{style}" vertex="1" parent="1">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return cid

    def box(self, value, x, y, w, h, color, font=None, bold=False):
        font = font or FS_BODY
        fill, stroke = PAL[color]
        st = (f'rounded=1;arcSize=12;whiteSpace=wrap;html=1;fillColor={fill};'
              f'strokeColor={stroke};fontColor=#1A1A1A;fontSize={font};'
              f'{"fontStyle=1;" if bold else ""}shadow=0;')
        return self.node(value, x, y, w, h, st)

    def band(self, x, y, w, h):
        st = f'rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor={BAND[0]};strokeColor={BAND[1]};dashed=0;'
        return self.node('', x, y, w, h, st)

    def header(self, value, x, y, w, h, color):
        st = (f'rounded=1;arcSize=14;whiteSpace=wrap;html=1;fillColor={HEADER[color]};'
              f'strokeColor={HEADER[color]};fontColor=#FFFFFF;fontStyle=1;fontSize={FS_HEADER};')
        return self.node(value, x, y, w, h, st)

    def title(self, value, x, y, w):
        st = f'text;html=1;align=center;verticalAlign=middle;fontSize={FS_TITLE};fontStyle=1;fontColor=#33475B;'
        return self.node(value, x, y, w, 36, st)

    def edge(self, s, t, label='', dashed=False, color='#5A6B7B',
             exitp=None, entryp=None):
        sid = self.nid()
        style = (f'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor={color};'
                 f'strokeWidth=2;endArrow=block;endFill=1;fontSize={FS_EDGE};fontColor=#33475B;'
                 + ('dashed=1;' if dashed else ''))
        if exitp:
            style += f'exitX={exitp[0]};exitY={exitp[1]};exitDx=0;exitDy=0;'
        if entryp:
            style += f'entryX={entryp[0]};entryY={entryp[1]};entryDx=0;entryDy=0;'
        self.cells.append(
            f'<mxCell id="{sid}" value="{esc(label)}" style="{style}" edge="1" '
            f'parent="1" source="{s}" target="{t}"><mxGeometry relative="1" as="geometry"/></mxCell>')

    def xml(self):
        body = '\n        '.join(self.cells)
        return (
            f'<mxfile host="app.diagrams.net" agent="thesis-formatter" version="24.7.0">\n'
            f'  <diagram id="{self.name}" name="{esc(self.name)}">\n'
            f'    <mxGraphModel dx="900" dy="640" grid="1" gridSize="10" guides="1" '
            f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
            f'pageWidth="{self.w}" pageHeight="{self.h}" math="0" shadow="0">\n'
            f'      <root>\n        <mxCell id="0"/>\n        <mxCell id="1" parent="0"/>\n'
            f'        {body}\n      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n')

    def save(self, fn):
        with open(os.path.join(OUTDIR, fn), 'w', encoding='utf-8') as f:
            f.write(self.xml())
        print('SAVED', fn)


# ------------------------------------------------------------------
# 通用：分层堆叠图（节点宽高随字号放大）
# ------------------------------------------------------------------
def layered(name, title_text, layers, pageW=1500):
    # 节点尺寸放大以容纳 16pt 字体
    NW = 176   # 节点宽
    NH = 68    # 节点高
    HDR_W = 140
    HDR_H = 68
    GAP_X = 24  # 节点水平间距
    band_h = 110
    gap    = 32
    top    = 72

    pageH = top + len(layers) * band_h + (len(layers) - 1) * gap + 50
    d = Doc(name, pageW, pageH)
    d.title(title_text, 0, 18, pageW)
    hdr_ids = []
    for li, (lname, color, nodes) in enumerate(layers):
        by = top + li * (band_h + gap)
        d.band(40, by, pageW - 80, band_h)
        hid = d.header(lname, 56, by + (band_h - HDR_H) // 2, HDR_W, HDR_H, color)
        hdr_ids.append(hid)
        ax0  = 56 + HDR_W + 24
        axr  = pageW - 50
        avail = axr - ax0
        n = len(nodes)
        group = n * NW + (n - 1) * GAP_X
        sx = ax0 + max(0, (avail - group) // 2)
        ny = by + (band_h - NH) // 2
        for k, lab in enumerate(nodes):
            d.box(lab, sx + k * (NW + GAP_X), ny, NW, NH, color)
    for a, b in zip(hdr_ids, hdr_ids[1:]):
        d.edge(a, b, color='#8A98A6')
    return d


# ── 1) 系统功能模块图 ──────────────────────────────────────────────
d1 = layered('系统功能模块图', '图2  本科论文规范交付智能助手系统功能模块图', [
    ('用户层', 'blue',   ['学生', '指导教师', '教学管理人员']),
    ('应用层', 'green',  ['提交前体检', '学术表达优化', '格式对齐', '标准 Word 导出', '课程工作台拓展']),
    ('规则层', 'orange', ['呼伦贝尔学院本科论文格式规范', '教师审核经验', '常见错误库', '校本规则库']),
    ('技术层', 'purple', ['文档解析', '结构识别', '规则匹配', '大模型接口', 'Word 重构', '日志统计']),
    ('数据层', 'gray',   ['论文样本', '规则条目', '处理记录', '用户反馈', '应用评价数据']),
])
d1.save('图2-系统功能模块图.drawio')

# ── 4) 技术架构图 ─────────────────────────────────────────────────
d4 = layered('技术架构图', '图5  本科论文规范交付智能助手技术架构图', [
    ('前端界面层', 'blue',   ['Web 端', '论文工具入口', '课程工作台入口']),
    ('后端服务层', 'green',  ['文档上传', '文档解析', 'AI 调用', '规则检查', '格式重构', '任务管理']),
    ('智能服务层', 'teal',   ['学术表达优化', '结构识别', '规范风险诊断']),
    ('文档处理层', 'purple', ['docx 解析', '样式识别', '段落分类', 'Word 导出']),
    ('数据支撑层', 'orange', ['规则库', '用户日志', '文档处理记录', '反馈数据']),
    ('部署层',     'gray',   ['阿里云服务器', 'Nginx', '前后端服务', '数据库 / 文件存储']),
])
d4.save('图5-技术架构图.drawio')

# ------------------------------------------------------------------
# 2) 论文规范交付闭环流程图（蛇形 + 反哺虚线）
# ------------------------------------------------------------------
# 节点尺寸放大
NW, NH = 190, 64
r1y, r2y = 90, 290
# 6列均布于 1400px 宽页面
pageW2 = 1400
col_step = (pageW2 - NW - 40) // 5   # ≈ 234
xs = [20 + k * col_step for k in range(6)]

d2 = Doc('论文规范交付闭环流程图', pageW2, 440)
d2.title('图3  论文规范交付闭环流程图', 0, 18, pageW2)

row1 = [('上传论文', 'gray'), ('文档解析', 'blue'), ('提交前体检', 'orange'),
        ('问题清单生成', 'orange'), ('用户选择修改', 'yellow'), ('学术表达优化', 'green')]
row2 = [('格式对齐', 'green'), ('人工确认', 'yellow'), ('标准 Word 导出', 'blue'),
        ('应用数据反馈', 'gray'), ('规则库迭代', 'purple')]

id1 = [d2.box(v, xs[k], r1y, NW, NH, c) for k, (v, c) in enumerate(row1)]
id2 = [d2.box(v, xs[5 - k], r2y, NW, NH, c) for k, (v, c) in enumerate(row2)]

for a, b in zip(id1, id1[1:]):
    d2.edge(a, b)
d2.edge(id1[5], id2[0])
for a, b in zip(id2, id2[1:]):
    d2.edge(a, b)
d2.edge(id2[4], id1[2], '反哺 · 规则库迭代', dashed=True, color='#B85450',
        exitp=(0.5, 0), entryp=(0.5, 1))
d2.save('图3-论文规范交付闭环流程图.drawio')

# ------------------------------------------------------------------
# 3) 校本规则库构建流程图（三源汇聚 + 迭代回环）
# ------------------------------------------------------------------
NW3, NH3 = 200, 68

d3 = Doc('校本规则库构建流程图', 1380, 400)
d3.title('图4  校本规则库构建流程图', 0, 18, 1380)

src = [d3.box('学校论文规范文件梳理', 30,  70, NW3, NH3, 'blue'),
       d3.box('指导教师经验归纳',     30, 166, NW3, NH3, 'green'),
       d3.box('学生常见错误收集',     30, 262, NW3, NH3, 'orange')]
split = d3.box('规则条目拆解',   310, 166, NW3, NH3, 'purple')
model = d3.box('可计算规则建模', 570, 166, NW3, NH3, 'purple')
impl  = d3.box('系统规则库实现', 830, 166, NW3, NH3, 'teal')
fix   = d3.box('应用反馈修正',  1090, 166, NW3, NH3, 'gray')

for s in src:
    d3.edge(s, split)
d3.edge(split, model)
d3.edge(model, impl)
d3.edge(impl, fix)
d3.edge(fix, model, '迭代修正', dashed=True, color='#B85450',
        exitp=(0.5, 0), entryp=(0.5, 0))
d3.save('图4-校本规则库构建流程图.drawio')

print('ALL DONE ->', OUTDIR)
