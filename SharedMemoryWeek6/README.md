# Shared Memory Space / Memory Constellation

在 SharedMemoryWeek5 原项目上升级。保留原来的 Three.js Memory Room、Firebase 配置和 NYU / ITP Replicate proxy；保留固定公寓首页，并新增可一键切换的 UMAP 星图。桌面的 Week 5 原文件未改动。

## 运行

1. 用 VS Code 打开本文件夹 **SharedMemorySpace**。
2. 用 Five Server 打开 `index.html`。地址应为 `http://localhost:…` 或 `http://127.0.0.1:…`，不要双击用 `file://` 打开。
3. 输入原来的名字，继续访问同一个 Firebase 房间。首次使用 UMAP 模式时，语义模型需要联网下载约百 MB 文件，状态栏会显示进度。此时下方的 Unplaced rooms 仍可进入原房间。
4. 在左侧输入记忆，中英文均可。停止输入约 900ms 后自动保存；模型计算完成后 YOU NOW 会移动，附近人选也会更新。
5. 点击地图上的名字或附近人选，进入原有 3D 房间。Return to the Space 返回地图。
6. 点 **God Button / Generate 20 People**，通过原 proxy 请求生成约 20 个虚构用户。生成结果校验成功后，统一写入 Firebase，并逐条计算 embedding。

生产页面不需要 npm、构建、后端服务或新 API key。Five Server 的额外文件监听脚本若不支持 worker，不影响应用使用；请使用现代 Chrome / Edge，并允许模型资源下载。

## TransformControls 黑屏根因修复

控制台截图定位到 TransformControlsGizmo.updateMatrixWorld。新增主页原先使用 data-mode="umap/house"，而旧物件工具用宽泛的 [data-mode] 选择器绑定点击事件；主页上的点击向上冒泡，把 umap/house 传进 TransformControls.setMode，导致控件读取不存在的 gizmo.children。

已把主页属性改为 data-lobby-mode，编辑事件只绑定 button.tool-btn[data-mode]，并且仅允许 translate / rotate / scale。新增回归测试复现旧报错，确认点击主页/切换模式不再改变编辑工具，同时三种编辑工具仍然正常。更新后请重新加载页面，清除浏览器内存中已有的非法控件状态。

## 房间渲染保护

房间 canvas 改为绝对定位，避免 Retina 像素尺寸撑高网格，进而导致画布超出显卡限制。进入房间立即同步尺寸并绘制首帧，ResizeObserver 持续同步布局；绘图缓冲按显卡实际尺寸上限缩放。新增 WebGL 丢失与绘制异常的可见提示和 Restore 3D View，不再仅留下黑屏。

尺寸变化、隐藏后重新进入、显卡尺寸上限、绘制失败重试、WebGL 上下文恢复已通过隔离渲染控制器测试。当前环境仍无法启动真实 Chrome，截图对应的控件属性冲突已按上述根因修复，并通过回归测试。

## 全系统统一 UI

入口、House / UMAP 两种主页、附近记忆卡片、房间编辑和记忆回应统一使用系统字体、石墨黑表面、柔白文字、柔和圆角、胶囊导航与一致焦点样式。入口保留原拼贴背景并改用磨砂卡片；首页低频操作收进“更多”菜单，可用 Escape 或点击外部关闭；创作区、AI 测试用户生成区与地图层级更明确。手机使用单列、地图在前的排列，小屏入口和导航也有独立适配。保持所有功能控件 ID 和 Firebase 数据模型。

统一样式位于 system-ui.css；system-ui.js 只负责更多菜单的关闭与键盘行为。已检查 HTML 结构、唯一 ID、控件引用，并重跑语义交互和 TransformControls 模式冲突回归检查。真实浏览器视觉验收仍受前述环境限制，需在本地 Five Server 查看最终效果。

## 房间侧栏 UI 更新

房间两侧使用系统字体、柔和圆角与更紧凑的控件布局：顶部导航胶囊、可展开房间尺寸卡、集成生成按钮的记忆输入框、图标分段编辑工具、回放与相机快捷按钮。右侧回应输入与物件预览采用同一视觉风格，推荐算法说明默认折叠。所有原有控件 ID、房间功能和数据保持不变；编辑选择和尺寸展开状态补充了辅助阅读属性。新增样式集中在 room-ui.css，避免干扰首页两种模式及 3D 画布。

## 附近记忆卡片

