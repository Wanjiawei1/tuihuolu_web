# 退火炉智能监控系统

> 基于 Node.js + MQTT + WebSocket 的实时工业设备监控平台

## 📋 项目概述

退火炉智能监控系统是一套完整的工业物联网监控解决方案，实现了对退火炉设备的实时数据采集、可视化展示和历史数据分析。系统采用现代化的Web技术栈，提供直观的用户界面和强大的数据处理能力。

## 🏗️ 系统架构

```
┌─────────────────┐    MQTT     ┌──────────────────┐    WebSocket    ┌─────────────────┐
│   退火炉设备     │ ──────────► │   Node.js 服务器  │ ──────────────► │   Web 前端界面   │
│                │             │                  │                 │                │
│ • 温度传感器    │             │ • MQTT 客户端     │                 │ • 实时仪表板    │
│ • 功率监控      │             │ • HTTP API       │                 │ • 历史数据查询  │
│ • 工件编号      │             │ • 数据持久化     │                 │ • 图表可视化    │
└─────────────────┘             └──────────────────┘                 └─────────────────┘
```

## ⚡ 核心功能

### 🔥 实时监控

- **四区温度监控**：实时显示1-4区温度数据
- **功率监控**：各区域功率消耗实时跟踪
- **工艺参数**：工艺温度和工件编号监控
- **状态指示**：连接状态和数据更新状态

### 📊 数据可视化

- **动态图表**：基于 Chart.js 的温度趋势图
- **滑动控制**：8条数据窗口，支持历史数据浏览
- **实时卡片**：温度和功率的卡片式展示
- **响应式设计**：适配各种设备屏幕

### 🔍 历史数据分析

- **日期筛选**：按日期范围查询历史数据
- **分页显示**：支持10/20/50/100条数据分页
- **数据导出**：便于数据分析和报告生成
- **快速查询**：优化的查询算法，秒级响应

### 🎨 现代化界面

- **渐变主题**：紫蓝色渐变设计风格
- **毛玻璃效果**：现代化的视觉效果
- **动画交互**：流畅的用户交互体验
- **移动适配**：完美支持移动设备访问

## 🛠️ 技术栈

### 后端技术

- **Node.js**: 高性能JavaScript运行时
- **Express**: 轻量级Web框架
- **MQTT.js**: MQTT协议客户端
- **Socket.IO**: 实时双向通信
- **文件系统**: JSON格式数据持久化

### 前端技术

- **HTML5**: 现代化标记语言
- **CSS3**: 渐变、动画、响应式设计
- **JavaScript ES6+**: 现代JavaScript特性
- **Bootstrap 5**: 响应式UI框架
- **Chart.js**: 专业图表库
- **Socket.IO Client**: 实时通信客户端

## 🚀 快速开始

### 环境要求

