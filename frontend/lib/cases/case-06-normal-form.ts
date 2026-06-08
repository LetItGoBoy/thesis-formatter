/**
 * 第六案《范式的裂缝》
 * 知识点（层层递进）：数据冗余 → 函数依赖 → FD 违例(更新异常) →
 *                    「多数即真相」 → 定位伪造行 → 子查询锁定经手人
 *
 * 教学核心：一张未规范化的大宽表，把「供应商 → 城市」这条函数依赖的值
 * 在每笔订单里重复存储。伪造者改了一处却没法改全部，留下了同一个供应商
 * 对应两个城市的矛盾——这正是更新异常，也是范式存在的理由。
 */
import {
  type DetectiveCase,
  anyCellContains,
  rowSetContains,
} from "../db-detective";

const CULPRIT = "严松"; // 伪造行（云锦坊却写成灯塔区）的经手人

export const caseNormalForm: DetectiveCase = {
  id: "broken-normal-form",
  order: 6,
  concepts: "函数依赖 · 范式 · 数据冗余异常",
  culprit: CULPRIT,
  briefing: [
    {
      term: "数据冗余",
      story: "大宽表把供应商的城市随每一笔订单重抄一遍——同一个事实，存了很多份。",
      definition: "冗余指同一信息在表中重复存储，会带来空间浪费和不一致风险。",
    },
    {
      term: "函数依赖",
      story: "供应商编号一旦确定，它的城市就该被唯一确定——「编号决定城市」。",
      definition: "函数依赖 X→Y 表示 X 的值唯一决定 Y 的值。",
    },
    {
      term: "更新异常",
      story: "改了一笔订单的城市却漏改其余，同一供应商就冒出两个城市——这正是伪造留下的裂缝。",
      definition: "因冗余导致的修改不一致称更新异常；另有插入异常、删除异常。",
    },
    {
      term: "范式与规范化",
      story: "若当初把供应商单独建表、城市只存一份，这种自相矛盾根本无从发生。",
      definition: "规范化通过分解消除冗余与异常：2NF 消除部分依赖、3NF 消除传递依赖，使非主属性只依赖于键。",
    },
  ],
  meta: {
    codename: "雾港谜案",
    subtitle: "第六案 · 范式与冗余",
    title: "《范式的裂缝》",
    intro:
      "万宝阁的总账是一张臃肿的大宽表：每笔订单都把供应商的名字、城市重抄一遍。有人往账里塞了一笔假订单牟利——可他改得了一行，改不了全部。同一个供应商，居然对应了两个城市。这道裂缝，会把伪造者交出来。",
    arc: "假订单的金额，最后流向了与校对者同一个的离岸账户。账，越查越深。",
  },
  accusation: {
    prompt:
      "供应商「云锦坊」在账上出现了两个城市：多数订单是真城市，唯一那笔对不上的，就是伪造的。写下伪造那笔订单的经手人姓名，结案。",
    winNote:
      "你看懂了范式的意义：因为「供应商→城市」这条函数依赖被冗余地抄进每一行，伪造者改一行就和其余行矛盾——这就是更新异常。若当初把供应商单独建表（规范化），城市只存一份，这种伪造根本无处藏身。冗余是裂缝，范式是缝合。",
  },
  seedSql: `
-- 反面教材：未规范化的大宽表，供应商名/城市随每笔订单重复存储（数据冗余）
CREATE TABLE ledger (
  order_id INTEGER PRIMARY KEY,
  supplier_id INTEGER,
  supplier_name TEXT,
  supplier_city TEXT,
  item TEXT,
  amount INTEGER,
  handler TEXT
);
INSERT INTO ledger VALUES
 (1,1,'云锦坊','海雾区','绸缎',2000,'孙账房'),
 (2,1,'云锦坊','海雾区','丝线',800,'孙账房'),
 (3,1,'云锦坊','海雾区','锦缎',3000,'李掌柜'),
 (4,1,'云锦坊','海雾区','绣品',1500,'孙账房'),
 (5,2,'铁画轩','钟楼区','铁画',1200,'李掌柜'),
 (6,2,'铁画轩','钟楼区','摆件',600,'孙账房'),
 (7,1,'云锦坊','灯塔区','绸缎',9000,'严松'),
 (8,3,'墨香斋','灯塔区','宣纸',400,'李掌柜'),
 (9,3,'墨香斋','灯塔区','徽墨',900,'孙账房');
`,
  schema: [
    {
      name: "ledger",
      comment: "总账（未规范化的大宽表）",
      columns: [
        { name: "order_id", type: "INTEGER" },
        { name: "supplier_id", type: "INTEGER", note: "供应商编号" },
        { name: "supplier_name", type: "TEXT", note: "冗余：随订单重复" },
        { name: "supplier_city", type: "TEXT", note: "冗余：本应由 supplier_id 决定" },
        { name: "item", type: "TEXT" },
        { name: "amount", type: "INTEGER" },
        { name: "handler", type: "TEXT", note: "经手人" },
      ],
    },
  ],
  levels: [
    {
      id: "redundancy",
      badge: "线索 01",
      title: "臃肿的总账",
      concept: "数据冗余 · 浏览大宽表",
      story:
        "先把总账整张铺开看看。你会发现同一个供应商的名字、城市，在每一笔订单里都被重复抄写——这就是『冗余』。冗余多了，矛盾就有了藏身之处。",
      task: "查出 ledger 总账的全部订单。",
      skeleton: "SELECT * FROM ___;",
      hint: "SELECT * FROM ledger。注意看 supplier_name、supplier_city 是怎么在每一行里重复的。",
      solution: "SELECT * FROM ledger;",
      validate: (res) => res.rows.length >= 9,
    },
    {
      id: "fd",
      badge: "线索 02",
      title: "一个供应商几个城市",
      concept: "函数依赖 · COUNT(DISTINCT)",
      story:
        "正常情况下，一个供应商只在一个城市——『供应商编号』决定了『城市』，这叫函数依赖。统计每个供应商对应几个不同城市，正常都该是 1。",
      task: "按 supplier_id 分组，统计每个供应商对应了几个不同的 supplier_city。",
      skeleton: "SELECT supplier_id, COUNT(DISTINCT ___)\nFROM ledger\nGROUP BY ___;",
      hint: "用 COUNT(DISTINCT supplier_city) 数每个供应商的不同城市个数。多数是 1，有一个会是 2——那就是裂缝。",
      solution: "SELECT supplier_id, COUNT(DISTINCT supplier_city) AS 城市数 FROM ledger GROUP BY supplier_id;",
      validate: (res) => rowSetContains(res, ["1", "2"]),
    },
    {
      id: "fd-violation",
      badge: "线索 03",
      title: "找出自相矛盾的供应商",
      concept: "更新异常 · HAVING 过滤",
      story:
        "哪个供应商对应了不止一个城市？谁矛盾，谁就被人动过手脚。用 HAVING 把『城市数 > 1』的供应商单独揪出来。",
      task: "找出对应了超过一个城市的供应商（连同其名字）。",
      skeleton:
        "SELECT supplier_id, supplier_name, COUNT(DISTINCT supplier_city)\nFROM ledger\nGROUP BY supplier_id\nHAVING COUNT(DISTINCT ___) > ___;",
      hint: "GROUP BY supplier_id 后，HAVING COUNT(DISTINCT supplier_city) > 1。只有「云锦坊」这一家自相矛盾。",
      solution:
        "SELECT supplier_id, supplier_name, COUNT(DISTINCT supplier_city) AS c FROM ledger GROUP BY supplier_id HAVING COUNT(DISTINCT supplier_city) > 1;",
      validate: (res) => res.rows.length === 1 && anyCellContains(res, "云锦坊"),
    },
    {
      id: "majority",
      badge: "线索 04",
      title: "多数即真相",
      concept: "GROUP BY · 找少数派",
      story:
        "云锦坊到底在哪个城市？真实城市出现得多，伪造的城市只冒出一次。把云锦坊的订单按城市分组计数，少数派那个城市，就是假的。",
      task: "统计供应商「云锦坊」（supplier_id = 1）的订单中，各个城市各出现几次。",
      skeleton:
        "SELECT supplier_city, COUNT(*)\nFROM ledger\nWHERE supplier_id = ___\nGROUP BY ___;",
      hint: "WHERE supplier_id=1，再 GROUP BY supplier_city 计数。海雾区出现 4 次（真），灯塔区只 1 次（伪造）。",
      solution: "SELECT supplier_city, COUNT(*) AS c FROM ledger WHERE supplier_id=1 GROUP BY supplier_city;",
      validate: (res) => rowSetContains(res, ["海雾区", "4"]) && rowSetContains(res, ["灯塔区", "1"]),
    },
    {
      id: "forged-row",
      badge: "线索 05",
      title: "锁定那笔假订单",
      concept: "WHERE · 定位伪造记录",
      story:
        "真城市是海雾区，假城市是灯塔区。把云锦坊名下、城市却写成灯塔区的那笔订单单独调出来——伪造的金额和经手人都在里面。",
      task: "查出 supplier_id = 1 且 supplier_city 是「灯塔区」的那笔订单。",
      skeleton: "SELECT * FROM ledger\nWHERE ___ = 1 AND ___ = '灯塔区';",
      hint: "WHERE supplier_id=1 AND supplier_city='灯塔区'。只有一笔——金额 9000，经手人就藏在这一行。",
      solution: "SELECT * FROM ledger WHERE supplier_id=1 AND supplier_city='灯塔区';",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
    {
      id: "lock",
      badge: "线索 06",
      title: "揪出经手人",
      concept: "子查询 · 与多数比对",
      story:
        "与其手动记住『灯塔区』，不如让查询自己算：先用子查询找出云锦坊出现最多的真实城市，再把城市与它不符的那笔订单的经手人揪出来。这是能自动抓出任何此类伪造的写法。",
      task:
        "用子查询找出云锦坊（supplier_id = 1）出现次数最多的城市，再查出城市与之不符的那笔订单的经手人。",
      skeleton:
        "SELECT handler FROM ledger\nWHERE supplier_id = 1\n  AND supplier_city <> (\n    SELECT supplier_city FROM ledger\n    WHERE supplier_id = 1\n    GROUP BY supplier_city\n    ORDER BY COUNT(*) DESC LIMIT 1\n  );",
      hint: "子查询 (SELECT supplier_city ... GROUP BY supplier_city ORDER BY COUNT(*) DESC LIMIT 1) 取出最多的城市（海雾区）；外层用 <> 找城市对不上的那笔订单的 handler。",
      solution:
        "SELECT handler FROM ledger WHERE supplier_id=1 AND supplier_city <> (SELECT supplier_city FROM ledger WHERE supplier_id=1 GROUP BY supplier_city ORDER BY COUNT(*) DESC LIMIT 1);",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
  ],
};
