// API调用封装类
class TuihuoluAPI {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
    }

    // 通用请求方法
    async request(endpoint, options = {}) {
        try {
            const fullUrl = `${this.baseURL}${endpoint}`;
            console.log('发起API请求:', fullUrl);
            
            const response = await fetch(fullUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            console.log('API响应状态:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API错误响应:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('API响应数据:', result);
            return result;
        } catch (error) {
            console.error(`API请求失败 ${endpoint}:`, error);
            throw error;
        }
    }

    // 获取实时数据
    async getRealTimeData() {
        return await this.request('/realtime');
    }

    // 获取最新的N条数据
    async getLatestData(limit = 10) {
        return await this.request(`/messages?limit=${limit}`);
    }

    // 按日期范围获取历史数据
    async getHistoryData(startDate, endDate, limit = 100) {
        const params = new URLSearchParams({
            startDate,
            endDate,
            limit: limit.toString()
        });
        return await this.request(`/messages/range?${params}`);
    }

    // 按日期范围获取历史数据（带偏移量）
    async getHistoryDataWithOffset(startDate, endDate, limit = 100, offset = 0) {
        const params = new URLSearchParams({
            startDate,
            endDate,
            limit: limit.toString(),
            offset: offset.toString()
        });
        return await this.request(`/messages/range?${params}`);
    }

    // 获取系统统计信息
    async getStats() {
        return await this.request('/stats');
    }

    // 数据导出
    async exportData(startDate, endDate, format = 'json') {
        const params = new URLSearchParams({
            startDate,
            endDate,
            format
        });
        
        if (format === 'csv') {
            const response = await fetch(`${this.baseURL}/export?${params}`);
            return await response.text();
        } else {
            return await this.request(`/export?${params}`);
        }
    }
}

// Server-Sent Events 封装
class TuihuoluSSE {
    constructor(url = '/api/stream') {
        this.url = url;
        this.eventSource = null;
        this.listeners = new Map();
    }

    // 连接SSE
    connect() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource(this.url);
        
        this.eventSource.onopen = () => {
            console.log('SSE连接已建立');
            this.emit('connected');
        };

        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit('data', data);
            } catch (error) {
                console.error('SSE数据解析失败:', error);
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('SSE连接错误:', error);
            this.emit('error', error);
        };

        return this;
    }

    // 断开连接
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    // 添加事件监听器
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return this;
    }

    // 移除事件监听器
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
        return this;
    }

    // 触发事件
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件处理器错误 ${event}:`, error);
                }
            });
        }
    }
}

// 轮询更新类
class TuihuoluPoller {
    constructor(api, interval = 5000) {
        this.api = api;
        this.interval = interval;
        this.timer = null;
        this.listeners = new Map();
        this.isRunning = false;
    }

    // 开始轮询
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.poll(); // 立即执行一次
        
        this.timer = setInterval(() => {
            this.poll();
        }, this.interval);
        
        console.log(`开始轮询，间隔: ${this.interval}ms`);
        return this;
    }

    // 停止轮询
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('轮询已停止');
        return this;
    }

    // 执行轮询
    async poll() {
        try {
            const data = await this.api.getLatestData(1);
            if (data && data.length > 0) {
                this.emit('data', data[0]);
            }
        } catch (error) {
            this.emit('error', error);
        }
    }

    // 添加事件监听器
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return this;
    }

    // 触发事件
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`轮询事件处理器错误 ${event}:`, error);
                }
            });
        }
    }
}

// 导出全局实例
window.TuihuoluAPI = TuihuoluAPI;
window.TuihuoluSSE = TuihuoluSSE;
window.TuihuoluPoller = TuihuoluPoller;
