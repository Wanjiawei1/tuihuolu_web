// 退火炉监控系统 - API服务器（数据库版本）
require('dotenv').config();
const express = require('express');
const http = require('http');
const mqtt = require('mqtt');
const crypto = require('crypto');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const server = http.createServer(app);

// 数据库连接池
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 测试数据库连接
dbPool.getConnection()
    .then(conn => {
        console.log('✅ 数据库连接成功');
        conn.release();
    })
    .catch(err => {
        console.error('❌ 数据库连接失败:', err.message);
    });

// 中间件配置
app.use(cors()); // 启用CORS支持静态页面跨域访问
app.use(express.json());
app.use(express.static('static-demo')); // 托管静态文件

// SSE客户端列表
let sseClients = [];

// API路由

// 获取实时数据（最新一条）
app.get('/api/realtime', async (req, res) => {
    try {
        const [rows] = await dbPool.execute(
            'SELECT * FROM `messages` ORDER BY `timestamp` DESC LIMIT 1'
        );
        const latest = rows[0] || null;
        res.json({
            success: true,
            data: latest,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('获取实时数据失败:', error);
        res.status(500).json({ success: false, error: '查询失败' });
    }
});

// 获取最新的N条消息
app.get('/api/messages', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const limitNum = parseInt(limit, 10);
        const [rows] = await dbPool.execute(
            'SELECT * FROM `messages` ORDER BY `timestamp` DESC LIMIT ?',
            [limitNum]
        );
        res.json(rows);
    } catch (error) {
        console.error('获取最新消息失败:', error);
        res.status(500).json({ success: false, error: '查询失败' });
    }
});

// 按日期范围获取历史消息
app.get('/api/messages/range', async (req, res) => {
    const { startDate, endDate, limit = 100, offset = 0 } = req.query;
    
    if (!startDate || !endDate) {
        return res.status(400).json({ 
            success: false, 
            error: '请提供开始和结束日期' 
        });
    }
    
    try {
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0); // 设置为当天开始
        const start = startDateTime.getTime();
        
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999); // 设置为当天结束
        const end = endDateTime.getTime();
        
        const limitNum = parseInt(limit, 10);
        const offsetNum = parseInt(offset, 10);
        
        console.log(`日期范围查询: ${startDate} (${start}) 到 ${endDate} (${end}), limit: ${limitNum}, offset: ${offsetNum}`);
        
        const [rows] = await dbPool.execute(
            'SELECT * FROM `messages` WHERE `timestamp` BETWEEN ? AND ? ORDER BY `timestamp` DESC LIMIT ? OFFSET ?',
            [start, end, limitNum, offsetNum]
        );
        
        console.log(`查询结果: 返回 ${rows.length} 条数据`);
        
        // 调试信息: 显示前几条数据的日期
        if (rows.length > 0) {
            const firstRecord = new Date(rows[0].timestamp);
            const lastRecord = new Date(rows[rows.length - 1].timestamp);
            console.log(`数据日期范围: ${firstRecord.toISOString()} 到 ${lastRecord.toISOString()}`);
        }
        
        res.json(rows);
    } catch (error) {
        console.error('日期范围查询错误:', error);
        res.status(500).json({ 
            success: false, 
            error: '查询失败' 
        });
    }
});

// 获取系统统计信息
app.get('/api/stats', async (req, res) => {
    try {
        const [countRows] = await dbPool.execute('SELECT COUNT(*) as total FROM `messages`');
        const [latestRows] = await dbPool.execute(
            'SELECT * FROM `messages` ORDER BY `timestamp` DESC LIMIT 1'
        );
        
        const latest = latestRows[0];
        let avgTemp = 0;
        
        if (latest && latest.payload) {
            let data = latest.payload;
            if (typeof data === 'string') data = JSON.parse(data);
            if (data.data) data = data.data;
            
            const temps = [data['1wd'], data['2wd'], data['3wd'], data['4wd']]
                .filter(t => t != null);
            avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b) / temps.length : 0;
        }
        
        res.json({
            success: true,
            stats: {
                totalRecords: countRows[0].total,
                lastUpdate: latest?.timestamp,
                avgTemperature: Math.round(avgTemp),
                systemStatus: 'online',
                uptime: process.uptime()
            }
        });
    } catch (error) {
        console.error('获取统计信息失败:', error);
        res.status(500).json({ success: false, error: '查询失败' });
    }
});

// 数据导出
app.get('/api/export', async (req, res) => {
    const { startDate, endDate, format = 'json' } = req.query;
    
    try {
        let data;
        if (startDate && endDate) {
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).setHours(23, 59, 59, 999);
            
            const [rows] = await dbPool.execute(
                'SELECT * FROM `messages` WHERE `timestamp` BETWEEN ? AND ? ORDER BY `timestamp` DESC',
                [start, end]
            );
            data = rows;
        } else {
            const [rows] = await dbPool.execute(
                'SELECT * FROM `messages` ORDER BY `timestamp` DESC'
            );
            data = rows;
        }
        
        if (format === 'csv') {
            const csv = convertToCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="tuihuolu-data.csv"');
            res.send(csv);
        } else {
            res.json(data);
        }
    } catch (error) {
        console.error('数据导出失败:', error);
        res.status(500).json({ success: false, error: '导出失败' });
    }
});

