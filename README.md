# Timeline Editor — FFXIV AEAssist 时间轴编辑器

> ⚠️ **纯 Vibe Coding 产物**  
> 本项目由 AI（Claude/Reasonix）通过自然语言对话驱动生成，未经专业软件工程流程（需求评审、架构设计、代码审查、测试覆盖）。代码由 AI 一次性或迭代式输出，人工仅做功能验证。可能存在边界情况未处理、性能未优化、错误处理不完善等问题。使用前请自行评估风险。

---

## 这是什么？

一个 **可直接打开的静态 HTML 网页应用**，用于可视化编辑 FFXIV AEAssist 插件的**时间轴（Triggerline）文件**。项目仍保留历史 Electron 主进程代码作为参考，但默认构建和发布目标已经是纯浏览器页面。

时间轴文件是 AEAssist 的行为树配置，定义「在什么条件下执行什么动作」——例如「Boss 读条 X 技能时 → 使用减伤技能」。这些文件以 JSON 格式存放在 `Triggerlines/` 目录下，嵌套层级深、字段繁多。本编辑器提供图形化界面替代手写 JSON。

### 核心能力

- **树形可视化**：展开/折叠行为树节点（序列、并行、选择、循环、条件、动作等 10 种）
- **属性编辑**：选中节点后在右侧面板编辑所有属性（DisplayName、Delay、LoopCount 等）
- **条件/动作类型化编辑器**：18 种内置条件 + 11 种内置动作的专用编辑器，字段带语义识别（如比较符下拉、职能下拉）
- **C# 脚本编辑**：内嵌 Monaco Editor 编辑 TreeScriptNode 的 C# 脚本
- **浏览器文件读写**：通过浏览器文件选择打开 Triggerline，通过下载保存编辑结果
- **ACR 类型兼容**：内置条件/动作可直接编辑；历史 Electron 版 DLL 扫描代码保留但不参与网页构建
- **撤销/重做**：50 步快照回退
- **拖拽排序**：右键菜单添加/删除/复制节点，拖拽调整顺序

---

## 快速开始

### 环境要求