- Node.js 14.0 或更高版本
- npm 6.0 或更高版本
- 支持现代浏览器（Chrome 70+, Firefox 65+, Safari 12+）

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/Wanjiawei1/tuihuolu_web.git
cd tuihuolu_web
```

2. **安装依赖**

```bash
npm install
```

3. **启动服务**

```bash
node server.js
```

4. **访问系统**
   打开浏览器访问: http://localhost:3000

### 配置说明

#### MQTT连接配置

```javascript
// server.js 中的配置
const MQTT_BROKER_URL = 'mqtt://Mqtt.dxiot.liju.cc';
const SUB_TOPICS = [
  '/dxiot/4q/get/danzhan/tuihuolu',
  '/dxiot/4q/pub/danzhan/tuihuolu'
];
```

#### 端口配置

```javascript
const PORT = process.env.PORT || 3000;
```

## 📊 数据格式

### MQTT消息格式

```json
{
  "device_id": "tuihuolu",
  "data": {
    "1wd": 350,      // 1区温度 (℃)
    "2wd": 345,      // 2区温度 (℃) 
    "3wd": 340,      // 3区温度 (℃)
    "4wd": 335,      // 4区温度 (℃)
    "1gl": 85,       // 1区功率 (%)
    "2gl": 82,       // 2区功率 (%)
    "3gl": 80,       // 3区功率 (%)
    "4gl": 78,       // 4区功率 (%)
    "0wd": 250,      // 工艺温度 (℃)
    "1bh": "256478", // 工件1编号
    "2bh": "256843", // 工件2编号
    "3bh": "552489"  // 工件3编号
  }
}
```

### 存储数据格式

```json
{
  "timestamp": 1756807742720,
  "topic": "/dxiot/4q/pub/danzhan/tuihuolu",
  "payload": { /* MQTT消息数据 */ }
}
```

## 🔌 API 接口

### 获取历史消息

```http
GET /api/messages?date=2025-09-02&limit=100
```

### 按日期范围查询

```http
GET /api/messages/range?startDate=2025-09-01&endDate=2025-09-02&limit=50
```

**响应格式:**

```json
[
  {
    "timestamp": 1756807742720,
    "topic": "/dxiot/4q/pub/danzhan/tuihuolu", 
    "payload": {
      "1wd": 350,
      "2wd": 345,
      // ... 其他数据
    }
  }
]
```

## 📱 功能使用指南

### 实时监控

1. 系统启动后自动连接MQTT服务器
2. 实时显示温度和功率数据卡片
3. 图表自动更新，显示最近8条数据趋势
4. 绿色脉冲指示器显示系统运行状态

### 历史数据查询

1. 在"历史数据查询"区域选择日期范围
2. 选择显示条数（10/20/50/100）
3. 点击"查询数据"按钮
4. 结果显示在下方表格中，支持分页浏览

### 图表操作

1. 拖动滑动条浏览历史温度趋势
2. 点击"回到最新"快速跳转到最新数据
3. 鼠标悬浮查看具体数值
4. 图例点击可隐藏/显示对应数据线

## 🔧 部署指南

### 生产环境部署

1. **使用PM2管理进程**

```bash
npm install -g pm2
pm2 start server.js --name "tuihuolu-monitor"
pm2 startup
pm2 save
```

2. **Nginx反向代理配置**

```nginx
server {
    listen 80;
    server_name your-domain.com;
  
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. **Docker部署**

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### 环境变量配置

```bash
# .env 文件
PORT=3000
MQTT_BROKER_URL=mqtt://your-mqtt-broker.com
NODE_ENV=production
```

## 🔒 安全考虑

- MQTT连接使用唯一客户端ID，避免冲突
- 数据存储限制最大条数，防止内存溢出
- API接口包含参数验证和错误处理
- 前端数据校验和XSS防护

## 📈 性能优化

- 图表数据分离显示，减少渲染压力
- MQTT消息批量处理，降低系统负载
- 前端数据缓存，减少重复请求
- 响应式设计，优化移动端性能

## 🐛 故障排除

### 常见问题

**1. MQTT连接失败**

- 检查网络连接和防火墙设置
- 确认MQTT服务器地址和端口
- 查看服务器日志中的连接错误信息

**2. 数据不更新**

- 检查MQTT主题订阅是否成功
- 确认设备是否正常发送数据
- 查看浏览器控制台的WebSocket连接状态

**3. 历史数据查询失败**

- 确认日期格式正确（YYYY-MM-DD）
- 检查服务器API路由是否正常
- 查看数据文件是否存在且格式正确

### 日志分析

服务器启动后会输出详细日志：

```
HTTP 服务已启动: http://localhost:3000
✅ 已连接至 MQTT 服务器，clientId: viewer_xxxxx
📡 已订阅主题: /dxiot/4q/get/danzhan/tuihuolu, /dxiot/4q/pub/danzhan/tuihuolu
🟢 Web 客户端已连接
📨 收到消息 [topic]: { data }
```

## 📞 技术支持

- **项目仓库**: https://github.com/Wanjiawei1/tuihuolu_web
- **问题反馈**: 提交 GitHub Issues
- **技术文档**: 查看项目 Wiki 页面

## 📝 更新日志

### v1.2.0 (2025-09-02)

- ✨ 新增图表滑动条控制功能
- ✨ 新增日期筛选和分页查询
- 🎨 界面视觉全面升级
- 🔧 API接口优化和错误处理改进
- 📱 移动端适配优化

### v1.1.0 (2025-08-15)

- ✨ 基础实时监控功能
- 📊 Chart.js图表集成
- 💾 数据持久化存储
- 🔌 MQTT和WebSocket通信

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

**开发团队**: 工业物联网开发组
**最后更新**: 2025年9月2日
**版本**: v1.2.0

