/**
 * 第三案《错综的关系网》
 * 知识点（层层递进）：INNER JOIN → 自连接(self-join) → LEFT JOIN →
 *                    LEFT JOIN ... IS NULL（找没有不在场证明的人）→ 综合锁定
 *
 * 核心机制：外连接里出现的 NULL = 这个人没有对应记录（没有不在场证明）= 嫌疑；
 *          自连接揭开组织内部「谁向谁汇报」的关系网，谁最了解受害人行程。
 */
import {
  type DetectiveCase,
  anyCellContains,
  rowSetContains,
} from "../db-detective";

const CULPRIT = "苏晴"; // 无不在场证明(苏晴,钱伟) ∩ 直接向老板汇报(manager_id=1) = 苏晴

export const caseNetwork: DetectiveCase = {
  id: "tangled-network",
  order: 3,
  concepts: "INNER JOIN · 自连接 · 外连接 · IS NULL",
  culprit: CULPRIT,
  briefing: [
    {
      term: "INNER JOIN（内连接）",
      story: "报告里受害人只写了编号，姓名在另一张表——按编号把两表对上，才知道是谁。",
      definition: "INNER JOIN 只返回两表按 ON 条件都能匹配上的行。",
    },
    {
      term: "自连接（self-join）",
      story: "员工和上级在同一张表里，员工的 manager_id 指向同表另一个人——把表和它自己连一次，谁向谁汇报就清楚了。",
      definition: "自连接是一张表用不同别名与自身连接，用于表达同表内行与行的关系（如上下级）。",
    },
    {
      term: "LEFT JOIN（左外连接）",
      story: "把全体员工和不在场证明拼起来——没有证明的人也要留下，证明那栏就空着。",
      definition: "LEFT JOIN 保留左表全部行，右表无匹配处以 NULL 填充，从而保留「缺失」本身。",
    },
    {
      term: "NULL 与 IS NULL",
      story: "外连接之后，证明栏为空的，正是那些拿不出不在场证明的嫌疑人——空缺即线索。",
      definition: "NULL 表示「没有值」；判断空值用 IS NULL / IS NOT NULL，不能用 = NULL。",
    },
  ],
  meta: {
    codename: "雾港谜案",
    subtitle: "第三案 · 连接的艺术",
    title: "《错综的关系网》",
    intro:
      "古董行「万宝阁」老板沈万下班途中被绑架。勒索者准确掌握他的行程——这是一桩内部人作案。嫌疑藏在公司的组织关系网里：谁向谁汇报、谁那晚拿不出不在场证明。把表连起来，关系网会自己说话。",
    arc: "绑架案的赎金账户，最后一笔操作来自档案库管理员权限。校对者，离你越来越近了。",
  },
  accusation: {
    prompt:
      "嫌疑人要同时满足两条：作案当晚没有不在场证明、且直接向受害人汇报（最了解其行程）。这样的人只有一个。输入 TA 的姓名结案。",
    winNote:
      "你用连接破了这张关系网：INNER JOIN 串起多表，自连接揭开谁向谁汇报，LEFT JOIN 让『没有不在场证明』的人以 NULL 的形式暴露出来。NULL 不是没有意义——在侦探眼里，缺失本身就是线索。",
  },
  seedSql: `
CREATE TABLE crime_report (
  id INTEGER PRIMARY KEY, date TEXT, type TEXT, victim_id INTEGER, description TEXT
);
INSERT INTO crime_report VALUES
 (1,'2024-03-10','绑架',1,'万宝阁老板沈万于下班途中被绑架。勒索者准确掌握其当晚行程与路线，警方判断为熟悉其日程的内部人作案；且作案当晚此人没有不在场证明。'),
 (2,'2024-03-08','盗窃',NULL,'与本案无关的小区盗窃。');

CREATE TABLE staff (
  id INTEGER PRIMARY KEY, name TEXT, role TEXT, manager_id INTEGER
);
INSERT INTO staff VALUES
 (1,'沈万','老板',NULL),
 (2,'苏晴','贴身秘书',1),
 (3,'罗刚','财务主管',1),
 (4,'孙琳','保安主管',1),
 (5,'周明','司机',2),
 (6,'钱伟','仓库管理',3),
 (7,'吴桐','出纳',3),
 (8,'郑浩','学徒',6);

CREATE TABLE alibi (staff_id INTEGER, place TEXT, verified INTEGER);
INSERT INTO alibi VALUES
 (1,'案发地点(被劫)',1),
 (3,'医院陪护',1),
 (4,'值班室',1),
 (5,'外地送货',1),
 (7,'KTV',1),
 (8,'夜校',1);
`,
  schema: [
    {
      name: "crime_report",
      comment: "案件报告",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "date", type: "TEXT" },
        { name: "type", type: "TEXT", note: "案件类型" },
        { name: "victim_id", type: "INTEGER", note: "→ staff.id 受害人" },
        { name: "description", type: "TEXT" },
      ],
    },
    {
      name: "staff",
      comment: "万宝阁员工（含汇报关系）",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "role", type: "TEXT", note: "职务" },
        { name: "manager_id", type: "INTEGER", note: "→ staff.id 直属上级" },
      ],
    },
    {
      name: "alibi",
      comment: "案发当晚不在场证明",
      columns: [
        { name: "staff_id", type: "INTEGER", note: "→ staff.id" },
        { name: "place", type: "TEXT", note: "所在地点" },
        { name: "verified", type: "INTEGER", note: "是否核实" },
      ],
    },
  ],
  levels: [
    {
      id: "report",
      badge: "线索 01",
      title: "翻开绑架案报告",
      concept: "WHERE · 读取线索",
      story:
        "新案子：万宝阁老板被绑架。先调出这起绑架案的报告，读出警方给的方向。",
      task: "从 crime_report 中查出 type 为「绑架」的那起案件。",
      skeleton: "SELECT * FROM ___\nWHERE ___ = ___;",
      hint: "用 WHERE type = '绑架' 过滤。报告里会点明两件事：内部人作案、且此人当晚没有不在场证明。",
      solution: "SELECT * FROM crime_report WHERE type='绑架';",
      validate: (res) => anyCellContains(res, "内部人") && anyCellContains(res, "不在场"),
    },
    {
      id: "victim",
      badge: "线索 02",
      title: "受害人是谁",
      concept: "INNER JOIN · 两表连接",
      story:
        "报告里受害人只写了一个 victim_id，不是名字。要知道是谁，得把 crime_report 和 staff 按 id 连起来——这就是连接（JOIN）。",
      task: "用 victim_id 连接 staff，查出绑架案受害人的姓名和职务。",
      skeleton: "SELECT ___, ___\nFROM crime_report c\nJOIN ___ ON ___ = ___\nWHERE c.type = '绑架';",
      hint: "JOIN staff s ON s.id = c.victim_id，把报告里的 victim_id 换成 staff 里的 name、role。",
      solution:
        "SELECT s.name, s.role FROM crime_report c JOIN staff s ON s.id=c.victim_id WHERE c.type='绑架';",
      validate: (res) => anyCellContains(res, "沈万"),
    },
    {
      id: "self-join",
      badge: "线索 03",
      title: "谁向谁汇报",
      concept: "自连接 · 关系网",
      story:
        "内部人作案，关键是搞清组织关系。staff 表里每个人都有一个 manager_id 指向自己的上级——把这张表和它自己连一次，就能列出『员工 → 上级』的完整汇报链。",
      task: "用自连接列出每名员工的姓名，以及其直属上级的姓名。",
      skeleton:
        "SELECT e.name AS 员工, m.name AS 上级\nFROM staff e\nJOIN staff m ON ___ = ___;",
      hint: "同一张 staff 取两个别名 e（员工）和 m（上级），连接条件 e.manager_id = m.id。直接向老板沈万汇报的人，最了解他的行程。",
      solution: "SELECT e.name AS 员工, m.name AS 上级 FROM staff e JOIN staff m ON e.manager_id=m.id;",
      validate: (res) => rowSetContains(res, ["苏晴", "沈万"]) && rowSetContains(res, ["周明", "苏晴"]),
    },
    {
      id: "left-join",
      badge: "线索 04",
      title: "谁的不在场证明缺席",
      concept: "LEFT JOIN · 保留全部",
      story:
        "alibi 表记录了案发当晚每个人的去向——但只有提供了证明的人才在表里。用左连接把全体员工和 alibi 拼起来：没有证明的人，alibi 那一栏会是 NULL。",
      task: "用 LEFT JOIN 列出全部员工，以及他们当晚的不在场地点（没有的显示为空）。",
      skeleton: "SELECT s.name, a.place\nFROM staff s\nLEFT JOIN alibi a ON ___ = ___;",
      hint: "LEFT JOIN 会保留左表 staff 的每一行，匹配不到 alibi 的，place 就是 NULL。连接条件 a.staff_id = s.id。",
      solution: "SELECT s.name, a.place FROM staff s LEFT JOIN alibi a ON a.staff_id=s.id;",
      // 必须用 LEFT JOIN：保留全部 8 人，且至少有一行 place 为 NULL
      validate: (res) => res.rows.length >= 8 && res.rows.some((row) => row.some((c) => c === null)),
    },
    {
      id: "is-null",
      badge: "线索 05",
      title: "锁定没有证明的人",
      concept: "IS NULL · 缺失即线索",
      story:
        "报告说凶手当晚没有不在场证明。在左连接的结果里，这种人就是 alibi 匹配为 NULL 的那几行。把他们单独筛出来。",
      task: "用左连接 + IS NULL，找出当晚没有不在场证明的员工姓名（应有两人）。",
      skeleton:
        "SELECT s.name\nFROM staff s\nLEFT JOIN alibi a ON a.staff_id = s.id\nWHERE ___ IS NULL;",
      hint: "在 LEFT JOIN 后面加 WHERE a.staff_id IS NULL，只留下没匹配到不在场证明的人。会剩两名嫌疑人。",
      solution:
        "SELECT s.name FROM staff s LEFT JOIN alibi a ON a.staff_id=s.id WHERE a.staff_id IS NULL;",
      validate: (res) =>
        anyCellContains(res, "苏晴") && anyCellContains(res, "钱伟") && res.rows.length === 2,
    },
    {
      id: "lock",
      badge: "线索 06",
      title: "揪出内鬼",
      concept: "综合 · 关系 + 缺失",
      story:
        "两名嫌疑人都没有不在场证明，但凶手还得『熟知受害人行程』——也就是直接向老板沈万汇报的人（manager_id = 1）。把两个条件叠加，只剩一个人。",
      task:
        "找出既没有不在场证明、又直接向老板（manager_id = 1）汇报的那个人的姓名。",
      skeleton:
        "SELECT s.name\nFROM staff s\nLEFT JOIN alibi a ON a.staff_id = s.id\nWHERE ___ IS NULL AND ___ = 1;",
      hint: "在上一关基础上，再加一个条件 s.manager_id = 1（直接向老板汇报）。两条件用 AND 叠加，唯一命中。",
      solution:
        "SELECT s.name FROM staff s LEFT JOIN alibi a ON a.staff_id=s.id WHERE a.staff_id IS NULL AND s.manager_id=1;",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
  ],
};
