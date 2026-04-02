# Git Repo Monitor 推送元数据功能实现计划

## 项目概述
为 git-repo-monitor 插件添加推送元数据功能，在定时推送时显示 pull/push cron 配置和当前时间信息。

## 功能需求

### 核心功能
1. **开头元数据模板**：可配置的推送信息模板
2. **结尾硬编码信息**：固定的版本和时间信息
3. **全推送模式支持**：text、puppeteer图片、typst图片、合并转发

### 具体需求
- 新增配置项 `pushMetadataTemplate`
- 支持变量替换：`${pull_cron}`、`${push_cron}`、`${timestamp}`
- 在消息开头显示可配置的元数据
- 在消息结尾显示固定的版本信息

## 技术实现方案

### 1. 配置项设计

**文件**: `src/config.ts`

```typescript
pushMetadataTemplate: Schema.string()
  .role('textarea', { rows: [4, 8] })
  .default(`【git-repo-monitor 定时推送】\npull cron: \${pull_cron}\npush cron: \${push_cron}\n当前时间： \${timestamp}`)
  .description('推送消息开头的元数据模板，支持 \${pull_cron}、\${push_cron}、\${timestamp} 变量')
```

### 2. 模板变量替换机制

**文件**: `src/utils/template.ts` (新建)

```typescript
/**
 * 替换推送元数据模板中的变量
 */
export function replacePushMetadataPlaceholders(
  template: string, 
  replacements: Record<string, string>
): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
    return replacements[key] || match;
  });
}
```

### 3. 硬编码结尾信息

**常量定义**:
```typescript
const HARDCODED_FOOTER = `---\n推送信息：git-repo-monitor v${VERSION} | ${currentTime}`;
```

### 4. 各推送模式适配方案

#### 4.1 Text 模式
**文件**: `src/scheduler/pusher.ts`

```typescript
// 在 sendMessage 方法中
const metadata = generatePushMetadata(this.config, group, currentTime);
const finalContent = metadata + '\n\n' + content + '\n\n' + HARDCODED_FOOTER;
```

#### 4.2 Puppeteer 图片模式
**文件**: `src/services/render-puppeteer.ts`

```typescript
// 在 HTML 模板开头添加元数据
const htmlWithMetadata = `
  <div class="metadata">${metadata}</div>
  ${originalHtml}
  <div class="footer">${HARDCODED_FOOTER}</div>
`;
```

#### 4.3 Typst 图片模式
**文件**: `src/services/renderer-typst.ts`

```typescript
// 在 Typst 代码开头添加元数据
const typstCodeWithMetadata = `
  #text(size: 8pt, fill: gray)[${metadata}]\n
  ${originalTypstCode}

  #text(size: 6pt, fill: lightgray)[${HARDCODED_FOOTER}]
`;
```

#### 4.4 合并转发模式
**文件**: `src/scheduler/pusher.ts`

```typescript
// 作为第一条消息发送元数据
const messages = [
  metadata + '\n\n' + HARDCODED_FOOTER,
  ...originalMessages
];
```

## 文件修改清单

### 新增文件
- `src/utils/template.ts` - 模板替换工具函数

### 修改文件
1. `src/config.ts` - 添加配置项
2. `src/scheduler/pusher.ts` - 核心推送逻辑
3. `src/services/renderer-typst.ts` - Typst 渲染器适配
4. `src/services/render-puppeteer.ts` - Puppeteer 渲染器适配
5. `package.json` - 版本号更新

## 实现步骤

### 第一阶段：基础框架
1. 创建模板替换工具函数
2. 添加配置项到 config.ts
3. 实现文本模式的元数据添加

### 第二阶段：图片模式适配
1. 适配 Puppeteer 图片模式
2. 适配 Typst 图片模式
3. 测试各图片模式的显示效果

### 第三阶段：合并转发模式
1. 适配合并转发模式
2. 测试多消息场景

### 第四阶段：测试优化
1. 全面测试各推送模式
2. 优化显示效果
3. 更新版本号和文档

## 技术细节

### 变量替换机制
参考 B站插件的实现：
```typescript
// 参考：/home/bawuyinguo/SSoftwareFiles/koishi/AAA_from_git_AAA/koishi-shangxue-apps/plugins/bilibili-videolink-analysis/src/index.ts
```

### 时间格式
使用标准时间格式：`YYYY-MM-DD HH:mm:ss`

### 版本信息
从 package.json 读取版本号

## 预期效果

### 文本模式示例
```
【git-repo-monitor 定时推送】
pull cron: */5 * * * *
push cron: */10 * * * *
当前时间： 2024-04-02 15:30:00

[实际的推送内容...]

---
推送信息：git-repo-monitor v0.2.1-beta.3 | 2024-04-02 15:30:00
```

### 图片模式示例
在图片顶部显示元数据，底部显示版本信息

## 风险评估

### 低风险
- 模板替换功能成熟稳定
- 各推送模式已有成熟实现

### 中风险
- 图片模式布局可能需要调整
- 合并转发模式的消息顺序需要测试

## 后续优化

1. **模板变量扩展**：支持更多变量（如仓库数量、更新数量等）
2. **样式自定义**：支持元数据样式配置
3. **国际化支持**：多语言模板

## 时间预估

- **第一阶段**：1-2小时
- **第二阶段**：2-3小时  
- **第三阶段**：1小时
- **第四阶段**：1小时

**总计**：5-7小时

---

*计划制定时间：2024-04-02*