侧栏的附近人选改为黑白记忆卡：最多三张真实物件缩略图、两行记忆摘要、明确 synthetic 标签，以及一个以真实余弦相似度控制间距的双点连线。连线越短代表越相关，原始分数可通过卡片提示或辅助阅读读取；不将其显示为百分比。鼠标或键盘聚焦卡片，会同时点亮地图中对应的房间，点击仍进入原来的 3D 房间。没有物件图片或图片失效时显示抽象房门符号，不伪造记忆图像。

## 主页模式开关

右上角 **House / UMAP** 使用参考图中的蓝色圆角开关：

- 开启（蓝色，滑块在右）：本周 UMAP 语义星图。
- 关闭（灰色，滑块在左）：上周原有的 Three.js 公寓主页，包括房间尺寸、物件预览、悬停和点击进入。

模式自动记在当前浏览器。切换不会重建个人房间、修改数据库或清空记忆草稿；两边都进入同一间原有 3D 房间。House 模式隐藏创作侧栏、显示完整宽度的公寓首页；只渲染可见的首页。若直接使用 House，不会主动启动语义模型下载。

## 本周实现

- 语义首页：黑白、发光房间符号、虚线测试用户、自己为白色圆环；不使用时间轴或固定公寓排序。空房间列在 Unplaced rooms，不捏造语义位置。
- **Embedding**：固定版本 Transformers.js 2.17.2，`Xenova/paraphrase-multilingual-MiniLM-L12-v2`，量化 ONNX，384 维，mean pooling + L2 normalization。支持中文、英文及跨语言相似度。
- 每个用户的 `memoryText` 和每个物件的 `prompt` 都会单独计算 embedding。长文本拆成最多 100 字符的块，降低模型截断风险。写了新记忆时，其分块向量的归一化平均值决定位置；没有新记忆时，使用存档物件的向量平均值。
- 推理放在 module Web Worker，WASM CPU 单线程，不依赖 WebGPU 或跨源隔离。每段文本的 embedding 在浏览器 IndexedDB 缓存；不能写缓存时仍可在内存运行。下载模型不会把记忆发给模型推理服务；记忆仍按功能要求存到 Firebase。
- **UMAP**：随项目附带的 UMAP-js 1.4.0 浏览器 bundle；固定随机种子，二维输出。在线 ESM 重打包版本测试中出现依赖错误，故直接附带上游已打包版本，避免课堂演示时受第三方打包变化影响。
- 其他居民作为地图参照。自己修改文字时，参照地图保持稳定，通过 embedding 最近邻的核权重插值移动自己的点。这是有意选择的 out-of-sample 导航方式，**不是声称调用了 UMAP.transform**。其他居民内容或成员变化后才重新拟合参照地图。
- 少于 4 个参照居民时使用真实 embedding 的 PCA；UMAP 失败也明确显示 PCA，不假装成功运行 UMAP。语义模型失败时不使用随机向量、关键词哈希或伪造相似度，会提示重试；原房间仍能访问。
- 附近人选按原始 384 维向量的 **cosine similarity** 排序；分数不是百分比或正确率。二维视觉距离经过降维，不等于精确语义距离。
- **Navigation by Creation**：文字变化触发重新计算；旧的异步计算结果会被丢弃。不同身份的待保存文字始终保留原作者，避免写错房间。
- **God button**：使用生成式文本模型创建不同经历、主题交叉的测试用户。地图、附近列表、房间内均显示 synthetic / AI-generated test user；Firebase profile 保存 synthetic、source、model、generatedBy。其 3D 房间有一张清楚标注的记忆文字卡，卡片图像由代码排版，并非 AI 图像。
- 保留旧的 **Add Hand-authored Demos** 作为另一个明确命名的选项；它与 AI 生成按钮分开，旧 `profile.demo` 数据也会标注 synthetic。
- Next Room 保留 70/30：70% 优先采用 embedding 语义邻居，30% 随机探索；模型尚未就绪时保留旧的词语匹配。

## AI 模型配置与失败处理

图像模型仍是原来的 `google/nano-banana-2`，proxy 和可选 `authToken` 位置仍在 `main.js`。

God button 文本模型默认 `meta/meta-llama-3-70b-instruct`，可在 **config.js** 换成老师允许的文本模型。这个模型的公开存在不代表课程 proxy 一定允许使用；当前没有在你的账号上执行付费生成来确认 allowlist。如果被拒绝，页面会显示实际错误，不会偷偷用手写数据冒充 AI 生成成功。新模型应支持 `prompt`、`max_new_tokens`、`temperature` 输入，并返回字符串或字符串数组 `output`；若老师换了 API 格式，需要相应调整 `memory-space.js`。

