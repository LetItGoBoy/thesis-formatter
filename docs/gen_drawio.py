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
# 分层标题块用更饱和的描边色作底色
HEADER = {
    'blue': '#6C8EBF', 'green': '#82B366', 'orange': '#D79B00',
    'purple': '#9673A6', 'gray': '#7F7F7F', 'teal': '#0E8088',
}
BAND = ('#F7F9FC', '#AEB8C2')


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

    def box(self, value, x, y, w, h, color, font=13, bold=False):
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
              f'strokeColor={HEADER[color]};fontColor=#FFFFFF;fontStyle=1;fontSize=13;')
        return self.node(value, x, y, w, h, st)

    def title(self, value, x, y, w):
        st = 'text;html=1;align=center;verticalAlign=middle;fontSize=16;fontStyle=1;fontColor=#33475B;'
        return self.node(value, x, y, w, 30, st)

    def edge(self, s, t, label='', dashed=False, color='#5A6B7B',
             exitp=None, entryp=None):
        sid = self.nid()
        style = (f'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor={color};'
                 f'strokeWidth=1.6;endArrow=block;endFill=1;fontSize=11;fontColor=#33475B;'
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
# 通用：分层堆叠图（用于 模块图 / 技术架构图）
# ------------------------------------------------------------------
def layered(name, title, layers, pageW=1280):
    band_h, gap, top = 100, 28, 60
    pageH = top + len(layers) * band_h + (len(layers) - 1) * gap + 40
    d = Doc(name, pageW, pageH)
    d.title(title, 0, 16, pageW)
    hdr_ids = []
    for li, (lname, color, nodes) in enumerate(layers):
        by = top + li * (band_h + gap)
        d.band(40, by, pageW - 80, band_h)
        hid = d.header(lname, 56, by + (band_h - 60) // 2, 120, 60, color)
        hdr_ids.append(hid)
        # 节点区
        ax0, axr = 200, pageW - 60
        avail = axr - ax0
        n = len(nodes)
        nw = 150 if n <= 6 else 132
        group = n * nw + (n - 1) * 22
        sx = ax0 + max(0, (avail - group) // 2)
        ny = by + (band_h - 56) // 2
        for k, lab in enumerate(nodes):
            d.box(lab, sx + k * (nw + 22), ny, nw, 56, color, font=12)
    # 层间向下箭头（沿标题块）
    for a, b in zip(hdr_ids, hdr_ids[1:]):
        d.edge(a, b, color='#8A98A6')
    return d


# 1) 系统功能模块图
d1 = layered('系统功能模块图', '图2  本科论文规范交付智能助手系统功能模块图', [
    ('用户层', 'blue',   ['学生', '指导教师', '教学管理人员']),
    ('应用层', 'green',  ['提交前体检', '学术表达优化', '格式对齐', '标准 Word 导出', '课程工作台拓展']),
    ('规则层', 'orange', ['呼伦贝尔学院本科论文格式规范', '教师审核经验', '常见错误库', '校本规则库']),
    ('技术层', 'purple', ['文档解析', '结构识别', '规则匹配', '大模型接口', 'Word 重构', '日志统计']),
    ('数据层', 'gray',   ['论文样本', '规则条目', '处理记录', '用户反馈', '应用评价数据']),
])
d1.save('图2-系统功能模块图.drawio')

# 4) 技术架构图
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
d2 = Doc('论文规范交付闭环流程图', 1280, 380)
d2.title('图3  论文规范交付闭环流程图', 0, 16, 1280)
NW, NH = 160, 52
r1y, r2y = 80, 250
xs = [40, 235, 430, 625, 820, 1015]
row1 = [('上传论文', 'gray'), ('文档解析', 'blue'), ('提交前体检', 'orange'),
        ('问题清单生成', 'orange'), ('用户选择修改', 'yellow'), ('学术表达优化', 'green')]
row2 = [('格式对齐', 'green'), ('人工确认', 'yellow'), ('标准 Word 导出', 'blue'),
        ('应用数据反馈', 'gray'), ('规则库迭代', 'purple')]
id1 = [d2.box(v, xs[k], r1y, NW, NH, c) for k, (v, c) in enumerate(row1)]
# row2 从右到左放在 xs[5..1]
id2 = [d2.box(v, xs[5 - k], r2y, NW, NH, c) for k, (v, c) in enumerate(row2)]
for a, b in zip(id1, id1[1:]):
    d2.edge(a, b)
d2.edge(id1[5], id2[0])                       # 学术表达优化 -> 格式对齐（向下）
for a, b in zip(id2, id2[1:]):
    d2.edge(a, b)
# 反哺：规则库迭代(最左, xs[1]) -> 提交前体检(xs[2]) 顶部绕行
d2.edge(id2[4], id1[2], '反哺 · 规则库迭代', dashed=True, color='#B85450',
        exitp=(0.5, 0), entryp=(0.5, 1))
d2.save('图3-论文规范交付闭环流程图.drawio')

# ------------------------------------------------------------------
# 3) 校本规则库构建流程图（三源汇聚 + 迭代回环）
# ------------------------------------------------------------------
d3 = Doc('校本规则库构建流程图', 1180, 340)
d3.title('图4  校本规则库构建流程图', 0, 16, 1180)
src = [d3.box('学校论文规范文件梳理', 40, 60, 190, 54, 'blue'),
       d3.box('指导教师经验归纳', 40, 145, 190, 54, 'green'),
       d3.box('学生常见错误收集', 40, 230, 190, 54, 'orange')]
split = d3.box('规则条目拆解', 300, 145, 150, 54, 'purple')
model = d3.box('可计算规则建模', 510, 145, 150, 54, 'purple')
impl = d3.box('系统规则库实现', 720, 145, 150, 54, 'teal')
fix = d3.box('应用反馈修正', 930, 145, 160, 54, 'gray')
for s in src:
    d3.edge(s, split)
d3.edge(split, model)
d3.edge(model, impl)
d3.edge(impl, fix)
d3.edge(fix, model, '迭代修正', dashed=True, color='#B85450',
        exitp=(0.5, 0), entryp=(0.5, 0))
d3.save('图4-校本规则库构建流程图.drawio')

print('ALL DONE ->', OUTDIR)
