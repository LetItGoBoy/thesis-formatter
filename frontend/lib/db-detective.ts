/**
 * 数据库侦探游戏 ·《雾港谜案》案件数据
 * frontend/lib/db-detective.ts
 *
 * MVP：经典命案现场。玩家是查档侦探，浏览器内置 SQLite（sql.js），
 * 每关写一条真实 SQL 缩小嫌疑范围，最后指认真凶。
 *
 * 设计原则（对齐「霓虹栈城」关卡模板）：
 *   - 单个案子、4 张小表、3 关 SQL + 1 关指认
 *   - 知识点层层递进：SELECT/WHERE → WHERE 集合 → JOIN
 *   - 每个单独条件都会命中多名嫌疑人，必须 JOIN 求交集才能锁定唯一真凶
 *   - 校验宽松：只要查询结果包含关键行即通关，不强求写法一致
 */

export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface DetectiveLevel {
  id: string;
  /** 关卡序号标签，如「线索 01」 */
  badge: string;
  title: string;
  /** 对应 SQL 知识点 */
  concept: string;
  /** 剧情开场 */
  story: string;
  /** 给玩家的查询任务 */
  task: string;
  /** SQL 输入框占位提示 */
  placeholder: string;
  /** 卡住时可展开的提示 */
  hint: string;
  /** 参考答案（仅作「查看答案」用，不参与判定） */
  solution: string;
  /** 结果校验：命中关键行即通过 */
  validate: (res: QueryResult) => boolean;
}

export interface SchemaTable {
  name: string;
  comment: string;
  columns: { name: string; type: string; note?: string }[];
}

// ============================================================
// 把结果所有单元格拍平成字符串，便于做「包含」判定
// ============================================================
function flatten(res: QueryResult): string[] {
  return res.rows.flat().map((c) => (c === null ? "" : String(c)));
}
function cellSet(res: QueryResult): Set<string> {
  return new Set(flatten(res));
}
function includesAll(res: QueryResult, needles: string[]): boolean {
  const set = cellSet(res);
  return needles.every((n) => set.has(n));
}
function anyCellContains(res: QueryResult, sub: string): boolean {
  return flatten(res).some((c) => c.includes(sub));
}

// ============================================================
// 案件数据库种子（schema + 数据）
// ============================================================
export const SEED_SQL = `
CREATE TABLE crime_scene_report (
  id INTEGER PRIMARY KEY,
  date TEXT, city TEXT, type TEXT, description TEXT
);
INSERT INTO crime_scene_report VALUES
 (1,'2024-01-15','雾港','谋杀','死者于雾港大剧院后巷被害。现场两条线索：凶手当晚在「雾港健身房」打过卡；逃离时被人记下其车牌含字符 X7。请据此锁定凶手。'),
 (2,'2024-01-15','雾港','盗窃','珠宝店橱窗被砸，与本案无关。'),
 (3,'2024-01-10','青石','谋杀','另一城市的旧案，时间地点均不符。');

CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  name TEXT, gender TEXT, job TEXT
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
  id INTEGER PRIMARY KEY,
  person_id INTEGER, check_date TEXT, check_time TEXT
);
INSERT INTO gym_checkin VALUES
 (1,2,'2024-01-15','21:40'),
 (2,5,'2024-01-15','22:05'),
 (3,7,'2024-01-15','22:30'),
 (4,3,'2024-01-14','19:00'),
 (5,8,'2024-01-13','20:00'),
 (6,5,'2024-01-09','18:15');

CREATE TABLE cars (
  id INTEGER PRIMARY KEY,
  person_id INTEGER, plate TEXT
);
INSERT INTO cars VALUES
 (1,3,'雾A·X7K21'),
 (2,5,'雾B·9X7Q3'),
 (3,8,'雾C·X7M88'),
 (4,2,'雾A·22B10'),
 (5,7,'雾D·55C09'),
 (6,1,'雾E·08L77');
`;

// 真凶：当晚在健身房打卡(2,5,7) ∩ 车牌含X7(3,5,8) = 高金(5)
export const CULPRIT = "高金";

export const SCHEMA: SchemaTable[] = [
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
];

export const LEVELS: DetectiveLevel[] = [
  {
    id: "scene",
    badge: "线索 01",
    title: "翻开现场报告",
    concept: "SELECT · WHERE",
    story:
      "2024 年 1 月 15 日深夜，雾港大剧院后巷发现一具尸体。你接入城市档案数据库，第一步是调出这起案子的现场报告。",
    task: "从 crime_scene_report 中，查出 2024-01-15 雾港这起「谋杀」案的现场描述。",
    placeholder:
      "SELECT description FROM crime_scene_report\nWHERE date = '2024-01-15' AND city = '雾港' AND type = '谋杀';",
    hint: "用 WHERE 同时限定 date、city、type 三个条件，把无关的盗窃案和旧案排除掉。",
    solution:
      "SELECT description FROM crime_scene_report WHERE date='2024-01-15' AND city='雾港' AND type='谋杀';",
    // 命中那条带「健身房」和「X7」的现场报告即通过
    validate: (res) => anyCellContains(res, "健身房") && anyCellContains(res, "X7"),
  },
  {
    id: "checkin",
    badge: "线索 02",
    title: "当晚谁在健身房",
    concept: "WHERE · 集合筛选",
    story:
      "报告说凶手当晚在「雾港健身房」打过卡。你打开打卡记录表，先把案发当晚到场的人都筛出来。",
    task: "从 gym_checkin 中，查出 2024-01-15 当天打卡的所有 person_id。",
    placeholder: "SELECT person_id FROM gym_checkin\nWHERE check_date = '2024-01-15';",
    hint: "只看 check_date = '2024-01-15' 这一天，会得到 3 个人；注意还有别的日期是干扰项。",
    solution: "SELECT person_id FROM gym_checkin WHERE check_date='2024-01-15';",
    // 当晚打卡者 person_id = 2,5,7
    validate: (res) => includesAll(res, ["2", "5", "7"]),
  },
  {
    id: "join",
    badge: "线索 03",
    title: "锁定唯一真凶",
    concept: "JOIN · 多表求交",
    story:
      "三名当晚到场者还不够。第二条线索是车牌含 X7。光看车牌也有好几个人——只有「当晚打卡」且「车牌含 X7」同时成立的那一个，才是真凶。",
    task:
      "把 gym_checkin、cars、people 连接起来，找出 2024-01-15 当天打卡、且车牌包含 X7 的那个人的姓名。",
    placeholder:
      "SELECT p.name\nFROM gym_checkin g\nJOIN cars c ON c.person_id = g.person_id\nJOIN people p ON p.id = g.person_id\nWHERE g.check_date = '2024-01-15' AND c.plate LIKE '%X7%';",
    hint: "用两次 JOIN 把三张表按 person_id 串起来，再用 WHERE 同时卡住 check_date 和 plate LIKE '%X7%'。",
    solution:
      "SELECT p.name FROM gym_checkin g JOIN cars c ON c.person_id=g.person_id JOIN people p ON p.id=g.person_id WHERE g.check_date='2024-01-15' AND c.plate LIKE '%X7%';",
    // 交集唯一：高金
    validate: (res) => anyCellContains(res, CULPRIT),
  },
];

export const CASE_META = {
  codename: "雾港谜案",
  subtitle: "数据库原理 · SQL 侦探",
  title: "《雾港谜案：后巷的打卡记录》",
  intro:
    "一桩深夜命案，两条互相独立的线索，八名市民。你是查档侦探，唯一的武器是 SQL。逐条查询、层层求交，把真凶从档案里揪出来。",
};
