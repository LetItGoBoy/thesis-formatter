/**
 * 第一案《后巷的打卡记录》
 * 知识点：SELECT · WHERE · LIKE · JOIN 入门 · 多条件求交
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
  meta: {
    codename: "雾港谜案",
    subtitle: "第一案 · SQL 入门",
    title: "《后巷的打卡记录》",
    intro:
      "一桩深夜命案，两条互相独立的线索，八名市民。你是查档侦探，唯一的武器是 SQL。逐条查询、层层求交，把真凶从档案里揪出来。",
    arc: "这是你接手的第一起案子——但档案库里的记录，似乎已经被人悄悄动过手脚。",
  },
  accusation: {
    prompt:
      "你已经掌握全部线索：当晚在健身房打卡、且车牌含 X7 的，只有一个人。输入 TA 的姓名结案。",
    winNote:
      "你用三条 SQL 完成了一次完整推理：先用 WHERE 缩小范围，再用 JOIN 把多张表的线索求交，最终锁定唯一嫌疑人。这正是关系数据库查询的核心。",
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
      id: "scene",
      badge: "线索 01",
      title: "翻开现场报告",
      concept: "SELECT · WHERE",
      story:
        "2024 年 1 月 15 日深夜，雾港大剧院后巷发现一具尸体。你接入城市档案数据库，第一步是调出这起案子的现场报告。",
      task: "从 crime_scene_report 中，查出 2024-01-15 雾港这起「谋杀」案的现场描述。",
      placeholder: "SELECT ___ FROM ___\nWHERE ___ AND ___ AND ___;",
      hint: "用 WHERE 同时限定 date、city、type 三个条件，把无关的盗窃案和旧案排除掉。",
      solution:
        "SELECT description FROM crime_scene_report WHERE date='2024-01-15' AND city='雾港' AND type='谋杀';",
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
      placeholder: "SELECT ___ FROM ___\nWHERE ___;",
      hint: "只看 check_date = '2024-01-15' 这一天，会得到 3 个人；注意还有别的日期是干扰项。",
      solution: "SELECT person_id FROM gym_checkin WHERE check_date='2024-01-15';",
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
      placeholder: "SELECT ___\nFROM ___\nJOIN ___ ON ___\nJOIN ___ ON ___\nWHERE ___ AND ___;",
      hint: "用两次 JOIN 把三张表按 person_id 串起来，再用 WHERE 同时卡住 check_date 和 plate LIKE '%X7%'。",
      solution:
        "SELECT p.name FROM gym_checkin g JOIN cars c ON c.person_id=g.person_id JOIN people p ON p.id=g.person_id WHERE g.check_date='2024-01-15' AND c.plate LIKE '%X7%';",
      validate: (res) => anyCellContains(res, CULPRIT),
    },
  ],
};
