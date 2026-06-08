/**
 * 第七案《看不见的转账》
 * 知识点（层层递进）：账目总览 → 事务的步骤(原子性) → 原子性违例 →
 *                    脏读(读未提交) → 死锁(锁的循环等待) → 锁定作案事务
 *
 * 教学核心：一笔转账=扣款+入账两步，事务的原子性要求要么全成、要么全败。
 * 这笔黑账扣款已提交、入账却回滚，钱凭空消失；作案者还靠脏读读到未提交余额
 * 择时下手；锁表里两笔事务互相等待，构成死锁。
 */
import {
  type DetectiveCase,
  anyCellContains,
  rowSetContains,
} from "../db-detective";

const CULPRIT = "孟通"; // T100：原子性违例 + 脏读，均为孟通所为

export const caseInvisibleTransfer: DetectiveCase = {
  id: "invisible-transfer",
  order: 7,
  concepts: "事务 ACID · 并发 · 隔离级别 · 死锁",
  culprit: CULPRIT,
  briefing: [
    {
      term: "事务与原子性",
      story: "一笔转账 = 扣款 + 入账两步，要么同生、要么同死；只成一半，钱就凭空消失。",
      definition: "事务是一组要么全做、要么全不做的操作；原子性（Atomicity）保证其不可分割，是 ACID 之一。",
    },
    {
      term: "提交与回滚",
      story: "committed 表示这步已生效，rolledback 表示已撤销。半途回滚的那一步，正是黑账的破绽。",
      definition: "COMMIT 使事务改动永久生效，ROLLBACK 撤销事务的全部改动。",
    },
    {
      term: "脏读与隔离级别",
      story: "作案者读到了别的事务尚未提交的余额，掐着点下手——这是隔离不足留下的漏洞。",
      definition: "脏读指读到了未提交的数据；提高隔离级别可避免脏读、不可重复读、幻读等并发异常。",
    },
    {
      term: "死锁",
      story: "两笔事务各持一把锁，又都在等对方手里的那把，谁也不肯让，系统就此卡死。",
      definition: "死锁是两个及以上事务互相等待对方持有的资源，形成循环等待、无法推进。",
    },
  ],
  meta: {
    codename: "雾港谜案",
    subtitle: "第七案 · 事务与并发",
    title: "《看不见的转账》",
    intro:
      "金库少了五万，账本却『平』着。钱不会凭空消失——除非你懂事务。一笔转账本该扣款、入账同生共死，可有一笔扣了款、入账却被回滚；作案者还趁数据未提交时偷看了余额，掐着点下手。事务日志，会把这笔看不见的转账显形。",
    arc: "这五万，和第六案假订单流向的是同一个离岸账户。校对者在收网前，先把金库掏空了。",
  },
  accusation: {
    prompt:
      "那笔违反原子性的黑账（扣款已提交、入账却回滚），和择时下手的脏读，都是同一个人干的。输入这名出纳的姓名结案。",
    winNote:
      "你用事务的视角破了案：原子性要求转账的扣款与入账要么全部提交、要么全部回滚，这笔黑账半途而废，金库的钱就此消失；脏读让作案者读到了别的事务尚未提交的余额；锁表里两笔事务互相等待对方持有的资源，构成死锁。ACID 不是抽象口号——它是钱不翼而飞时唯一的解释。",
  },
  seedSql: `
CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT, balance INTEGER);
INSERT INTO accounts VALUES
 (1,'金库',150000),(2,'备用金',50000),(3,'账户A',10000),(4,'账户B',8000);

CREATE TABLE txn_log (
  log_id INTEGER PRIMARY KEY, txn_id TEXT, account_id INTEGER,
  op TEXT, amount INTEGER, state TEXT, operator TEXT, ts TEXT
);
INSERT INTO txn_log VALUES
 (1,'T100',1,'debit',50000,'committed','孟通','2024-06-01 03:10'),
 (2,'T100',2,'credit',50000,'rolledback','孟通','2024-06-01 03:11'),
 (3,'T100',2,'read',50000,'uncommitted','孟通','2024-06-01 03:09'),
 (4,'T200',3,'debit',1000,'committed','李柜','2024-05-20 10:00'),
 (5,'T200',4,'credit',1000,'committed','李柜','2024-05-20 10:00'),
 (6,'T300',1,'debit',2000,'committed','王柜','2024-05-21 11:00'),
 (7,'T300',3,'credit',2000,'committed','王柜','2024-05-21 11:00');

CREATE TABLE locks (txn_id TEXT, holds TEXT, waits_for TEXT);
INSERT INTO locks VALUES
 ('T100','金库','备用金'),
 ('T400','备用金','金库'),
 ('T300','账户A',NULL);
`,
  schema: [
    {
      name: "accounts",
      comment: "账户余额",
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "balance", type: "INTEGER" },
      ],
    },
    {
      name: "txn_log",
      comment: "事务步骤日志",
      columns: [
        { name: "log_id", type: "INTEGER" },
        { name: "txn_id", type: "TEXT", note: "事务编号" },
        { name: "account_id", type: "INTEGER" },
        { name: "op", type: "TEXT", note: "debit/credit/read" },
        { name: "amount", type: "INTEGER" },
        { name: "state", type: "TEXT", note: "committed/rolledback/uncommitted" },
        { name: "operator", type: "TEXT" },
        { name: "ts", type: "TEXT" },
      ],
    },
    {
      name: "locks",
      comment: "锁表（持有 / 等待）",
      columns: [
        { name: "txn_id", type: "TEXT" },
        { name: "holds", type: "TEXT", note: "持有的资源" },
        { name: "waits_for", type: "TEXT", note: "等待的资源" },
      ],
    },
  ],
  levels: [
    {
      id: "accounts",
      badge: "线索 01",
      title: "金库少了钱",
      concept: "SELECT · 账目总览",
      story:
        "报案：金库余额对不上。先把所有账户余额调出来，看看哪个账户出了问题。",
      task: "查出 accounts 里全部账户的余额。",
      skeleton: "SELECT * FROM ___;",
      hint: "SELECT * FROM accounts。金库本应有二十万，如今只剩十五万——五万去哪了？",
      solution: "SELECT * FROM accounts;",
      validate: (res) => res.rows.length >= 4 && anyCellContains(res, "金库"),
    },
    {
      id: "normal-txn",
      badge: "线索 02",
      title: "一笔正常的转账",
      concept: "原子性 · 事务的两步",
      story:
        "一笔转账由两步组成：从一个账户扣款（debit）、给另一个账户入账（credit）。原子性要求这两步要么都成功、要么都失败。先看一笔正常的转账长什么样。",
      task: "查出事务 T200 的全部步骤。",
      skeleton: "SELECT * FROM txn_log\nWHERE ___ = 'T200';",
      hint: "WHERE txn_id='T200'。你会看到 debit 和 credit 两步都是 committed——这才是健康的事务。",
      solution: "SELECT * FROM txn_log WHERE txn_id='T200';",
      validate: (res) =>
        anyCellContains(res, "committed") && !anyCellContains(res, "rolledback") && res.rows.length === 2,
    },
    {
      id: "atomicity",
      badge: "线索 03",
      title: "半途而废的事务",
      concept: "原子性违例 · 钱的去向",
      story:
        "正常事务两步同生共死。可有一步的状态是 rolledback（已回滚）——它所在的那笔事务，扣款成了、入账却没成，原子性被打破，钱就此蒸发。把所有被回滚的步骤揪出来。",
      task: "查出 txn_log 里 state 为「rolledback」的步骤，看它属于哪笔事务。",
      skeleton: "SELECT * FROM txn_log\nWHERE ___ = 'rolledback';",
      hint: "WHERE state='rolledback'。只有一条——它属于事务 T100。配合那笔已提交的扣款，五万就是这么消失的。",
      solution: "SELECT * FROM txn_log WHERE state='rolledback';",
      validate: (res) => anyCellContains(res, "T100") && res.rows.length === 1,
    },
    {
      id: "dirty-read",
      badge: "线索 04",
      title: "偷看未提交的余额",
      concept: "脏读 · 隔离级别",
      story:
        "作案者怎么掐准时机？他读到了别的事务尚未提交的余额——这叫脏读，是隔离级别不足时的漏洞。找出那条读取了未提交数据的记录，作案者的名字就在里面。",
      task: "查出 op 为「read」且 state 为「uncommitted」的操作（即脏读）。",
      skeleton: "SELECT * FROM txn_log\nWHERE ___ = 'read' AND ___ = 'uncommitted';",
      hint: "WHERE op='read' AND state='uncommitted'。一条脏读记录，经手人和那笔黑账是同一个人。",
      solution: "SELECT * FROM txn_log WHERE op='read' AND state='uncommitted';",
      validate: (res) => anyCellContains(res, "孟通") && res.rows.length === 1,
    },
    {
      id: "deadlock",
      badge: "线索 05",
      title: "互相等待的死结",
      concept: "死锁 · 锁的循环等待",
      story:
        "作案当晚系统卡死过——两笔事务各持一把锁，又都在等对方手里的那把，谁也不让，构成死锁。用锁表自连接，找出这对互相等待的事务。",
      task:
        "把 locks 表自连接，找出两笔『各自持有对方所等待的资源』的事务（死锁对）。",
      skeleton:
        "SELECT a.txn_id, b.txn_id\nFROM locks a\nJOIN locks b ON a.holds = ___ AND a.waits_for = ___;",
      hint: "自连接条件：a.holds = b.waits_for AND a.waits_for = b.holds。能配上的就是死锁的两笔事务——T100 和 T400。",
      solution:
        "SELECT a.txn_id, b.txn_id FROM locks a JOIN locks b ON a.holds=b.waits_for AND a.waits_for=b.holds;",
      validate: (res) => rowSetContains(res, ["T100", "T400"]),
    },
    {
      id: "lock",
      badge: "线索 06",
      title: "锁定作案人",
      concept: "综合 · 锁定事务责任人",
      story:
        "黑账事务 T100——原子性违例在它身上，脏读也在它身上。查出操作这笔事务的人，就是掏空金库的内鬼。",
      task: "查出事务 T100 的操作人（operator）。",
      skeleton: "SELECT DISTINCT ___\nFROM txn_log\nWHERE ___ = 'T100';",
      hint: "SELECT DISTINCT operator FROM txn_log WHERE txn_id='T100'。整笔黑账都是一个人操作的。",
      solution: "SELECT DISTINCT operator FROM txn_log WHERE txn_id='T100';",
      validate: (res) => anyCellContains(res, CULPRIT) && res.rows.length === 1,
    },
  ],
};
