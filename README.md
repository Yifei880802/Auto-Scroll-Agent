# Auto Scroll Agent

[English](README_EN.md) | 中文

Chrome 自动滚动插件，让任何网页保持活跃状态。适用于在线培训、长时间阅读、数据大屏等需要模拟页面活动的场景。

## 功能特性

- **智能扫描** — 自动识别页面上所有可滚动容器（带原生滚动条的元素）
- **可视化标记** — 每个可滚动元素上方浮起红色边框 + 编号圆形徽章，不会被页面内容遮挡
- **全页面滚动** — 支持滚动整个页面（`window.scrollBy`），始终作为第一个选项可用
- **Popup 驱动** — 所有操作在弹出窗口内完成：扫描 → 选编号 → 开始滚动
- **状态恢复** — 随时关闭/重开 popup，停止按钮和计时器自动恢复
- **可配置** — 滚动速度、间隔、鼠标/键盘模拟、焦点劫持均可调节

## 安装方式

### 开发者模式加载

1. 克隆或下载本仓库
2. 在 Chrome 中打开 `chrome://extensions/`
3. 右上角开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择插件文件夹

### Chrome Web Store

*（即将上线）*

## 使用方法

1. 打开任意网页
2. 点击工具栏中的 **Auto Scroll Agent** 图标
3. 弹出窗口自动扫描页面
4. 你会看到可滚动目标列表：
   - **Full Page** — 滚动整个页面窗口（始终可用）
   - **编号元素** — 页面内带可见滚动条的容器
5. 点击你要滚动的目标
6. 按需调整设置（速度、间隔等）
7. 点击 **Start** — 选中目标开始自动滚动
8. 可以关闭弹窗；随时重开即可停止

### 设置项

| 设置 | 默认值 | 说明 |
|------|--------|------|
| Speed (px) | 30 | 每次滚动的像素数 |
| Interval (s) | 2 | 两次滚动之间的秒数 |
| Simulate mouse | 开启 | 定期在目标上触发 mousemove/click 事件 |
| Hijack focus | 开启 | 阻止页面检测到标签切换或窗口失焦 |

## 技术架构

```
manifest.json      — Manifest V3，权限：activeTab, storage, scripting
popup.html         — 弹出窗口 UI：步骤指示器、元素列表、控制按钮
popup.js           — Popup 逻辑：注入脚本、扫描、渲染列表、启停控制
content.js         — 页面端逻辑：DOM 扫描、固定浮层、自动滚动
icons/             — 插件图标（16/48/128px）
```

### 关键设计决策

- **无后台脚本** — 所有状态保存在 content.js + chrome.storage 中，支持 popup 关闭后恢复
- **固定浮层** — 红框和编号徽章使用 `position: fixed` + `z-index: 99999999` 渲染，完全脱离页面 DOM 和层叠上下文，不会被任何元素遮挡
- **动态注入** — content.js 按需通过 `chrome.scripting.executeScript` 注入，不在每个页面预加载
- **滚动条检测** — 仅识别 `overflow: auto/scroll` 且内容溢出 > 20px 的元素，最大限度减少误判

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 访问当前标签以注入滚动脚本 |
| `storage` | 跨 popup 开关持久化设置和运行状态 |
| `scripting` | 动态注入 content.js 到当前页面 |

不收集、不存储、不传输任何用户数据。一切操作均在本地运行。

## 浏览器兼容性

在 Chrome 120+ 上测试通过。应兼容所有支持 Manifest V3 的 Chromium 内核浏览器（Edge、Brave、Opera、Arc）。

## 许可证

MIT
