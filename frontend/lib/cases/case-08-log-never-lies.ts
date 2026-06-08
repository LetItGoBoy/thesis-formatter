/**
 * 第八案（终章）《日志不会说谎》
 * 知识点（层层递进）：读事务日志(WAL) → redo(重做已提交) → undo(回滚未提交) →
 *                    从日志还原被删真相 → 权限审查(越权自授) → 揭穿校对者
 *
 * 终章：校对者删库跑路、清空了可见记录，但预写日志(WAL)还在。用 redo/undo
 * 还原被删的真相，再顺着权限与审计记录，揪出那个握有最高权限、亲手删库的人——
 * 校对者的真身，是档案库的系统总管。
 */
import {
  type DetectiveCase,
  anyCellContains,
} from "../db-detective";

const CULPRIT = "裴决"; // 系统总管：自授 ALL 权限 + 亲手 DELETE_ALL

export const caseLogNeverLies: DetectiveCase = {
  id: "log-never-lies",
  order: 8,
  concepts: "恢复(redo/undo) · 权限安全 · 综合",
  culprit: CULPRIT,
  briefing: [
    {
      term: "预写日志（WAL）",
      story: "可见记录被清空，但每一次改动都先写进了日志，连「改动前」的原貌都留着——这成了翻案的起点。",
      definition: "预写日志在修改数据前先记录变更，是崩溃恢复的依据；含改前值、改后值与提交标志。",
    },
    {
      term: "redo / undo（恢复）",
      story: "已提交的改动重做一遍确保不丢（redo），未提交的撤销回到改动前（undo）。",
      definition: "恢复时 redo 重做已提交事务、undo 回滚未提交事务，使数据库回到一致状态。",
    },
    {
      term: "权限（GRANT / REVOKE）",
      story: "谁能写、谁能删，由授权决定；把最高权限授给自己，就是越权的铁证。",
      definition: "GRANT 授予权限、REVOKE 收回权限；最小权限原则要求只授予完成工作所必需的权限。",
    },
    {
      term: "审计",
      story: "删库、收权这类敏感操作都被审计日志一一记下，谁、何时、做了什么，一清二楚。",
      definition: "审计记录对数据库的敏感操作，用于事后追责与取证。",
    },
  ],
  meta: {
    codename: "雾港谜案",
    subtitle: "终章 · 恢复与真相",
    title: "《日志不会说谎》",
    intro:
      "校对者图穷匕见——删库跑路，把可见的记录清得一干二净。可他忘了：数据库的每一次改动，都先写进了预写日志（WAL）。已提交的可以 redo 重做、未提交的可以 undo 回滚，被删的真相，全都还躺在日志里。这一次，你要用整季学到的本事，把这个躲在最高权限背后的人，连根拔出。",
    arc: "档案库的写权限层层上溯，最终汇向同一个账号——它把 ALL 权限授给了自己。校对者，从来都在系统的最顶端。",
  },
  accusation: {
    prompt:
      "他把最高权限 ALL 授予了自己，又亲手执行了清空全表的 DELETE_ALL。能做到这两件事的，只有档案库的系统总管。写下校对者的真名，终结这一切。",
    winNote:
      "日志不会说谎。WAL 让你 redo 已提交、undo 未提交，把被删的『钱九|通缉』从 before_val 里复活；权限表暴露了那个把 ALL 授给自己的越权者；审计记录钉死了亲手删库的人。三者交汇，校对者现形——他是档案库的系统总管，权限的滥用者。整座雾港的档案，终于重见天日。",
  },
  seedSql: `
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT);
INSERT INTO users VALUES
 (1,'裴决','系统总管'),(2,'周慎','档案员'),(3,'严松','账房'),(4,'孟通','出纳'),(5,'李正','档案员');

CREATE TABLE privileges (user TEXT, privilege TEXT, granted_by TEXT);
INSERT INTO privileges VALUES
 ('裴决','ALL','裴决'),
 ('周慎','WRITE','裴决'),
 ('严松','WRITE','裴决'),
 ('孟通','WRITE','裴决'),
 ('李正','READ','裴决');

CREATE TABLE audit (id INTEGER PRIMARY KEY, user TEXT, action TEXT, object TEXT, ts TEXT);
INSERT INTO audit VALUES
 (1,'裴决','REVOKE','周慎的WRITE','2024-06-10 04:00'),
 (2,'裴决','DELETE_ALL','residents全表','2024-06-10 04:05'),
 (3,'李正','SELECT','residents','2024-06-09 09:00'),
 (4,'孟通','UPDATE','accounts','2024-06-01 03:10');

CREATE TABLE wal (
  lsn INTEGER PRIMARY KEY, txn_id TEXT, action TEXT, table_name TEXT,
  row_id INTEGER, before_val TEXT, after_val TEXT, committed INTEGER
);
INSERT INTO wal VALUES
 (1,'TX9','DELETE','residents',2,'钱九|通缉','',1),
 (2,'TX9','UPDATE','residents',5,'周慎|正常','周慎|已离职',0),
 (3,'TX8','INSERT','deeds',99,'','伪造契据',1),
 (4,'TX7','UPDATE','accounts',1,'200000','150000',1);
`,
  schema: [
    {
      name: "users",
      comment: "系统用户",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "role", type: "TEXT" },
      ],
    },
    {
      name: "privileges",
      comment: "权限授予（GRANT）",
      columns: [
        { name: "user", type: "TEXT" },
        { name: "privilege", type: "TEXT", note: "READ/WRITE/ALL" },
        { name: "granted_by", type: "TEXT", note: "授权人" },
      ],
    },
    {
      name: "audit",
      comment: "敏感操作审计",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "user", type: "TEXT" },
        { name: "action", type: "TEXT", note: "REVOKE/DELETE_ALL/…" },
        { name: "object", type: "TEXT" },
        { name: "ts", type: "TEXT" },
      ],
    },
    {
      name: "wal",
      comment: "预写日志（恢复用）",
      columns: [
        { name: "lsn", type: "INTEGER", note: "日志序号" },
        { name: "txn_id", type: "TEXT" },
        { name: "action", type: "TEXT" },
        { name: "table_name", type: "TEXT" },
        { name: "row_id", type: "INTEGER" },
        { name: "before_val", type: "TEXT", note: "改动前（undo 用）" },
        { name: "after_val", type: "TEXT", note: "改动后（redo 用）" },
        { name: "committed", type: "INTEGER", note: "1 已提交 / 0 未提交" },
      ],
    },
  ],
  levels: [
    {
      id: "wal",
      badge: "线索 01",
      title: "翻开预写日志",
      concept: "WAL · 恢复的起点",
      story:
        "可见记录被清空了，但每一次改动都先写进了预写日志 WAL。它记着每条操作的『改动前』和『改动后』。先把整本日志翻开。",
      task: "查出 wal 预写日志里的全部记录。",
      skeleton: "SELECT * FROM ___;",
      hint: "SELECT * FROM wal。注意 before_val（改前）、after_val（改后）和 committed（是否提交）这几列——恢复全靠它们。",
      solution: "SELECT * FROM wal;",
      validate: (res) => res.rows.length >= 4,
    },
    {
      id: "redo",
      badge: "线索 02",
      title: "重做已提交的改动",
      concept: "redo · 重做已提交",
      story:
        "数据库崩溃恢复的第一步是 redo：把所有『已提交』的改动重新应用一遍，确保它们不丢。先把已提交（committed = 1）的日志全部找出来。",
      task: "查出 wal 里所有 committed 为 1（已提交）的日志记录。",
      skeleton: "SELECT * FROM wal\nWHERE ___ = 1;",
      hint: "WHERE committed = 1。这些是需要 redo 重做的、确定生效的改动；那条未提交的不在其中。",
      solution: "SELECT * FROM wal WHERE committed=1;",
      validate: (res) => res.rows.length === 3 && !anyCellContains(res, "已离职"),
    },
    {
      id: "undo",
      badge: "线索 03",
      title: "回滚未提交的改动",
      concept: "undo · 回滚未提交",
      story:
        "恢复的第二步是 undo：把『未提交』的改动撤销，恢复到它的 before_val。校对者有一笔没来得及提交的偷改，正该被回滚。把未提交的日志找出来。",
      task: "查出 wal 里 committed 为 0（未提交）的日志记录。",
      skeleton: "SELECT * FROM wal\nWHERE ___ = 0;",
      hint: "WHERE committed = 0。只有一条——它想把『周慎|正常』偷改成『已离职』，但没提交，按 before_val 撤销即可。",
      solution: "SELECT * FROM wal WHERE committed=0;",
      validate: (res) => res.rows.length === 1 && anyCellContains(res, "已离职"),
    },
    {
      id: "recover",
      badge: "线索 04",
      title: "复活被删的真相",
      concept: "before_val · 从日志还原",
      story:
        "校对者删掉了一条居民记录，想让某个真相永远消失。可 DELETE 也写进了日志——它的 before_val，就是被删那一刻的原貌。把它读出来，真相复活。",
      task: "从 wal 中，查出对 residents 表执行 DELETE 的那条记录的 before_val（被删前的内容）。",
      skeleton: "SELECT before_val FROM wal\nWHERE ___ = 'DELETE' AND ___ = 'residents';",
      hint: "WHERE action='DELETE' AND table_name='residents'，取 before_val。你会看到被删的正是『钱九|通缉』——第五案里被视图藏起的通缉犯。",
      solution: "SELECT before_val FROM wal WHERE action='DELETE' AND table_name='residents';",
      validate: (res) => anyCellContains(res, "钱九") && anyCellContains(res, "通缉"),
    },
    {
      id: "privilege",
      badge: "线索 05",
      title: "把权限授给自己的人",
      concept: "权限安全 · 越权自授",
      story:
        "能删库的人，必有最高权限。正常的授权，授权人和被授权人不会是同一个；唯独有人把 ALL 权限授给了自己——这是越权的铁证。揪出这个自授权限的人。",
      task: "从 privileges 中，找出 user 和 granted_by 是同一个人的记录（即把权限授给自己的人）。",
      skeleton: "SELECT user FROM privileges\nWHERE ___ = ___;",
      hint: "WHERE user = granted_by。正常授权两者不同，只有自授权限的人会让它们相等——那就是握有 ALL 权限的系统总管。",
      solution: "SELECT user FROM privileges WHERE user=granted_by;",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
    {
      id: "unmask",
      badge: "线索 06",
      title: "揭穿校对者",
      concept: "综合 · 权限 × 审计",
      story:
        "终章的最后一击：把审计记录和权限表连起来。那个既握有 ALL 权限、又亲手执行了清空全表（DELETE_ALL）的人，就是藏在系统最顶端的校对者。揪出他。",
      task:
        "连接 audit 和 privileges，找出既执行了 DELETE_ALL、又持有 ALL 权限的那个人。",
      skeleton:
        "SELECT DISTINCT a.user\nFROM audit a\nJOIN privileges p ON ___ = ___\nWHERE a.action = 'DELETE_ALL' AND p.privilege = 'ALL';",
      hint: "JOIN privileges p ON p.user=a.user，WHERE a.action='DELETE_ALL' AND p.privilege='ALL'。同时满足这两条的，唯有系统总管。",
      solution:
        "SELECT DISTINCT a.user FROM audit a JOIN privileges p ON p.user=a.user WHERE a.action='DELETE_ALL' AND p.privilege='ALL';",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
  ],
};
