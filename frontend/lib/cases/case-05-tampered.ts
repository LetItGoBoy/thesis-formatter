/**
 * 第五案《被篡改的档案》
 * 知识点（层层递进）：视图(View) → 视图遮蔽 vs 基表 → 参照完整性(外键孤儿) →
 *                    实体完整性(重复主键) → DML 痕迹(UPDATE/DELETE) → 综合锁定
 *
 * 校对者直接对城市档案库下手。蛛丝马迹全是篡改留下的违例：对外公示的视图遮蔽了
 * 真相、伪造的契据指向不存在的人(非法 INSERT)、重复的身份(违反主键)、被偷改和
 * 删除的记录(UPDATE/DELETE)——而 change_log 把这一切都记在了案。
 */
import {
  type DetectiveCase,
  anyCellContains,
  flatten,
} from "../db-detective";

const CULPRIT = "周慎"; // change_log 里独自做了 3 次篡改操作的档案员

export const caseTampered: DetectiveCase = {
  id: "tampered-archive",
  order: 5,
  concepts: "视图 · 完整性约束 · INSERT/UPDATE/DELETE",
  culprit: CULPRIT,
  meta: {
    codename: "雾港谜案",
    subtitle: "第五案 · 篡改与约束",
    title: "《被篡改的档案》",
    intro:
      "校对者终于露出獠牙——直接动了城市档案库。对外公示的居民名册看上去一切正常，可基表里藏着被遮蔽的通缉犯、指向幽灵的伪造契据、重复的身份。这些本该被主键和外键约束拦下的篡改，全都得手了。顺着改动日志，把动手的人揪出来。",
    arc: "档案库的写权限，本只有少数档案员持有。校对者，会不会就在他们之中？",
  },
  accusation: {
    prompt:
      "改动日志 change_log 记下了每一次增删改。真正的篡改者，独自做了多达三次可疑操作（偷改状态、伪造契据、删除证据）。输入 TA 的姓名结案。",
    winNote:
      "你看懂了篡改的全貌：视图能遮蔽真相（公示名册藏起了通缉犯）；伪造记录就是非法 INSERT（契据指向不存在的人，违反参照完整性）；重复身份违反主键（实体完整性）；被偷改和删除的记录是 UPDATE/DELETE。这些违例本该被约束拦下——约束的缺失，正是篡改得手的根源。",
  },
  seedSql: `
-- 档案表故意未设主键/外键约束：正因约束缺失，篡改才得以发生
CREATE TABLE residents (id INTEGER, name TEXT, status TEXT);
INSERT INTO residents VALUES
 (1,'赵安','正常'),
 (2,'钱九','通缉'),
 (3,'孙礼','正常'),
 (4,'李信','正常'),
 (5,'周慎','正常'),
 (6,'吴庆','正常'),
 (7,'郑乐','正常'),
 (2,'钱十','正常');

CREATE VIEW public_registry AS
 SELECT id, name, status FROM residents WHERE status <> '通缉';

CREATE TABLE property_deeds (id INTEGER, owner_id INTEGER, address TEXT);
INSERT INTO property_deeds VALUES
 (1,1,'海雾街1号'),
 (2,3,'钟楼路2号'),
 (3,4,'灯塔道3号'),
 (4,6,'海雾街5号'),
 (99,42,'城西42号');

CREATE TABLE change_log (id INTEGER PRIMARY KEY, table_name TEXT, record_id INTEGER, op TEXT, operator TEXT, ts TEXT);
INSERT INTO change_log VALUES
 (1,'residents',2,'UPDATE','周慎','2024-05-01 02:14'),
 (2,'property_deeds',99,'INSERT','周慎','2024-05-01 02:20'),
 (3,'property_deeds',5,'DELETE','周慎','2024-05-01 02:25'),
 (4,'residents',8,'INSERT','李正','2024-04-20 09:00'),
 (5,'residents',6,'UPDATE','王明','2024-04-22 10:00');
`,
  schema: [
    {
      name: "residents",
      comment: "居民名册（基表，无约束）",
      columns: [
        { name: "id", type: "INTEGER", note: "本应是主键" },
        { name: "name", type: "TEXT" },
        { name: "status", type: "TEXT", note: "正常 / 通缉" },
      ],
    },
    {
      name: "public_registry",
      comment: "对外公示视图（虚拟表）",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "status", type: "TEXT" },
      ],
    },
    {
      name: "property_deeds",
      comment: "房产契据",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "owner_id", type: "INTEGER", note: "本应外键→residents.id" },
        { name: "address", type: "TEXT" },
      ],
    },
    {
      name: "change_log",
      comment: "档案改动日志",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "table_name", type: "TEXT" },
        { name: "record_id", type: "INTEGER" },
        { name: "op", type: "TEXT", note: "INSERT/UPDATE/DELETE" },
        { name: "operator", type: "TEXT", note: "操作人" },
        { name: "ts", type: "TEXT", note: "时间" },
      ],
    },
  ],
  levels: [
    {
      id: "view",
      badge: "线索 01",
      title: "对外公示的名册",
      concept: "视图 · 虚拟表",
      story:
        "档案库对外提供一张公示名册 public_registry。它不是真表，而是一条被存起来的查询——视图。先像查表一样查它，看看对外公布的居民。",
      task: "查出 public_registry 视图里的全部居民。",
      skeleton: "SELECT * FROM ___;",
      hint: "视图查起来和普通表一模一样：SELECT * FROM public_registry。记住你看到的这份『官方名单』，后面要和基表对照。",
      solution: "SELECT * FROM public_registry;",
      // 视图遮蔽了通缉犯钱九，公示里查不到他
      validate: (res) => anyCellContains(res, "赵安") && !anyCellContains(res, "钱九"),
    },
    {
      id: "base-vs-view",
      badge: "线索 02",
      title: "视图藏起了谁",
      concept: "视图遮蔽 · 对比基表",
      story:
        "公示名册人人『正常』，太干净了。视图只是一层过滤——真相在基表 residents 里。直接查基表，看看有没有被视图悄悄滤掉的人。",
      task: "从基表 residents 中，查出 status 为「通缉」的居民。",
      skeleton: "SELECT * FROM ___\nWHERE ___ = ___;",
      hint: "视图 public_registry 的定义里有 WHERE status <> '通缉'，把通缉犯滤掉了。直接查基表 residents WHERE status='通缉' 就能揪出被藏起来的人。",
      solution: "SELECT * FROM residents WHERE status='通缉';",
      validate: (res) => anyCellContains(res, "钱九") && anyCellContains(res, "通缉"),
    },
    {
      id: "orphan-fk",
      badge: "线索 03",
      title: "指向幽灵的契据",
      concept: "参照完整性 · 外键孤儿",
      story:
        "房产契据的 owner_id 本该对应一名真实居民。可有一张契据，它的主人在 residents 里根本不存在——这是凭空伪造的（非法 INSERT）。把这种『孤儿』契据找出来。",
      task: "找出 property_deeds 里 owner_id 在 residents 中不存在的契据。",
      skeleton: "SELECT * FROM property_deeds\nWHERE ___ NOT IN (SELECT ___ FROM ___);",
      hint: "owner_id NOT IN (SELECT id FROM residents) 能找出主人不存在的契据；也可以用 LEFT JOIN residents ON ... WHERE residents.id IS NULL。只有 1 张是伪造的。",
      solution: "SELECT * FROM property_deeds WHERE owner_id NOT IN (SELECT id FROM residents);",
      validate: (res) => res.rows.length === 1 && anyCellContains(res, "42"),
    },
    {
      id: "dup-pk",
      badge: "线索 04",
      title: "重复的身份",
      concept: "实体完整性 · 主键唯一",
      story:
        "id 本该是居民的唯一身份证号，绝不允许重复。可篡改者往名册里塞了一个用了别人 id 的假身份。用分组找出哪个 id 出现了不止一次。",
      task: "找出 residents 里重复出现（COUNT > 1）的 id。",
      skeleton: "SELECT ___, COUNT(*)\nFROM ___\nGROUP BY ___\nHAVING COUNT(*) > ___;",
      hint: "GROUP BY id 按身份号分组，HAVING COUNT(*) > 1 只留下出现多次的 id。会发现 id=2 被用了两次。",
      solution: "SELECT id, COUNT(*) AS c FROM residents GROUP BY id HAVING COUNT(*) > 1;",
      validate: (res) => res.rows.length === 1 && flatten(res).includes("2"),
    },
    {
      id: "dml-trace",
      badge: "线索 05",
      title: "改动的痕迹",
      concept: "DML 痕迹 · UPDATE/DELETE",
      story:
        "新增、修改、删除——每一次写操作都被 change_log 记下了。伪造可以靠 INSERT，但偷改状态靠 UPDATE、销毁证据靠 DELETE。先把所有『改』和『删』的操作捞出来。",
      task: "从 change_log 中，查出所有 op 为「UPDATE」或「DELETE」的操作记录。",
      skeleton: "SELECT * FROM change_log\nWHERE op IN (___, ___);",
      hint: "用 op IN ('UPDATE','DELETE') 一次筛两种操作。会看到有人偷改了居民状态、还删掉了一张真契据。",
      solution: "SELECT * FROM change_log WHERE op IN ('UPDATE','DELETE');",
      validate: (res) =>
        anyCellContains(res, "DELETE") && anyCellContains(res, "周慎") && !flatten(res).includes("INSERT"),
    },
    {
      id: "lock",
      badge: "线索 06",
      title: "揪出篡改者",
      concept: "综合 · 分组锁定",
      story:
        "日志里多数人只做过一两次正常操作。唯独篡改者，一个人接连做了偷改、伪造、删除三件事。按操作人分组计数，做得最多的那个，就是内鬼。",
      task: "按 operator 分组统计操作次数，找出操作达到 3 次及以上的人。",
      skeleton: "SELECT ___, COUNT(*)\nFROM change_log\nGROUP BY ___\nHAVING COUNT(*) >= ___;",
      hint: "GROUP BY operator 统计每人改了几次，HAVING COUNT(*) >= 3 只留下高频操作者。唯一命中的，就是篡改者。",
      solution: "SELECT operator, COUNT(*) AS c FROM change_log GROUP BY operator HAVING COUNT(*) >= 3;",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
  ],
};