- 现代浏览器（Chrome / Edge / Firefox 等）
- [Node.js](https://nodejs.org/) 20+（仅开发或自行构建时需要）
- 已安装 FFXIV + AEAssist 插件（编辑真实文件时需要 `Triggerlines/`；浏览器版无法直接扫描本地 `ACR/` DLL）

### 启动开发模式

```bash
cd timeline-editor
npm install
npm run dev        # 启动 Vite 网页开发服务器
```

### 构建为可直接打开的 HTML

```bash
npm run build     # 输出到 timeline-editor/dist/
```

构建完成后，可以直接双击打开 `timeline-editor/dist/index.html`，或把整个 `dist/` 目录部署到任意静态托管服务。

---

## 部署到 GitHub Pages

本仓库已提供 GitHub Actions 工作流 `.github/workflows/deploy-pages.yml`，会在推送到 `main` 分支时自动构建 `timeline-editor/dist` 并发布到 GitHub Pages。

首次启用步骤：

1. 将代码推送到 GitHub 仓库的 `main` 分支。
2. 打开仓库页面：**Settings → Pages**。
3. 在 **Build and deployment** 中，将 **Source** 选择为 **GitHub Actions**。
4. 打开 **Actions** 标签页，等待 `Deploy static site to GitHub Pages` 工作流完成。
5. 部署完成后，访问 `https://<你的用户名>.github.io/<仓库名>/`。

如果仓库名就是 `TimelineEditor`，通常地址类似：

```text
https://<你的用户名>.github.io/TimelineEditor/
```

由于 Vite 已配置 `base: './'`，构建产物使用相对资源路径，既支持 GitHub Pages 子路径，也支持直接打开 `dist/index.html`。

---

## 使用指南

### 1. 配置 AE 目录

浏览器版不能像 Electron 一样直接读取本机目录。请点击工具栏 **📂 Open** 按钮，手动选择要编辑的 Triggerline JSON/TXT 文件。历史 Electron 版的 AE 目录设置如下，仅对桌面版逻辑有意义：

```
%APPDATA%/XIVLauncherCN/offlineplugins/AE
```

### 2. 打开并编辑时间轴

- 点击工具栏 **📂 Open** 选择单个 `.json` / `.txt` 时间轴文件
- 文件加载后，中间区域显示**行为树**
- 选中节点 → 右侧**属性面板**编辑
- 右键节点 → 添加/删除/复制子节点
- 工具栏 **`</> Script`** 切换 Monaco C# 脚本编辑器
- 点击 **💾 Save** / **📄 Save As** 会下载编辑后的 JSON 文件

### 3. 使用 ACR 自定义类型

浏览器版无法直接读取本地 DLL，因此不会自动扫描第三方 ACR 插件（如 UMP、Aki、azz 等）。内置条件/动作仍可编辑；如果需要 DLL 元数据扫描，请参考历史 Electron 主进程实现自行运行桌面版。

### 4. 查看 ACR 类型（调试）

点击工具栏 **🔍 ACR** 按钮，右侧面板切换为 **ACR 类型查看器**。浏览器版无法扫描 DLL，因此这里主要用于查看当前可用/已加载的类型信息：

- **条件 / 动作** 两个 tab 分别展示
- 按 DLL（如 `azz`、`Aki`、`UMP`）分组
- 点击类型展开查看：
  - 完整 `$type` 名
  - 实现的接口
  - 基类
  - 所有字段的类型、引用类型名
  - **枚举字段的完整成员列表**（名称 + 数值）
- 搜索框可按类型名/字段名/接口名过滤

再次点击 **🔍 ACR** 切回属性编辑面板。

---

## 数据模型

### 10 种行为树节点

| 节点类型 | 类别 | 关键字段 |
|---------|------|---------|
| `TreeSequence` | 组合（顺序执行） | `IgnoreNodeResult`, `StopWhenDead`, `Childs` |
| `TreeParallel` | 组合（并行执行） | `AnyReturn`, `StopWhenDead`, `Childs` |
| `TreeSelect` | 组合（选择执行） | `Childs` |
| `TreeLoop` | 组合（循环执行） | `LoopCount`, `Childs` |
| `TreeCondNode` | 叶子（条件判断） | `CondLogicType`(0=AND/1=OR), `TriggerConds[]` |
| `TreeActionNode` | 叶子（执行动作） | `TriggerActions[]` |
| `TreeScriptNode` | 叶子（C# 脚本） | `Script`, `OnlyCheck` |
| `TreeDelayNode` | 叶子（延迟） | `Delay`(秒) |
| `TreeDebugNode` | 叶子（调试占位） | — |
| `TreeClearWaitNode` | 叶子（清除等待） | — |

### 内置条件/动作

- **条件 18 种**：敌人读条、技能 CD、变量比较、战斗计时、天气变化、Buff 检测、职能判断等
- **动作 11 种**：强制施法、技能队列、切换目标、吃药、发送指令、TP 控制、变量设置等

### ACR 类型两阶段发现

1. **时间轴扫描**：遍历 `Triggerlines/` 下所有 JSON，提取非 `AEAssist.` 前缀的 `$type`，收集字段和 QT key 样本
2. **DLL 元数据解析**：纯 TypeScript 解析 .NET PE/CLI 二进制格式（无需外部工具），读取 TypeDef/Field/Property/InterfaceImpl/Constant 表，提取字段签名、接口实现、枚举成员

两个阶段结果合并，DLL 补充类型完整性，时间轴提供真实使用样本。

---

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | React 19, TypeScript 5.7（静态浏览器应用） |
| 构建 | Vite 6 |
| 状态管理 | Zustand 5 + Immer 10（50 步 undo/redo） |
| 代码编辑 | Monaco Editor 0.55（C#） |
| 样式 | TailwindCSS 4（暗色主题） |
| 浏览器文件 I/O | `<input type=file>` 打开文件，Blob 下载保存文件 |
| 历史桌面能力 | Electron IPC 与 .NET DLL 解析代码仍保留在 `src/main/`，但不参与默认静态构建 |

---

## 项目结构

```
timeline-editor/
├── src/
│   ├── main/
│   │   ├── index.ts              # Electron 主进程（窗口/IPC/AE目录）
│   │   └── dotnetMeta.ts         # 历史 Electron 版 .NET PE/CLI 元数据解析器
│   ├── preload/
│   │   └── preload.ts            # contextBridge API
│   ├── shared/
│   │   └── types.ts              # 数据类型 & ACR TypeDef
│   └── renderer/
│       ├── App.tsx               # 主布局
│       ├── browserApi.ts         # 浏览器版 ElectronAPI shim
│       ├── store/index.ts        # Zustand store
│       ├── components/
│       │   ├── Toolbar.tsx       # 工具栏
│       │   ├── Sidebar.tsx       # 文件浏览器
│       │   ├── TreeView.tsx      # 行为树视图
│       │   ├── StatusBar.tsx     # 状态栏
│       │   └── ContextMenu.tsx   # 右键菜单
│       └── panels/
│           ├── PropertyPanel.tsx       # 属性编辑
│           ├── ConditionEditor.tsx     # 条件子编辑器
│           ├── ActionEditor.tsx        # 动作子编辑器
│           ├── ScriptPanel.tsx         # Monaco C# 编辑器
│           ├── AcrViewerPanel.tsx      # ACR 类型调试查看器
│           ├── semanticFields.ts       # 语义字段映射
│           ├── SpellConfigEditor.tsx   # 技能配置
│           └── TargetSelectorEditor.tsx # 目标选择器
├── index.html
├── package.json
└── vite.config.ts
```

---

## 开发命令

```bash
npm run dev       # 启动 Vite 开发服务器
npm run build     # 生产构建到 dist/，可直接打开 index.html
npm run lint      # TypeScript 类型检查
npm run preview   # 本地预览生产构建
```