God 请求 180 秒超时，失败不会提交生成数据。重复点击在一次请求完成前禁用。模型下载/embedding 失败可点击 Retry semantic model。首次下载大模型期间请保持页面打开。

## Firebase 与旧功能

继续使用 `memoryHouse/users/{userKey}`，没有迁移、重置或批量覆盖现有数据。

新增可选字段：

```text
memoryHouse/users/{userKey}/memoryText
memoryHouse/users/{generatedKey}/profile/{synthetic,source,model,generatedBy,createdAt,name}
```

生成用户使用 Firebase push ID，批次一次 update 提交；不会按 AI 取的名字覆盖真人房间。既有 `profile`、`assets`、`connections`、`dimensions` 格式保留。原项目仍用自愿填写的名字识别身份，并未新增登录鉴权或修改数据库规则。

保留：多用户房间、AI 生成物件、薄片轮廓厚度、移动/旋转/等比例缩放、物件删除与清空、This reminds me of…、回放、XYZ 房间尺寸、Next Room、旧 Skyler 房间导入、入口背景、Add Room、原有带确认的房间删除。

## 文件

- `index.html`：保留入口和原有房间界面，新增星图区域。
- `main.js`：原 Week 5 主程序；接入新的首页模块，保留 3D 与数据库逻辑。
- `memory-space.js` / `memory-space.css`：星图、自动保存、附近人选、God button。
- `embedding-worker.js`：本地推理、缓存、UMAP / PCA 调度。
- `semantic-math.js`：余弦排序、向量平均、PCA、导航插值、AI 输出校验。
- `config.js`：文本模型和测试用户数量。
- `room-rendering.js`：进入房间首帧、布局尺寸同步、WebGL 错误提示与恢复。
- `house-lobby.js`：复用原 Week 5 公寓首页的 Three.js 实现。
- `lobby-modes.js`：模式开关、显示状态、浏览器偏好保存。
- `vendor/`：固定版本 UMAP bundle、上游许可证及改动说明。
- `entrance-collage.png`：原项目入口素材，保持同目录。
- `tests/`：可选的开发检查，不参与页面运行。

## 验证情况

已执行：JavaScript 语法检查；数学与 AI 输出校验测试；真实 UMAP bundle 的 4 / 5 / 20 人、384 维输入测试及确定性检查；真实多语言模型生成 384 维向量，并验证了中文家乡记忆与英文家乡记忆的相似度（0.898）高于无关音乐描述（−0.064）。使用隔离 DOM 和明确的测试向量，测试了首次下载期间仍可访问房间、语义移动与排序、房间跳转回调、连续输入的旧结果丢弃、自动保存、切换身份、God 成功与拒绝、synthetic 标记、语义模型失败与重试。新增开关通过模式显示、标签同步、草稿保留、数据刷新、偏好记忆、渲染器复用及隐藏模式暂停渲染的隔离 DOM 测试。

自动化 Chrome 在当前执行环境启动失败，因此没有完成真实浏览器视觉验收。未向真实 Firebase 写入数据，也未发起真实 proxy 付费生成；这些服务的账号权限及最终视觉效果仍需本地验收。

可选开发测试（需要本机 Node；运行页面不需要）：

```sh
node tests/math.test.mjs
node tests/umap.test.mjs
# DOM 测试额外需要 linkedom；仅供开发，不是运行依赖。
npm install --no-save linkedom@0.18.12
node tests/dom.test.mjs
node tests/lobby-modes.test.mjs
node tests/transform-mode.test.mjs
```

本地验收顺序：用原名进入 → 看旧物件 → 写家乡记忆 → 改成城市夜晚记忆 → 确认自己移动且附近人改变 → 点击邻居进入原 3D 房间 → 点击一个物件并回应 → 回自己房间生成与编辑物件 → 调整房间尺寸并回放 → 返回地图 → God button → 检查测试用户标注 → 用另一浏览器窗口检查 Firebase 同步。

## 参考实现资料

- 多语言模型：https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2
- Transformers.js pipeline：https://huggingface.co/docs/transformers.js/v2.17.2/en/pipelines
- UMAP-js：https://github.com/PAIR-code/umap-js
- 上游浏览器 bundle：https://cdn.jsdelivr.net/npm/umap-js@1.4.0/lib/umap-js.min.js
- 文本模型：https://replicate.com/meta/meta-llama-3-70b-instruct
