/**
 * 霓虹栈城 · 城市地图（数据结构闯关）
 * frontend/lib/ds-city.ts
 *
 * 故事线：城市操作系统「秩序协议」崩溃，每个城区都由一种数据结构驱动而陷入混乱。
 * 你是维修工程师，按知识点顺序逐个城区动手修复，重建秩序。
 *
 * 城区顺序严格对应数据结构课程的基本知识点推进：
 * 线性结构（栈 / 队列 / 链表）→ 树形结构（二叉树·BST / 平衡树）
 * → 散列与图（哈希表 / 图）→ 秩序重建（排序）。
 */

export type DistrictStatus = "playable" | "soon" | "planned";

export interface District {
  /** 路由用 id（也是 /quest/data-structure/<id>） */
  id: string;
  /** 城区名 */
  name: string;
  /** 对应数据结构 */
  structure: string;
  /** 英文代号 */
  code: string;
  /** 一句话故事钩子 */
  hook: string;
  /** 本城区覆盖的核心知识点 */
  topics: string[];
  status: DistrictStatus;
  /** 主题色相（霓虹辉光） */
  hue: number;
}

export interface CityChapter {
  /** 章节序号标签 */
  label: string;
  /** 章节名（知识点大类） */
  title: string;
  /** 章节副标题 */
  theme: string;
  districts: District[];
}

export const DS_CITY: {
  codename: string;
  title: string;
  arc: string;
  chapters: CityChapter[];
} = {
  codename: "NEON STACK CITY",
  title: "霓虹栈城",
  /** 季度主线 */
  arc: "城市操作系统「秩序协议」崩溃了。每个城区都由一种数据结构驱动——它们正一个接一个地失控。你是被唤醒的维修工程师，唯一的武器，是亲手重建结构的双手。",
  chapters: [
    {
      label: "第一章",
      title: "线性结构",
      theme: "数据排成一条线时，秩序最朴素，也最考验顺序的纪律。",
      districts: [
        {
          id: "stack",
          name: "货运塔",
          structure: "栈 Stack",
          code: "STK",
          hook: "只有塔顶一个出入口的高塔，后进先出。全城物流的第一道关卡。",
          topics: ["LIFO", "入栈 / 出栈", "栈混洗", "合法出栈序列", "栈溢出"],
          status: "playable",
          hue: 190,
        },
        {
          id: "metro",
          name: "环线地铁",
          structure: "队列 Queue",
          code: "QUE",
          hook: "先到先走的环形轨道。当列车排满整圈，下一班该停在哪？",
          topics: ["FIFO", "入队 / 出队", "循环队列", "假溢出"],
          status: "playable",
          hue: 145,
        },
        {
          id: "pipes",
          name: "管道区",
          structure: "链表 Linked List",
          code: "LST",
          hook: "亲手断开、改接管道的接头。接错一节，整段就飘进虚空。",
          topics: ["结点与指针", "插入 / 删除", "遍历", "链表反转"],
          status: "playable",
          hue: 320,
        },
      ],
    },
    {
      label: "第二章",
      title: "树形结构",
      theme: "当数据学会分叉，查找就从一条线变成了一次次的左右抉择。",
      districts: [
        {
          id: "archive",
          name: "档案塔",
          structure: "二叉树 / BST",
          code: "BST",
          hook: "按编号查档，每一层都要决定往左还是往右。三种巡逻路线，三种遍历。",
          topics: ["二叉树", "二叉排序树", "前 / 中 / 后序遍历", "查找与插入"],
          status: "playable",
          hue: 45,
        },
        {
          id: "tower",
          name: "倾斜高塔",
          structure: "平衡树 AVL",
          code: "AVL",
          hook: "数据总往一边堆，塔就会倾斜。一次旋转，扶正整座塔。",
          topics: ["平衡因子", "失衡判定", "左旋 / 右旋", "LL/RR/LR/RL"],
          status: "playable",
          hue: 25,
        },
      ],
    },
    {
      label: "第三章",
      title: "散列与图",
      theme: "当位置可以被计算、当万物彼此相连，城市的脉络真正成形。",
      districts: [
        {
          id: "postoffice",
          name: "中央邮局",
          structure: "哈希表 Hash",
          code: "HSH",
          hook: "用哈希函数把信投进格口。撞了格子，是挂链子还是找下一格？",
          topics: ["哈希函数", "冲突处理", "链地址 / 开放定址", "装填因子与 rehash"],
          status: "playable",
          hue: 265,
        },
        {
          id: "grid",
          name: "城市电网",
          structure: "图 Graph",
          code: "GRP",
          hook: "停电之夜，供电像波纹一圈圈扩散。给救护车找一条最短的路。",
          topics: ["邻接表 / 邻接矩阵", "BFS / DFS", "最短路径", "最小生成树"],
          status: "playable",
          hue: 165,
        },
      ],
    },
    {
      label: "终章",
      title: "秩序重建",
      theme: "当所有结构归位，剩下的，是让混乱的数据重新排好队。",
      districts: [
        {
          id: "sorting",
          name: "分拣厂",
          structure: "排序 Sorting",
          code: "SRT",
          hook: "亲手执行一轮 partition，或者让冒泡与快排赛跑，下注谁先到终点。",
          topics: ["冒泡 / 插入 / 选择", "快排 partition", "时间复杂度对决"],
          status: "playable",
          hue: 0,
        },
      ],
    },
  ],
};

/** 扁平化所有城区（按顺序） */
export const ALL_DISTRICTS: District[] = DS_CITY.chapters.flatMap((c) => c.districts);
