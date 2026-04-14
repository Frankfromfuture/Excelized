# 小紫框 (LPF · Little Purple Frame)

> 上传 Excel 文件，自动将紫色边框内的公式关系可视化为交互式节点图

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 功能特性 (v0.1)

- **紫色边框识别** — 自动识别 Excel 中中等/粗紫色边框圈定的区域
- **计算流程可视化** — 将加减乘除公式关系渲染为 ComfyUI 风格的节点连线图
- **颜色编码运算** — 加(绿) / 减(红) / 乘(蓝) / 除(橙)，一目了然
- **动画播放** — 按计算顺序逐步点亮节点，展示数据流向
- **交互画布** — 拖拽节点、缩放平移、小地图导航
- **无需网络** — 所有依赖打包离线可用，国内访问流畅

## 路线图

| 版本 | 目标 |
|------|------|
| ✅ v0.1 | 加减乘除基础运算可视化 |
| 🔲 v0.2 | IF / SUM / COUNT 等函数 |
| 🔲 v0.3 | 可视化编辑并导出为 Excel |
| 🔲 v0.4 | 复杂编辑功能 |
| 🔲 v0.5 | 直接用卡片创建 Excel 表格 |

## 使用方法

### 准备 Excel 文件

1. 打开 Excel，选中包含公式的单元格区域（含输入值和计算结果）
2. 右键 → 设置单元格格式 → 边框
3. 颜色选 **紫色**（色相约 260°–320°），线型选 **中等** 或 **粗**
4. 为区域的四条边设置该边框并保存为 `.xlsx`

### 示例

```
用紫色粗边框圈住下面三个单元格：
  A1 = 100    B1 = 200    C1 = =A1+B1
```

上传后将看到：**A1** → **(+)** ← **B1** → **C1 = 300**

### 本地运行

```bash
git clone https://github.com/your-org/LPF.git
cd LPF
npm install
npm run dev
```

打开 `http://localhost:5173`

## 技术栈

- **Vite 5** + **React 18** + **TypeScript**
- **SheetJS (xlsx)** — Excel 解析与样式读取
- **@xyflow/react** — 节点图渲染 (React Flow v12)
- **@dagrejs/dagre** — 有向图自动布局
- **Zustand** — 轻量状态管理
- **Tailwind CSS v3** — 样式

## License

[MIT](LICENSE) © 2025 LPF Contributors