// Server-Sent Events 端点
app.get('/api/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const clientId = Date.now();
    const client = { id: clientId, response: res };
    sseClients.push(client);
    
    console.log(`🔗 SSE客户端连接: ${clientId}, 当前连接数: ${sseClients.length}`);

    // 发送连接确认
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    // 客户端断开连接时清理
    req.on('close', () => {
        sseClients = sseClients.filter(c => c.id !== clientId);
        console.log(`🔌 SSE客户端断开: ${clientId}, 当前连接数: ${sseClients.length}`);
    });
});

// 转换为CSV格式
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = ['时间戳', '时间', '1区温度', '2区温度', '3区温度', '4区温度', 
                    '1区功率', '2区功率', '3区功率', '4区功率', '工艺温度', 
                    '工件1编号', '工件2编号', '工件3编号'];
    
    const rows = data.map(record => {
        let payload = record.payload;
        if (typeof payload === 'string') payload = JSON.parse(payload);
        if (payload.data) payload = payload.data;
        
        const formatTime = (ts) => new Date(ts).toLocaleString('zh-CN');
        
        return [
            record.timestamp,
            formatTime(record.timestamp),
            payload['1wd'] || '',
            payload['2wd'] || '',
            payload['3wd'] || '',
            payload['4wd'] || '',
            payload['1gl'] || '',
            payload['2gl'] || '',
            payload['3gl'] || '',
            payload['4gl'] || '',
            payload['0wd'] || '',
            payload['1bh'] || '',
            payload['2bh'] || '',
            payload['3bh'] || ''
        ].join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
}

// 向所有SSE客户端推送数据
function broadcastToSSE(data) {
    if (sseClients.length === 0) return;
    
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseClients = sseClients.filter(client => {
        try {
            client.response.write(message);
            return true;
        } catch (error) {
            console.log(`🔌 SSE客户端连接已断开: ${client.id}`);
            return false;
        }
    });
}

// MQTT配置
const MQTT_BROKER_URL = 'mqtt://Mqtt.dxiot.liju.cc';
const MQTT_CLIENT_ID = 'api_server_' + Math.random().toString(16).slice(2, 10);
const SUB_TOPICS = [
    '/dxiot/4q/get/danzhan/tuihuolu',
    '/dxiot/4q/pub/danzhan/tuihuolu'
];

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

// 数据去重相关变量
let lastDataHash = '';
let duplicateCount = 0;

// 计算数据哈希值用于去重
function calculateDataHash(data) {
    const dataStr = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('md5').update(dataStr).digest('hex');
}

mqttClient.on('message', async (topic, message) => {
    const str = message.toString();
    let payload;
    try {
        payload = JSON.parse(str);
    } catch (e) {
        payload = str;
    }
    
    // 如果有嵌套的data字段，提取出来
    const sendPayload = payload && payload.data ? payload.data : payload;
    
    // 计算数据哈希值进行去重检查
    const currentHash = calculateDataHash(sendPayload);
    
    // 如果数据与上一条相同，跳过处理
    if (currentHash === lastDataHash) {
        duplicateCount++;
        console.log(`🔄 检测到重复数据，已跳过 (连续重复: ${duplicateCount} 次)`);
        return;
    }
    
    // 重置重复计数
    if (duplicateCount > 0) {
        console.log(`✅ 数据变化，重复数据已过滤 ${duplicateCount} 条`);
        duplicateCount = 0;
    }
    lastDataHash = currentHash;
    
    const record = { 
        timestamp: Date.now(), 
        topic, 
        payload: sendPayload 
    };
    
    // 保存到数据库
    try {
        await dbPool.execute(
            'INSERT INTO `messages` (`timestamp`, `topic`, `payload`) VALUES (?, ?, ?)',
            [record.timestamp, record.topic, JSON.stringify(record.payload)]
        );
        console.log(`📨 收到消息并已存入数据库 [${topic}]:`, payload);
        
        // 推送给SSE客户端
        broadcastToSSE(record);
    } catch (error) {
        console.error('数据插入数据库失败:', error.message);
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('API错误:', err);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: '接口不存在'
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`🚀 API服务器已启动: http://localhost:${PORT}`);
    console.log(`📱 静态页面访问: http://localhost:${PORT}`);
    console.log(`🔌 SSE端点: http://localhost:${PORT}/api/stream`);
    
    // 显示数据库中的记录数
    try {
        const [rows] = await dbPool.execute('SELECT COUNT(*) as total FROM `messages`');
        console.log(`📁 数据库中共有 ${rows[0].total} 条历史数据`);
    } catch (error) {
        console.error('查询数据库记录数失败:', error.message);
    }
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n📴 正在关闭服务器...');
    mqttClient.end();
    await dbPool.end();
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});
