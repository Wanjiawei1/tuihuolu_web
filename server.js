const express = require('express');
const http = require('http');
const path = require('path');
const mqtt = require('mqtt');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静态文件服务，默认指向 public 目录
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data.json');

// 加载历史数据
let messages = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    messages = JSON.parse(raw);
  } catch (e) {
    console.error('读取历史数据失败:', e.message);
  }
}

// 保存数据到文件（简单同步写法，数据量不大时可用）
function saveMessages() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
  } catch (e) {
    console.error('写入数据文件失败:', e.message);
  }
}

// API: 获取历史消息
app.get('/api/messages', (req, res) => {
  const { date, limit = 10 } = req.query;
  let list = messages;
  if (date) {
    list = list.filter(m => {
      const d = new Date(m.timestamp);
      const day = d.toISOString().split('T')[0];
      return day === date;
    });
  }
  list = [...list].sort((a,b)=>b.timestamp - a.timestamp).slice(0, Number(limit));
  res.json(list);
});

// MQTT 连接配置
const MQTT_BROKER_URL = 'mqtt://Mqtt.dxiot.liju.cc';
// 生成随机 clientId，避免与现场设备冲突
const MQTT_CLIENT_ID = 'viewer_' + Math.random().toString(16).slice(2, 10);
// 订阅主题：既监听 get 也监听 pub
const SUB_TOPICS = [
  '/dxiot/4q/get/danzhan/tuihuolu',
  '/dxiot/4q/pub/danzhan/tuihuolu',
];
const PUB_TOPIC = '/dxiot/4q/pub/danzhan/tuihuolu';

const mqttClient = mqtt.connect(MQTT_BROKER_URL, {
  clientId: MQTT_CLIENT_ID,
  clean: true,
  connectTimeout: 4000,
});

mqttClient.on('connect', () => {
  console.log('✅ 已连接至 MQTT 服务器，clientId:', MQTT_CLIENT_ID);
  mqttClient.subscribe(SUB_TOPICS, (err, granted) => {
    if (err) {
      return console.error('MQTT 订阅失败:', err.message);
    }
    console.log('📡 已订阅主题:', granted.map(g => g.topic).join(', '));
  });
});

mqttClient.on('error', (err) => {
  console.error('MQTT 连接错误:', err.message);
});

mqttClient.on('message', (topic, message) => {
  const str = message.toString();
  let payload;
  try {
    payload = JSON.parse(str);
  } catch (e) {
    payload = str;
  }
  // 如果带 data 嵌套，则直接取 data 内容给前端
  const sendPayload = payload && payload.data ? payload.data : payload;

  const record = { timestamp: Date.now(), topic, payload: sendPayload };
  messages.push(record);
  // 控制内存数据条数，最多保存 10000 条
  if (messages.length > 10000) messages.shift();
  saveMessages();

  console.log(`📨 收到消息 [${topic}]:`, payload);
  io.emit('mqtt_message', record);
});

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('🟢 Web 客户端已连接');

  // 如果前端需要向 MQTT 发布消息，可在此监听事件
  socket.on('publish', (msg) => {
    const { topic = PUB_TOPIC, payload } = msg || {};
    if (payload) {
      mqttClient.publish(topic, String(payload));
      console.log(`🚀 已发布至 ${topic}:`, payload);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Web 客户端已断开');
  });
});

// 启动 HTTP/Socket 服务
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP 服务已启动: http://localhost:${PORT}`);
});
