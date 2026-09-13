# 暖奶油编辑风 / Warm Cream Editorial

design-guide
1.设计思想
- 核心是 warm editorial brand book come to life：像一本会动的品牌手册、研究报告、产品说明书。
- 它强调“文字本身有表达力”，不是靠复杂图形抢注意力。
- 每一帧要有一个明确焦点：一句观点、一个数字、一个代码面板、一段 pull quote。
- 风格纪律很强：温暖纸面、细边框、低对比层次、少量珊瑚色点火。
- 适合表达“认真思考后的判断”，而不是热闹宣传。
2.配色方案
- 主底色是暖奶油色：#FAF9F5，不能用纯白。整页统一用半阶暖 tile #EFE9DE，避免中间发白。
- 主文字是近黑墨色：#141413，不能用纯黑。
- 卡片 / 内容块用半阶暖 tile 色：#EFE9DE、#ECE3D4，像纸上再垫一层纸。
- 核心点缀色是珊瑚色：#CC785C，但必须非常克制。
- 深色代码区用暖海军黑：#181715、#1F1E1B、#252320。
- 代码语法里允许固定装饰色：teal #5DB8A6、amber #E8A55A，但它们不是品牌主色。
最重要的规则：cream 是地面，ink 是声音，coral 是电压。珊瑚色一帧最多出现一次，不能满屏乱用。
3.字体气质
- Display / 大标题：EB Garamond，400 weight，带一点负字距，气质是文学、编辑、观点表达。
- 正文 / UI / 卡片标题：Inter，干净现代，但不抢戏。
- 技术标签 / 代码 / kicker：JetBrains Mono，带工程感和索引感。
- 中文替代建议：
  - 大标题：思源宋体 / Noto Serif SC / Songti SC
  - 正文：思源黑体 / Noto Sans SC / PingFang SC
  - 代码：Noto Sans Mono CJK / JetBrains Mono
它的字体原则是：serif 负责思想，sans 负责说明，mono 负责技术索引。
4.材质与表面
- 质感是“温暖纸张 + 细线边框 + 轻微纸片层次”。
- 允许非常轻的阴影：0 1px 3px + 0 4px 16px 这种温和 elevation。
- 分隔线只能是 1px hairline。
- 卡片有 6/8/12px 的轻圆角，不是硬方块，也不是大圆角。
- 禁止重阴影、发光、渐变、玻璃拟态、倾斜透视。
- 整体是平面编辑感，不是 3D UI。
5.组件设计
- card-hairline：核心内容卡片，暖色块 + 1px 边线 + 很轻阴影。
- kicker-spike：珊瑚色 ✱ + JetBrains Mono 大写标签，是 Claude 风格很标志性的眉标。
- coral-callout：唯一高能点，可以是 CTA、强调链接、整条珊瑚色带，但一帧只能有一个。
- number-lockup：大号 EB Garamond 数字 + mono 单位，适合展示指标、变化量。
- pull-quote：EB Garamond italic 引语 + 小号 uppercase cite。
- code-surface：暖 navy 代码窗口，适合 diff、terminal、代码片段。
- section-rule：1px 分隔线，珊瑚色可以作为 draw-on 动效，但不能粗。
