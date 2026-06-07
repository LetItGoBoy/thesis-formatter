/**
 * 第二案《高频的影子》
 * 知识点（层层递进）：聚合函数(COUNT/MAX/MIN/AVG) → ORDER BY 排序 →
 *                    GROUP BY 按维度分组 → GROUP BY 按人分组 →
 *                    HAVING 分组过滤 → HAVING + JOIN 锁定
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
      "后巷命案之后，雾港接连发生五起夜间入室盗窃。每一夜路过现场的人都不一样，监控也抓不到固定面孔。可数据不会撒谎——先把案情统计清楚，再把目击记录按人聚合，谁每一夜都在场，谁就是那道影子。",
    arc: "盗窃案的混乱像是有人故意制造的烟雾。校对者，是不是在用这些案子掩盖什么？",
  },
  accusation: {
    prompt:
      "全部五个案发夜都被目击在场的，只有一个人。这个「影子」就是连环夜盗。输入 TA 的姓名结案。",
    winNote:
      "你从聚合统计起步，经过排序、分组，最后用 HAVING 过滤出『五夜全勤』的人。单看每一夜谁都像无辜路人，只有聚合 + 分组 + HAVING 才能把异常者从噪声里逼出来。",
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
 (5,'2024-02-19','海雾区',26000);

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
      title: "案情有多大",
      concept: "聚合函数 · COUNT/MAX/MIN/AVG",
      story:
        "接手这串夜盗案，先要心里有数：一共几起？损失最重、最轻、平均各是多少？聚合函数能一次算出整张表的统计量。",
      task: "查出 burglary 的总起数，以及损失金额的最大值、最小值、平均值。",
      skeleton: "SELECT COUNT(*), MAX(___), MIN(___), AVG(___)\nFROM ___;",
      hint: "COUNT(*) 数行数，MAX/MIN/AVG(loss_value) 分别取最大、最小、平均，几个聚合可写在同一句 SELECT 里。",
      solution:
        "SELECT COUNT(*) AS 起数, MAX(loss_value) AS 最大, MIN(loss_value) AS 最小, AVG(loss_value) AS 平均 FROM burglary;",
      // 5 起、最大 80000、平均 32200
      validate: (res) =>
        flatten(res).includes("5") && anyCellContains(res, "80000") && anyCellContains(res, "32200"),
    },
    {
      id: "order-by",
      badge: "线索 02",
      title: "损失最重的一夜",
      concept: "ORDER BY · 排序",
      story:
        "五起案子里，有一起损失格外惨重。把案子按损失金额从高到低排个序，排在最前面的，往往是凶手最用心的一次。",
      task: "把 burglary 按 loss_value 从高到低排列，看看损失最大的发生在哪个区。",
      skeleton: "SELECT ___, ___ FROM ___\nORDER BY ___ DESC;",
      hint: "ORDER BY loss_value DESC 表示按损失降序；排在第一行的就是损失最大的那起（看它的 district）。",
      solution: "SELECT district, loss_value FROM burglary ORDER BY loss_value DESC;",
      // 排在最前的是 80000（灯塔区）
      validate: (res) =>
        res.rows.length > 0 && res.rows[0].map(String).some((c) => c.includes("80000")),
    },
    {
      id: "group-district",
      badge: "线索 03",
      title: "哪个区是重灾区",
      concept: "GROUP BY · 按维度分组",
      story:
        "凶手似乎偏爱某个片区。把案子按区分组、数一数每个区被盗几次，重灾区会暴露他的活动范围。",
      task: "按 district 分组，统计每个区发生了几起盗窃。",
      skeleton: "SELECT ___, COUNT(*)\nFROM ___\nGROUP BY ___;",
      hint: "GROUP BY district 把同一个区的案子归成一组，COUNT(*) 数每组几起。海雾区会明显偏多。",
      solution: "SELECT district, COUNT(*) AS 起数 FROM burglary GROUP BY district;",
      // 海雾区 3 起
      validate: (res) => rowSetContains(res, ["海雾区", "3"]),
    },
    {
      id: "group-person",
      badge: "线索 04",
      title: "谁出现了几次",
      concept: "GROUP BY · 按人分组",
      story:
        "重灾区锁定后，回到目击记录。每一夜路过的人都不同，但把记录按人聚到一起，数数每个人一共被目击几次，规律就浮现了。",
      task: "按 person_id 分组，统计 sightings 里每个人被目击的次数。",
      skeleton: "SELECT ___, COUNT(*)\nFROM ___\nGROUP BY ___;",
      hint: "GROUP BY person_id 把同一个人的记录归组，COUNT(*) 数出每组行数。注意有人 5 次、有人 4 次。",
      solution: "SELECT person_id, COUNT(*) AS 次数 FROM sightings GROUP BY person_id;",
      // 必须真聚合出 (6→5) 和 (3→4)
      validate: (res) => rowSetContains(res, ["6", "5"]) && rowSetContains(res, ["3", "4"]),
    },
    {
      id: "having",
      badge: "线索 05",
      title: "筛掉偶然路人",
      concept: "HAVING · 分组过滤",
      story:
        "出现一两次的，多半是巧合；出现三次以上的，才值得盯。WHERE 管不了聚合结果，要在分组之后用 HAVING 过滤——把高频嫌疑人留下来。",
      task: "在按人分组的基础上，只保留被目击次数 ≥ 3 的人（应只剩两名嫌疑人）。",
      skeleton: "SELECT ___, COUNT(*)\nFROM ___\nGROUP BY ___\nHAVING COUNT(*) >= ___;",
      hint: "GROUP BY person_id 之后加 HAVING COUNT(*) >= 3。WHERE 不能跟聚合函数，分组后的过滤必须用 HAVING。",
      solution:
        "SELECT person_id, COUNT(*) AS 次数 FROM sightings GROUP BY person_id HAVING COUNT(*)>=3;",
      // 恰好两名高频嫌疑：6(5)、3(4)
      validate: (res) =>
        res.rows.length === 2 && rowSetContains(res, ["6", "5"]) && rowSetContains(res, ["3", "4"]),
    },
    {
      id: "lock",
      badge: "线索 06",
      title: "锁定那道影子",
      concept: "HAVING · JOIN · 锁定",
      story:
        "两名嫌疑人里，一个出现 4 次、一个 5 次。只有那个五夜全勤、一次不落的，才是真正的影子。把阈值收紧到 5，再换出姓名。",
      task: "找出在全部 5 个案发夜都被目击（次数 = 5）的人的姓名，按次数从高到低排列。",
      skeleton:
        "SELECT ___, COUNT(*)\nFROM ___\nJOIN ___ ON ___\nGROUP BY ___\nHAVING COUNT(*) >= ___\nORDER BY ___ DESC;",
      hint: "把 HAVING 的阈值提到 5，再 JOIN people 用 p.name 替换 id；ORDER BY 次数 DESC 排个序。最终只剩一个人。",
      solution:
        "SELECT p.name, COUNT(*) AS c FROM sightings s JOIN people p ON p.id=s.person_id GROUP BY p.name HAVING COUNT(*)>=5 ORDER BY c DESC;",
      // 唯一命中：钱伟
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
  ],
};
