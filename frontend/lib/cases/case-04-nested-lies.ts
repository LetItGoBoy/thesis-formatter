/**
 * 第四案《嵌套的谎言》
 * 知识点（层层递进）：标量子查询 → IN 子查询 → EXISTS 相关子查询 →
 *                    集合运算 UNION → INTERSECT → EXCEPT
 *
 * 真相藏在一层层查询里：把「买过毒药的人」和「下毒时段离场的人」用集合运算
 * 求交，再减去已被洗清的人，唯一真凶浮出水面。
 */
import {
  type DetectiveCase,
  anyCellContains,
  includesAll,
} from "../db-detective";

const CULPRIT = "陆衡"; // 买毒{陆衡,孟川,葛朗} ∩ 离场{陆衡,周济,葛朗} = {陆衡,葛朗}，EXCEPT 已洗清{葛朗} = 陆衡

export const caseNestedLies: DetectiveCase = {
  id: "nested-lies",
  order: 4,
  concepts: "子查询 · EXISTS · UNION/INTERSECT/EXCEPT",
  culprit: CULPRIT,
  meta: {
    codename: "雾港谜案",
    subtitle: "第四案 · 嵌套与集合",
    title: "《嵌套的谎言》",
    intro:
      "顾府寿宴，顾老爷饮下毒酒身亡。毒物是稀有的「鹤顶红」，下毒就发生在酒杯无人看管的那一刻钟。宾客满座、各怀心事——真相要靠一层层嵌套的查询，把买过毒、又离过场的人求交，再排除有人证的，逼出唯一凶手。",
    arc: "顾老爷生前正在审计一批古董档案的真伪。校对者，似乎不想让这份审计完成。",
  },
  accusation: {
    prompt:
      "凶手要同时满足：买过鹤顶红、且在下毒时段（20:00–20:15）离开过宴会厅；并且排除掉已有人证洗清的人。这样的人只有一个。输入 TA 的姓名结案。",
    winNote:
      "你把推理写成了集合运算：买毒的人是一个集合，离场的人是另一个集合，INTERSECT 求交得到高度嫌疑，再用 EXCEPT 减去有人证的，剩下的就是真凶。子查询负责层层取证，集合运算负责合、交、差——这是 SQL 表达复杂逻辑的极致。",
  },
  seedSql: `
CREATE TABLE crime_report (id INTEGER PRIMARY KEY, date TEXT, type TEXT, victim TEXT, description TEXT);
INSERT INTO crime_report VALUES
 (1,'2024-04-12','投毒','顾老爷','顾府寿宴上，顾老爷饮下毒酒身亡。毒物为稀有的「鹤顶红」。下毒发生在 20:00–20:15 这段酒杯无人看管的时间。凶手必是买过鹤顶红、且在此时段离开过宴会厅的宾客。');

CREATE TABLE guests (id INTEGER PRIMARY KEY, name TEXT, role TEXT);
INSERT INTO guests VALUES
 (1,'沈昭','富商'),
 (2,'陆衡','世侄'),
 (3,'白芷','远房表妹'),
 (4,'孟川','生意对手'),
 (5,'秦五','管家'),
 (6,'阿香','婢女'),
 (7,'周济','医生'),
 (8,'葛朗','债主');

CREATE TABLE purchases (id INTEGER PRIMARY KEY, guest_id INTEGER, item TEXT, amount INTEGER);
INSERT INTO purchases VALUES
 (1,2,'鹤顶红',8000),
 (2,4,'鹤顶红',6000),
 (3,8,'鹤顶红',9000),
 (4,1,'字画',50000),
 (5,3,'胭脂',300),
 (6,5,'米面',200),
 (7,6,'布匹',150),
 (8,7,'药材',2000),
 (9,2,'马匹',12000),
 (10,8,'赌债清偿',3000);

CREATE TABLE banquet_log (guest_id INTEGER, action TEXT, time TEXT);
INSERT INTO banquet_log VALUES
 (2,'离开','20:00'),(2,'返回','20:14'),
 (7,'离开','20:05'),(7,'返回','20:09'),
 (8,'离开','20:01'),(8,'返回','20:03'),
 (1,'离开','19:30'),(1,'返回','19:40');

CREATE TABLE cleared (guest_id INTEGER, reason TEXT);
INSERT INTO cleared VALUES
 (8,'仅外出 2 分钟结清赌债，管家全程在场作证');
`,
  schema: [
    {
      name: "crime_report",
      comment: "投毒案报告",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "date", type: "TEXT" },
        { name: "type", type: "TEXT" },
        { name: "victim", type: "TEXT" },
        { name: "description", type: "TEXT", note: "线索" },
      ],
    },
    {
      name: "guests",
      comment: "寿宴宾客",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "role", type: "TEXT" },
      ],
    },
    {
      name: "purchases",
      comment: "近期采购记录",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "guest_id", type: "INTEGER", note: "→ guests.id" },
        { name: "item", type: "TEXT", note: "物品" },
        { name: "amount", type: "INTEGER", note: "金额" },
      ],
    },
    {
      name: "banquet_log",
      comment: "宴会厅进出记录",
      columns: [
        { name: "guest_id", type: "INTEGER", note: "→ guests.id" },
        { name: "action", type: "TEXT", note: "离开 / 返回" },
        { name: "time", type: "TEXT" },
      ],
    },
    {
      name: "cleared",
      comment: "已被人证洗清的人",
      columns: [
        { name: "guest_id", type: "INTEGER", note: "→ guests.id" },
        { name: "reason", type: "TEXT" },
      ],
    },
  ],
  levels: [
    {
      id: "scalar-sub",
      badge: "线索 01",
      title: "谁出手阔绰",
      concept: "标量子查询 · 子查询入门",
      story:
        "案子千头万绪，先用一个小查询热身：找出采购金额高于全场平均的那几笔。子查询可以先算出『平均值』这一个数，外层再拿它来比。",
      task: "找出 purchases 里金额高于全场平均金额的采购记录。",
      skeleton: "SELECT ___, ___, ___ FROM purchases\nWHERE amount > (SELECT ___ FROM ___);",
      hint: "括号里的子查询先算平均：(SELECT AVG(amount) FROM purchases)，外层 WHERE amount > 它。会查到字画和马匹两笔——贵，但贵不等于有罪。",
      solution:
        "SELECT guest_id, item, amount FROM purchases WHERE amount > (SELECT AVG(amount) FROM purchases);",
      validate: (res) =>
        anyCellContains(res, "50000") && anyCellContains(res, "12000") && !includesAll(res, ["300"]),
    },
    {
      id: "in-sub",
      badge: "线索 02",
      title: "谁买过鹤顶红",
      concept: "IN 子查询",
      story:
        "毒物是鹤顶红。先锁定买过这味毒的人——内层子查询找出他们的 id，外层再换成姓名。",
      task: "用 IN 子查询，查出所有买过「鹤顶红」的宾客姓名。",
      skeleton: "SELECT ___ FROM guests\nWHERE id IN (SELECT ___ FROM ___ WHERE ___ = ___);",
      hint: "内层 SELECT guest_id FROM purchases WHERE item='鹤顶红' 先取出买家 id；外层 WHERE id IN (...) 换出姓名。共 3 人。",
      solution: "SELECT name FROM guests WHERE id IN (SELECT guest_id FROM purchases WHERE item='鹤顶红');",
      validate: (res) =>
        ["陆衡", "孟川", "葛朗"].every((n) => anyCellContains(res, n)) && res.rows.length === 3,
    },
    {
      id: "exists",
      badge: "线索 03",
      title: "谁在下毒时离了席",
      concept: "EXISTS · 相关子查询",
      story:
        "下毒发生在 20:00–20:15。谁在这段时间离开过宴会厅，谁就有机会动手。EXISTS 对每位宾客逐一发问：他名下，是否存在这段时间的『离开』记录？",
      task: "用 EXISTS，找出在 20:00–20:15 之间有「离开」记录的宾客姓名。",
      skeleton:
        "SELECT g.name FROM guests g\nWHERE EXISTS (\n  SELECT 1 FROM banquet_log b\n  WHERE b.guest_id = g.id AND ___ AND ___\n);",
      hint: "EXISTS 里的子查询关联外层的 g.id：b.guest_id=g.id AND b.action='离开' AND b.time BETWEEN '20:00' AND '20:15'。只要存在这样一行就算命中。共 3 人。",
      solution:
        "SELECT g.name FROM guests g WHERE EXISTS (SELECT 1 FROM banquet_log b WHERE b.guest_id=g.id AND b.action='离开' AND b.time BETWEEN '20:00' AND '20:15');",
      validate: (res) =>
        ["陆衡", "周济", "葛朗"].every((n) => anyCellContains(res, n)) && res.rows.length === 3,
    },
    {
      id: "union",
      badge: "线索 04",
      title: "拉出排查名单",
      concept: "集合运算 · UNION",
      story:
        "买过毒的、离过场的，都值得排查。把这两份名单合成一张总表——UNION 会自动去掉重复的人。",
      task: "用 UNION，把「买过鹤顶红的人」和「下毒时段离场的人」并成一张重点排查名单。",
      skeleton:
        "SELECT name FROM guests WHERE id IN (...)\nUNION\nSELECT g.name FROM guests g WHERE EXISTS (...);",
      hint: "把第 2 关和第 3 关两条查询用 UNION 连起来即可。UNION 取并集并去重，结果是 4 个人。",
      solution:
        "SELECT name FROM guests WHERE id IN (SELECT guest_id FROM purchases WHERE item='鹤顶红') UNION SELECT g.name FROM guests g WHERE EXISTS (SELECT 1 FROM banquet_log b WHERE b.guest_id=g.id AND b.action='离开' AND b.time BETWEEN '20:00' AND '20:15');",
      validate: (res) =>
        ["陆衡", "孟川", "葛朗", "周济"].every((n) => anyCellContains(res, n)) && res.rows.length === 4,
    },
    {
      id: "intersect",
      badge: "线索 05",
      title: "既买毒又离场",
      concept: "集合运算 · INTERSECT",
      story:
        "排查名单太宽。真正可疑的，是那些『既买过毒、又在下毒时段离过场』的人——两个条件同时成立。把 UNION 换成 INTERSECT，求交集。",
      task: "用 INTERSECT，求「买过鹤顶红的人」与「下毒时段离场的人」的交集。",
      skeleton:
        "SELECT name FROM guests WHERE id IN (...)\nINTERSECT\nSELECT g.name FROM guests g WHERE EXISTS (...);",
      hint: "把上一关的 UNION 改成 INTERSECT 即可。交集只剩 2 个人：陆衡和葛朗。",
      solution:
        "SELECT name FROM guests WHERE id IN (SELECT guest_id FROM purchases WHERE item='鹤顶红') INTERSECT SELECT g.name FROM guests g WHERE EXISTS (SELECT 1 FROM banquet_log b WHERE b.guest_id=g.id AND b.action='离开' AND b.time BETWEEN '20:00' AND '20:15');",
      validate: (res) =>
        ["陆衡", "葛朗"].every((n) => anyCellContains(res, n)) && res.rows.length === 2,
    },
    {
      id: "except",
      badge: "线索 06",
      title: "排除有人证的人",
      concept: "集合运算 · EXCEPT",
      story:
        "两名嫌疑里，葛朗只外出两分钟结赌债、管家全程作证，已被洗清（cleared）。用 EXCEPT 从交集里减去这些有人证的人，剩下的就是真凶。",
      task:
        "在上一关交集的基础上，用 EXCEPT 减去 cleared 表里已被洗清的人，得到唯一真凶。",
      skeleton:
        "SELECT name FROM guests WHERE id IN (...)\nINTERSECT\nSELECT g.name FROM guests g WHERE EXISTS (...)\nEXCEPT\nSELECT name FROM guests WHERE id IN (SELECT ___ FROM cleared);",
      hint: "在第 5 关的 INTERSECT 后面再接一段 EXCEPT SELECT name FROM guests WHERE id IN (SELECT guest_id FROM cleared)。三段集合运算从左到右依次求值，最后只剩一人。",
      solution:
        "SELECT name FROM guests WHERE id IN (SELECT guest_id FROM purchases WHERE item='鹤顶红') INTERSECT SELECT g.name FROM guests g WHERE EXISTS (SELECT 1 FROM banquet_log b WHERE b.guest_id=g.id AND b.action='离开' AND b.time BETWEEN '20:00' AND '20:15') EXCEPT SELECT name FROM guests WHERE id IN (SELECT guest_id FROM cleared);",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
  ],
};
