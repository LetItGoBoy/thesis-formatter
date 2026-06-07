/**
 * 第二案《高频的影子》
 * 知识点：ORDER BY · 聚合(COUNT/SUM/AVG/MAX/MIN) · GROUP BY · HAVING
 *
 * 一连串夜盗，单看每一夜都有不同的人路过；但把所有案发夜的目击记录
 * 按人聚合，会发现有一个「影子」出现在每一个案发夜——这正是聚合 + 分组
 * + HAVING 的意义：从分散记录里统计出异常者。
 */
import {
  type DetectiveCase,
  anyCellContains,
  flatten,
  rowSetContains,
} from "../db-detective";

const CULPRIT = "钱伟"; // 夜班保安：5 个案发夜全部到场（COUNT=5）

export const caseShadow: DetectiveCase = {
  id: "high-frequency-shadow",
  order: 2,
  concepts: "聚合 · GROUP BY · HAVING · ORDER BY",
  culprit: CULPRIT,
  meta: {
    codename: "雾港谜案",
    subtitle: "第二案 · 聚合与分组",
    title: "《高频的影子》",
    intro:
      "后巷命案之后，雾港接连发生五起夜间入室盗窃。每一夜路过现场的人都不一样，监控也抓不到固定面孔。可数据不会撒谎——把五个案发夜的目击记录按人统计，谁每一夜都在场？",
    arc: "盗窃案的混乱像是有人故意制造的烟雾。校对者，是不是在用这些案子掩盖什么？",
  },
  accusation: {
    prompt:
      "全部五个案发夜都被目击在场的，只有一个人。这个「影子」就是连环夜盗。输入 TA 的姓名结案。",
    winNote:
      "单看每一夜，谁都像无辜路人；只有用 GROUP BY 按人聚合、再用 HAVING 过滤出『次数达到案发夜总数』的人，异常者才会浮出水面。聚合，就是从噪声里统计出真相。",
  },
  seedSql: `
CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT, job TEXT);
INSERT INTO people VALUES
 (1,'周明','会计'),
 (2,'林川','记者'),
 (3,'赵雷','出租车司机'),
 (4,'孙琳','教师'),
 (5,'郑浩','程序员'),
 (6,'钱伟','夜班保安'),
 (7,'吴桐','护士'),
 (8,'蒋虹','古董修复师');

CREATE TABLE burglary (id INTEGER PRIMARY KEY, date TEXT, district TEXT, loss_value INTEGER);
INSERT INTO burglary VALUES
 (1,'2024-02-03','海雾区',12000),
 (2,'2024-02-07','钟楼区',35000),
 (3,'2024-02-11','海雾区',8000),
 (4,'2024-02-15','灯塔区',80000),
 (5,'2024-02-19','钟楼区',26000);

CREATE TABLE sightings (person_id INTEGER, night_date TEXT);
INSERT INTO sightings VALUES
 (6,'2024-02-03'),(6,'2024-02-07'),(6,'2024-02-11'),(6,'2024-02-15'),(6,'2024-02-19'),
 (3,'2024-02-03'),(3,'2024-02-07'),(3,'2024-02-11'),(3,'2024-02-15'),
 (1,'2024-02-03'),(1,'2024-02-07'),
 (2,'2024-02-11'),
 (4,'2024-02-07'),(4,'2024-02-19'),
 (5,'2024-02-15'),
 (7,'2024-02-03'),(7,'2024-02-19'),
 (8,'2024-02-11'),(8,'2024-02-15');
`,
  schema: [
    {
      name: "people",
      comment: "市民档案",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "job", type: "TEXT" },
      ],
    },
    {
      name: "burglary",
      comment: "五起夜盗案",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "date", type: "TEXT", note: "案发夜" },
        { name: "district", type: "TEXT" },
        { name: "loss_value", type: "INTEGER", note: "损失金额" },
      ],
    },
    {
      name: "sightings",
      comment: "案发夜目击记录",
      columns: [
        { name: "person_id", type: "INTEGER", note: "→ people.id" },
        { name: "night_date", type: "TEXT", note: "被目击的那一夜" },
      ],
    },
  ],
  levels: [
    {
      id: "agg-basic",
      badge: "线索 01",
      title: "案子有多大",
      concept: "聚合函数 · COUNT/MAX",
      story:
        "接手这串夜盗案，你先要心里有数：到底发生了几起？哪一起损失最惨重？聚合函数能一次算出整张表的统计量。",
      task: "查出 burglary 里盗窃案的总起数，以及损失金额最大的一起是多少。",
      skeleton: "SELECT COUNT(*), MAX(___)\nFROM ___;",
      hint: "COUNT(*) 数行数、MAX(loss_value) 取最大值，两个聚合可以写在同一句 SELECT 里。",
      solution: "SELECT COUNT(*) AS 起数, MAX(loss_value) AS 最大损失 FROM burglary;",
      // 5 起、最大损失 80000
      validate: (res) => flatten(res).includes("5") && anyCellContains(res, "80000"),
    },
    {
      id: "group-count",
      badge: "线索 02",
      title: "谁出现了几次",
      concept: "GROUP BY · 分组统计",
      story:
        "五个案发夜，每夜都有不同的人被目击在附近。光看一夜看不出名堂——得把目击记录按人聚到一起，数数每个人一共出现了几次。",
      task: "按 person_id 分组，统计 sightings 里每个人被目击的次数。",
      skeleton: "SELECT ___, COUNT(*)\nFROM ___\nGROUP BY ___;",
      hint: "GROUP BY person_id 把同一个人的记录归成一组，COUNT(*) 数出每组的行数。",
      solution: "SELECT person_id, COUNT(*) AS 次数 FROM sightings GROUP BY person_id;",
      // 必须真的聚合出 (6→5) 和 (3→4) 这两组
      validate: (res) => rowSetContains(res, ["6", "5"]) && rowSetContains(res, ["3", "4"]),
    },
    {
      id: "having",
      badge: "线索 03",
      title: "锁定那道影子",
      concept: "HAVING · ORDER BY",
      story:
        "有人出现了 4 次，已经很可疑；但只有一个人，五个案发夜一次不落。HAVING 能在分组之后，只留下『次数达标』的那一组。",
      task:
        "连接 people，找出在全部 5 个案发夜都被目击（出现次数 ≥ 5）的人的姓名，按次数从高到低排列。",
      skeleton:
        "SELECT ___, COUNT(*)\nFROM ___\nJOIN ___ ON ___\nGROUP BY ___\nHAVING COUNT(*) >= ___\nORDER BY ___;",
      hint: "GROUP BY 之后用 HAVING COUNT(*) >= 5 过滤分组（WHERE 不能跟聚合，必须用 HAVING）；再 JOIN people 把 id 换成姓名。",
      solution:
        "SELECT p.name, COUNT(*) AS c FROM sightings s JOIN people p ON p.id=s.person_id GROUP BY p.name HAVING COUNT(*)>=5 ORDER BY c DESC;",
      // 唯一命中：钱伟
      validate: (res) => anyCellContains(res, CULPRIT),
    },
  ],
};
