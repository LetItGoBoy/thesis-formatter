/**
 * 第一案《后巷的打卡记录》
 * 知识点（层层递进）：浏览全表 → WHERE 单条件 → WHERE 多条件 AND →
 *                    按日期筛选 → LIKE 模糊匹配 → JOIN 多表求交
 */
import {
  type DetectiveCase,
  anyCellContains,
  includesAll,
} from "../db-detective";

const CULPRIT = "高金"; // 当晚打卡(2,5,7) ∩ 车牌含X7(3,5,8) = 高金(5)

export const caseBackAlley: DetectiveCase = {
  id: "back-alley",
  order: 1,
  concepts: "SELECT · WHERE · LIKE · JOIN",
  culprit: CULPRIT,
  briefing: [
    {
      term: "SELECT … FROM …（查询）",
      story: "查档侦探办案第一步：从哪张档案表、取哪几列。这就是 SELECT 列 FROM 表。",
      definition: "SELECT 指定要返回的列，FROM 指定来源表；SELECT * 返回全部列。",
    },
    {
      term: "WHERE（条件筛选）",
      story: "档案成千上万，你只要「某天、某地、某类」那一条——用条件把无关卷宗挡在门外。",
      definition: "WHERE 对行进行过滤，只保留满足条件的行；多个条件可用 AND / OR 组合。",
    },
    {
      term: "LIKE（模糊匹配）",
      story: "车牌只记得含「X7」，记不全——用通配符做模糊匹配，含这几个字符的都捞出来。",
      definition: "LIKE 配合通配符 %（任意多个字符）、_（单个字符）做模式匹配。",
    },
    {
      term: "JOIN（多表连接）",
      story: "打卡在一张表、车牌在另一张表、姓名在第三张表，要把同一个人的线索拼成一行。",
      definition: "JOIN 按连接条件 ON 把多张表的行拼接；INNER JOIN 只保留两边都匹配的行。",
    },
  ],
  meta: {
    codename: "雾港谜案",
    subtitle: "第一案 · SQL 入门",
    title: "《后巷的打卡记录》",
    intro:
      "一桩深夜命案，两条互相独立的线索，八名市民。你是查档侦探，唯一的武器是 SQL。从认识嫌疑池开始，逐条查询、层层求交，把真凶从档案里揪出来。",
    arc: "这是你接手的第一起案子——但档案库里的记录，似乎已经被人悄悄动过手脚。",
  },
  accusation: {
    prompt:
      "你已经掌握全部线索：当晚在健身房打卡、且车牌含 X7 的，只有一个人。输入 TA 的姓名结案。",
    winNote:
      "你走完了一条完整的查询链：从浏览全表，到单/多条件 WHERE，到 LIKE 模糊匹配，最后用 JOIN 把多张表的线索求交，锁定唯一嫌疑人。这正是关系数据库查询的地基。",
  },
  seedSql: `
CREATE TABLE crime_scene_report (
  id INTEGER PRIMARY KEY,
  date TEXT, city TEXT, type TEXT, description TEXT
);
INSERT INTO crime_scene_report VALUES
 (1,'2024-01-15','雾港','谋杀','死者于雾港大剧院后巷被害。现场两条线索：凶手当晚在「雾港健身房」打过卡；逃离时被人记下其车牌含字符 X7。请据此锁定凶手。'),
 (2,'2024-01-15','雾港','盗窃','珠宝店橱窗被砸，与本案无关。'),
 (3,'2024-01-10','青石','谋杀','另一城市的旧案，时间地点均不符。');

CREATE TABLE people (
  id INTEGER PRIMARY KEY, name TEXT, gender TEXT, job TEXT
);
INSERT INTO people VALUES
 (1,'周明','男','会计'),
 (2,'林川','男','记者'),
 (3,'赵雷','男','出租车司机'),
 (4,'孙琳','女','教师'),
 (5,'高金','男','古董商'),
 (6,'钱伟','男','保安'),
 (7,'吴桐','女','护士'),
 (8,'郑浩','男','程序员');

CREATE TABLE gym_checkin (
  id INTEGER PRIMARY KEY, person_id INTEGER, check_date TEXT, check_time TEXT
);
INSERT INTO gym_checkin VALUES
 (1,2,'2024-01-15','21:40'),
 (2,5,'2024-01-15','22:05'),
 (3,7,'2024-01-15','22:30'),
 (4,3,'2024-01-14','19:00'),
 (5,8,'2024-01-13','20:00'),
 (6,5,'2024-01-09','18:15');

CREATE TABLE cars (
  id INTEGER PRIMARY KEY, person_id INTEGER, plate TEXT
);
INSERT INTO cars VALUES
 (1,3,'雾A·X7K21'),
 (2,5,'雾B·9X7Q3'),
 (3,8,'雾C·X7M88'),
 (4,2,'雾A·22B10'),
 (5,7,'雾D·55C09'),
 (6,1,'雾E·08L77');
`,
  schema: [
    {
      name: "crime_scene_report",
      comment: "案发现场报告",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "date", type: "TEXT", note: "案发日期" },
        { name: "city", type: "TEXT" },
        { name: "type", type: "TEXT", note: "案件类型" },
        { name: "description", type: "TEXT", note: "线索描述" },
      ],
    },
    {
      name: "people",
      comment: "市民档案",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "gender", type: "TEXT" },
        { name: "job", type: "TEXT" },
      ],
    },
    {
      name: "gym_checkin",
      comment: "健身房打卡记录",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "person_id", type: "INTEGER", note: "→ people.id" },
        { name: "check_date", type: "TEXT" },
        { name: "check_time", type: "TEXT" },
      ],
    },
    {
      name: "cars",
      comment: "车辆登记",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "person_id", type: "INTEGER", note: "→ people.id" },
        { name: "plate", type: "TEXT", note: "车牌" },
      ],
    },
  ],
  levels: [
    {
      id: "roster",
      badge: "线索 01",
      title: "认识嫌疑池",
      concept: "SELECT · 浏览全表",
      story:
        "接手案子第一件事，是把所有相关人摸个底。雾港城市档案里登记着八名市民，先把整张 people 表调出来看看。",
      task: "查出 people 表里的全部市民。",
      skeleton: "SELECT * FROM ___;",
      hint: "SELECT * 表示『选所有列』，FROM 后面跟表名。把 people 整张表查出来即可。",
      solution: "SELECT * FROM people;",
      validate: (res) => res.rows.length >= 8,
    },
    {
      id: "murders",
      badge: "线索 02",
      title: "翻出谋杀案卷",
      concept: "WHERE · 单条件",
      story:
        "档案里案件类型五花八门：盗窃、谋杀、纠纷……你只关心谋杀。用一个条件，把谋杀案从报告里挑出来。",
      task: "从 crime_scene_report 中，查出所有 type 为「谋杀」的案件。",
      skeleton: "SELECT * FROM ___\nWHERE ___ = ___;",
      hint: "案件类型在 type 列，用 WHERE type = '谋杀' 过滤。会查到两起——其中一起是外地旧案。",
      solution: "SELECT * FROM crime_scene_report WHERE type='谋杀';",
      // 谋杀案含「青石」旧案，且不应混入盗窃案
      validate: (res) => anyCellContains(res, "青石") && !anyCellContains(res, "盗窃"),
    },
    {
      id: "scene",
      badge: "线索 03",
      title: "锁定本案现场",
      concept: "WHERE · 多条件 AND",
      story:
        "两起谋杀里，只有一起是本案：2024-01-15、雾港。把三个条件叠在一起，精确翻到唯一一份现场报告，读出它留下的线索。",
      task: "查出 2024-01-15、雾港、谋杀 这起案子的现场描述（description）。",
      skeleton: "SELECT ___ FROM ___\nWHERE ___ AND ___ AND ___;",
      hint: "三个条件 date、city、type 用 AND 串起来，精确到唯一一条；只选 description 列即可。",
      solution:
        "SELECT description FROM crime_scene_report WHERE date='2024-01-15' AND city='雾港' AND type='谋杀';",
      validate: (res) => anyCellContains(res, "健身房") && anyCellContains(res, "X7"),
    },
    {
      id: "checkin",
      badge: "线索 04",
      title: "当晚谁在健身房",
      concept: "WHERE · 按日期筛选",
      story:
        "现场报告给了第一条线索：凶手当晚在「雾港健身房」打过卡。打开打卡记录，把案发当晚到场的人筛出来。",
      task: "从 gym_checkin 中，查出 2024-01-15 当天打卡的所有 person_id。",
      skeleton: "SELECT ___ FROM ___\nWHERE ___ = ___;",
      hint: "打卡日期在 check_date 列，筛 '2024-01-15' 这一天。别被其他日期的记录干扰，最终是 3 个人。",
      solution: "SELECT person_id FROM gym_checkin WHERE check_date='2024-01-15';",
      validate: (res) => includesAll(res, ["2", "5", "7"]),
    },
    {
      id: "plate",
      badge: "线索 05",
      title: "可疑的车牌",
      concept: "LIKE · 模糊匹配",
      story:
        "第二条线索：逃离时车牌被记下，含字符 X7。车牌不是精确值，只知道里面有 X7——这正是模糊匹配的用武之地。",
      task: "从 cars 中，查出车牌包含 X7 的所有车主 person_id。",
      skeleton: "SELECT ___ FROM ___\nWHERE ___ LIKE '%___%';",
      hint: "用 plate LIKE '%X7%'，% 是通配符，表示前后可以是任意字符。会得到 3 个车主。",
      solution: "SELECT person_id FROM cars WHERE plate LIKE '%X7%';",
      validate: (res) => includesAll(res, ["3", "5", "8"]),
    },
    {
      id: "join",
      badge: "线索 06",
      title: "锁定唯一真凶",
      concept: "JOIN · 多表求交",
      story:
        "当晚打卡的有 3 人，车牌含 X7 的也有 3 人。两条线索独立，但只有同时满足的那一个才是真凶。用 JOIN 把表连起来求交集。",
      task:
        "连接 gym_checkin、cars、people，找出 2024-01-15 当天打卡、且车牌包含 X7 的那个人的姓名。",
      skeleton:
        "SELECT ___\nFROM ___\nJOIN ___ ON ___\nJOIN ___ ON ___\nWHERE ___ AND ___;",
      hint: "用两次 JOIN 把三张表按 person_id 串起来，再用 WHERE 同时卡住 check_date='2024-01-15' 和 plate LIKE '%X7%'。",
      solution:
        "SELECT p.name FROM gym_checkin g JOIN cars c ON c.person_id=g.person_id JOIN people p ON p.id=g.person_id WHERE g.check_date='2024-01-15' AND c.plate LIKE '%X7%';",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
  ],
};
