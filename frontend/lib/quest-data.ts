export type QuestChoice = {
  id: string;
  text: string;
};

export type QuestQuestion = {
  id: string;
  stem: string;
  choices: QuestChoice[];
  answer: string;
  explanation: string;
};

export type QuestLevel = {
  id: string;
  title: string;
  subtitle: string;
  storyHook: string;
  knowledgeGoal: string[];
  unlock: string[];
  passRule: string;
  questions: QuestQuestion[];
};

export type QuestChapter = {
  id: string;
  title: string;
  status: "open" | "locked" | "soon";
  storyTitle: string;
  feishuUrl?: string;
  summary: string;
  levels: QuestLevel[];
};

export const dataStructureQuest = {
  courseTitle: "数据结构",
  storyTitle: "霓虹栈城：断点回声",
  subtitle: "赛博朋克有声小说 + 闯关学习",
  progress: 2,
  currentLevel: "Lv.1 断点观察者",
  unlockedSkill: "结构意识",
  nextChapter: "线性表街区",
  chapters: [
    {
      id: "prologue",
      title: "序章",
      status: "open",
      storyTitle: "雨夜断点",
      summary: "林澈在栈城学院入学夜遭遇城市级异常，第一次意识到数据失去结构后的混乱。",
      levels: [
        {
          id: "0-1",
          title: "数据为什么不能只堆在一起",
          subtitle: "断点观察",
          storyHook: "新生大厅任务系统错乱，任务数据还在，但前后关系已经断裂。",
          knowledgeGoal: ["理解数据与结构的区别", "理解一组数据需要关系才能被有效使用"],
          unlock: ["Lv.1 断点观察者", "结构意识 +1"],
          passRule: "4 题答对 3 题",
          questions: [
            {
              id: "q0-1-1",
              stem: "新生任务清单出现错位和断裂，最核心的问题是什么？",
              choices: [
                { id: "A", text: "屏幕亮度太低" },
                { id: "B", text: "数据之间的前后关系被破坏" },
                { id: "C", text: "学生数量太多" },
                { id: "D", text: "学院服务器没有联网" },
              ],
              answer: "B",
              explanation: "任务清单需要明确的前后关系。关系被破坏后，即使任务数据还在，也无法正常执行。",
            },
            {
              id: "q0-1-2",
              stem: "MIRA 说“数据只是材料”，这句话强调了什么？",
              choices: [
                { id: "A", text: "数据不重要" },
                { id: "B", text: "结构决定数据如何被使用" },
                { id: "C", text: "所有数据都必须排序" },
                { id: "D", text: "数据只能存进数据库" },
              ],
              answer: "B",
              explanation: "数据本身只是内容，结构决定数据之间的关系以及系统如何访问和修改它们。",
            },
            {
              id: "q0-1-3",
              stem: "如果一组任务没有顺序，最直接的影响是什么？",
              choices: [
                { id: "A", text: "无法判断先做什么后做什么" },
                { id: "B", text: "任务字体会变小" },
                { id: "C", text: "所有任务都会自动完成" },
                { id: "D", text: "任务会变成图片" },
              ],
              answer: "A",
              explanation: "顺序是一组任务可执行的基础。没有前后关系，系统无法稳定派发任务。",
            },
            {
              id: "q0-1-4",
              stem: "“把所有东西都扔进仓库”对应的主要问题是什么？",
              choices: [
                { id: "A", text: "存得太少" },
                { id: "B", text: "没有组织方式，使用时难以定位" },
                { id: "C", text: "颜色不好看" },
                { id: "D", text: "数据会自动消失" },
              ],
              answer: "B",
              explanation: "没有结构的数据也许还存在，但查找、访问和修改都会变得低效甚至不可控。",
            },
          ],
        },
        {
          id: "0-2",
          title: "同样的数据，不同结构影响什么",
          subtitle: "结构选择",
          storyHook: "MIRA 展示任务、队列、地图、排行榜等故障画面，说明不同问题需要不同结构。",
          knowledgeGoal: ["理解结构影响访问、修改、查找和恢复", "理解不同场景不能套用同一种结构"],
          unlock: ["秩序协议进度 2%", "Null 线索 +1"],
          passRule: "4 题答对 3 题",
          questions: [
            {
              id: "q0-2-1",
              stem: "交通闸口排队失控，最接近后续哪类结构的应用场景？",
              choices: [
                { id: "A", text: "队列" },
                { id: "B", text: "树" },
                { id: "C", text: "哈希表" },
                { id: "D", text: "图" },
              ],
              answer: "A",
              explanation: "排队强调先来先处理，正是队列思想的典型场景。",
            },
            {
              id: "q0-2-2",
              stem: "城市地图中的“节点和连接”更适合为哪个知识点做铺垫？",
              choices: [
                { id: "A", text: "栈" },
                { id: "B", text: "图" },
                { id: "C", text: "串" },
                { id: "D", text: "顺序表" },
              ],
              answer: "B",
              explanation: "地图路径由地点和道路组成，对应图中的顶点和边。",
            },
            {
              id: "q0-2-3",
              stem: "如果系统要从最后一步开始撤销错误，更接近哪种结构思想？",
              choices: [
                { id: "A", text: "队列" },
                { id: "B", text: "栈" },
                { id: "C", text: "图" },
                { id: "D", text: "排序" },
              ],
              answer: "B",
              explanation: "撤销通常从最后一步开始回退，符合栈的后进先出思想。",
            },
            {
              id: "q0-2-4",
              stem: "为什么不能所有问题都使用同一种结构？",
              choices: [
                { id: "A", text: "不同问题关注的操作和关系不同" },
                { id: "B", text: "老师不允许" },
                { id: "C", text: "结构越多越好看" },
                { id: "D", text: "同一种结构不能存数据" },
              ],
              answer: "A",
              explanation: "不同场景关注访问、插入、删除、查找、路径等不同操作，因此需要不同结构。",
            },
          ],
        },
        {
          id: "0-3",
          title: "识别生活中的结构问题",
          subtitle: "抽象能力",
          storyHook: "沈砚发布任务后，林澈需要把眼前的城市异常抽象成结构问题。",
          knowledgeGoal: ["能把现实问题抽象成结构问题", "能识别线性、队列、树、图、排序等基础思想"],
          unlock: ["序章完成", "下一章：线性表街区"],
          passRule: "5 题答对 4 题",
          questions: [
            {
              id: "q0-3-1",
              stem: "文件目录的层级关系更接近哪种结构？",
              choices: [
                { id: "A", text: "树" },
                { id: "B", text: "队列" },
                { id: "C", text: "排序" },
                { id: "D", text: "串" },
              ],
              answer: "A",
              explanation: "文件夹和子文件夹之间存在父子层级关系，适合用树来理解。",
            },
            {
              id: "q0-3-2",
              stem: "排行榜错乱主要会引出后续哪类问题？",
              choices: [
                { id: "A", text: "排序与优先级" },
                { id: "B", text: "递归" },
                { id: "C", text: "身份匹配" },
                { id: "D", text: "链式存储" },
              ],
              answer: "A",
              explanation: "排行榜关注顺序和比较，后续会自然进入排序问题。",
            },
            {
              id: "q0-3-3",
              stem: "身份码和学生身份之间需要正确对应，这更接近哪类能力？",
              choices: [
                { id: "A", text: "匹配与查找" },
                { id: "B", text: "颜色渲染" },
                { id: "C", text: "音频播放" },
                { id: "D", text: "图片压缩" },
              ],
              answer: "A",
              explanation: "身份认证需要把身份码和目标对象匹配起来，涉及匹配与查找思想。",
            },
            {
              id: "q0-3-4",
              stem: "序章中“秩序协议”最像什么？",
              choices: [
                { id: "A", text: "逐步积累的数据结构能力集合" },
                { id: "B", text: "普通宿舍门禁卡" },
                { id: "C", text: "天气系统" },
                { id: "D", text: "随机任务奖励" },
              ],
              answer: "A",
              explanation: "秩序协议会随着章节推进逐步获得能力模块，是整门课知识积累的剧情化表达。",
            },
            {
              id: "q0-3-5",
              stem: "序章结束后，林澈真正开始学习的第一件事是什么？",
              choices: [
                { id: "A", text: "理解结构" },
                { id: "B", text: "修电梯" },
                { id: "C", text: "买游戏机" },
                { id: "D", text: "删除课程" },
              ],
              answer: "A",
              explanation: "腕屏上的任务 0-1 是“理解结构”，这是数据结构课程的入口。",
            },
          ],
        },
      ],
    },
    {
      id: "linear-list",
      title: "第一章",
      status: "locked",
      storyTitle: "线性表街区",
      summary: "修复学院任务清单中的前后关系，理解线性表、顺序表、链表、插入与删除。",
      levels: [],
    },
  ] satisfies QuestChapter[],
};
