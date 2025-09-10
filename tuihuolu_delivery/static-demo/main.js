// 退火炉监控系统 - 静态版主程序
class TuihuoluMonitor {
    constructor() {
        this.api = new TuihuoluAPI();
        this.poller = new TuihuoluPoller(this.api, 5000); // 5秒轮询
        this.chart = null;
        
        // 最近三天的温度趋势数据
        this.chartData = {
            labels: [],
            datasets: [1,2,3,4].map((i,idx) => ({
                label: `${i}区温度`,
                data: [],
                borderColor: ['#0d6efd','#20c997','#ffc107','#dc3545'][idx],
                backgroundColor: ['#0d6efd','#20c997','#ffc107','#dc3545'][idx] + '33',
                borderWidth: 2,
                tension: 0.25,
                pointRadius: 2,
                pointHoverRadius: 4
            }))
        };
        
        // 历史数据查询相关变量
        this.currentQueryResults = [];
        this.currentQueryParams = null;
        this.currentQueryOffset = 0;
        this.isLoadingMore = false;
        
        this.init();
    }

    // 初始化
    init() {
        this.initDOM();
        this.initChart();
        this.bindEvents();
        this.startRealTimeUpdates();
        this.updateClock();
        this.loadInitialData();
    }

    // 初始化DOM元素
    initDOM() {
        this.elements = {
            tempCards: document.getElementById('tempCards'),
            powerCards: document.getElementById('powerCards'),
            currentTime: document.getElementById('currentTime'),
            statusIndicator: document.getElementById('statusIndicator'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            dataLimit: document.getElementById('dataLimit'),
            queryBtn: document.getElementById('queryBtn'),
            resultsCard: document.getElementById('resultsCard'),
            resultsBody: document.getElementById('resultsBody'),
            resultCount: document.getElementById('resultCount'),
            loadMoreBtn: document.getElementById('loadMoreBtn'),
            clearResultsBtn: document.getElementById('clearResultsBtn'),
            loadingIndicator: document.getElementById('loadingIndicator')
        };

        // 创建温度和功率卡片
        this.createCards();
        
        // 设置默认日期
        const today = new Date().toISOString().split('T')[0];
        this.elements.startDate.value = today;
        this.elements.endDate.value = today;
    }

    // 创建卡片
    createCards() {
        // 温度卡片
        for (let i = 1; i <= 4; i++) {
            const card = this.createCard('temp', i, '℃');
            this.elements.tempCards.appendChild(card);
        }
        
        // 功率卡片
        for (let i = 1; i <= 4; i++) {
            const card = this.createCard('power', i, '%');
            this.elements.powerCards.appendChild(card);
        }
    }

    // 创建单个卡片
    createCard(type, index, unit) {
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
            <div class="card ${type === 'temp' ? 'card-temp' : 'card-power'} h-100">
                <div class="card-body text-center">
                    <h6 class="card-title mb-1">${index}${type === 'temp' ? '区温度' : '区功率'}</h6>
                    <div class="display-6 fw-bold" id="${type}-${index}">--</div>
                    <small class="text-muted">${unit}</small>
                </div>
            </div>
        `;
        return col;
    }

    // 初始化图表
    initChart() {
        const ctx = document.getElementById('tempChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: this.chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 }, // 禁用动画提升性能
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        titleCallback: function(context) {
                            return '时间: ' + context[0].label;
                        },
                        labelCallback: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + '°C';
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        beginAtZero: true,
                        suggestedMax: 450,
                        ticks: { stepSize: 50 }
                    }
                }
            }
        });
    }

    // 绑定事件
    bindEvents() {
        // 查询按钮
        this.elements.queryBtn.addEventListener('click', () => {
            this.performQuery();
        });

        // 刷新图表按钮
        const refreshChartBtn = document.getElementById('refreshChartBtn');
        if (refreshChartBtn) {
            refreshChartBtn.addEventListener('click', () => {
                this.loadThreeDaysTrend();
            });
        }

        // 加载更多按钮
        this.elements.loadMoreBtn.addEventListener('click', () => {
            this.loadMoreData();
        });

        // 清空结果按钮
        this.elements.clearResultsBtn.addEventListener('click', () => {
            this.clearQueryResults();
        });


        // 轮询事件
        this.poller.on('data', (data) => {
            this.updateRealTimeData(data);
        });

        this.poller.on('error', (error) => {
            console.error('实时数据获取失败:', error);
            this.setStatus('error');
        });
    }

    // 开始实时更新
    startRealTimeUpdates() {
        this.poller.start();
        this.setStatus('connected');
    }

    // 更新实时数据
    updateRealTimeData(record) {
        try {
            let data = {};
            if (typeof record.payload === 'string') {
                data = JSON.parse(record.payload);
            } else {
                data = record.payload;
            }
            
            // 处理嵌套的data字段
            if (data && data.data) {
                data = data.data;
            }

            // 更新卡片显示
            this.updateCards(data);
            
            // 更新图表（实时数据不更新图表，只显示最近三天）
            // this.updateChart(record.timestamp, data);
            
            // 更新状态
            this.setStatus('connected');
            
        } catch (error) {
            console.error('数据处理失败:', error);
            this.setStatus('error');
        }
    }



    // 更新卡片显示
    updateCards(data) {
        // 更新温度卡片
        for (let i = 1; i <= 4; i++) {
            const tempEl = document.getElementById(`temp-${i}`);
            if (tempEl) {
                const value = data[`${i}wd`];
                tempEl.textContent = this.formatValue(value);
            }
        }
        
        // 更新功率卡片
        for (let i = 1; i <= 4; i++) {
            const powerEl = document.getElementById(`power-${i}`);
            if (powerEl) {
                const value = data[`${i}gl`];
                powerEl.textContent = this.formatValue(value);
            }
        }
    }

    // 加载最近三天的温度趋勿数据
    async loadThreeDaysTrend() {
        try {
            // 计算最近三天的日期范围
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 2); // 往前推两天，加上今天共三天
            
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            
            console.log(`加载最近三天的温度趋勿数据: ${startDateStr} 到 ${endDateStr}`);
            
            // 获取最近三天的数据（最多500条）
            const data = await this.api.getHistoryData(startDateStr, endDateStr, 500);
            
            if (!data || data.length === 0) {
                console.log('没有最近三天的数据');
                return;
            }
            
            console.log(`获取到 ${data.length} 条最近三天的数据`);
            
            // 清空现有数据
            this.chartData.labels = [];
            this.chartData.datasets.forEach(dataset => {
                dataset.data = [];
            });
            
            // 按时间正序排列（数据库返回的是降序）
            data.reverse().forEach(record => {
                let recordData = record.payload;
                if (typeof recordData === 'string') {
                    recordData = JSON.parse(recordData);
                }
                if (recordData && recordData.data) {
                    recordData = recordData.data;
                }
                
                // 格式化时间标签（显示月-日 时:分）
                const time = this.formatChartTimeForThreeDays(record.timestamp);
                this.chartData.labels.push(time);
                
                // 添加各区温度数据
                [1,2,3,4].forEach((i, idx) => {
                    const value = recordData[`${i}wd`];
                    this.chartData.datasets[idx].data.push(value != null ? Math.round(value) : null);
                });
            });
            
            // 更新图表
            this.chart.update('none');
            
        } catch (error) {
            console.error('加载最近三天数据失败:', error);
        }
    }

    // 执行历史数据查询
    async performQuery() {
        const startDate = this.elements.startDate.value;
        const endDate = this.elements.endDate.value;
        const limit = parseInt(this.elements.dataLimit.value);

        console.log('开始查询:', { startDate, endDate, limit });

        if (!startDate || !endDate) {
            alert('请选择开始和结束日期');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            alert('开始日期不能大于结束日期');
            return;
        }

        try {
            // 重置查询状态
            this.currentQueryResults = [];
            this.currentQueryParams = { startDate, endDate, limit };
            this.currentQueryOffset = 0;
            
            // 显示加载状态
            this.elements.queryBtn.disabled = true;
            this.elements.queryBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>查询中...';

            console.log(`开始查询历史数据: ${startDate} 到 ${endDate}, 限制: ${limit} 条`);
            const data = await this.api.getHistoryData(startDate, endDate, limit);
            console.log(`查询结果: 返回 ${data ? data.length : 0} 条数据`, data);
            
            if (Array.isArray(data)) {
                this.currentQueryResults = [...data]; // 使用展开运算符创建副本
                
                // 调试信息: 显示查询到的数据日期范围
                if (data.length > 0) {
                    const firstTime = this.formatTime(data[0].timestamp);
                    const lastTime = this.formatTime(data[data.length - 1].timestamp);
                    console.log(`查询到的数据日期范围: ${firstTime} 到 ${lastTime}`);
                }
                
                this.displayQueryResults(data, true); // true表示是新查询
                
                // 显示加载更多按钮（如果返回的数据数量等于限制数量，说明可能还有更多数据）
                if (data.length === limit) {
                    this.elements.loadMoreBtn.style.display = 'inline-block';
                } else {
                    this.elements.loadMoreBtn.style.display = 'none';
                }
            } else {
                console.error('API返回数据格式错误:', data);
                alert('查询返回数据格式错误');
            }

        } catch (error) {
            console.error('查询失败详细信息:', error);
            alert(`查询失败: ${error.message}`);
        } finally {
            // 恢复按钮状态
            this.elements.queryBtn.disabled = false;
            this.elements.queryBtn.innerHTML = '<i class="bi bi-search me-1"></i>查询数据';
        }
    }

    // 加载更多数据
    async loadMoreData() {
        if (this.isLoadingMore || !this.currentQueryParams) {
            return;
        }

        this.isLoadingMore = true;
        this.elements.loadMoreBtn.disabled = true;
        this.elements.loadMoreBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>加载中...';
        this.elements.loadingIndicator.style.display = 'block';

        try {
            // 计算新的偏移量
            this.currentQueryOffset += this.currentQueryParams.limit;
            
            // 使用修改后的API调用，包含偏移量
            const data = await this.api.getHistoryDataWithOffset(
                this.currentQueryParams.startDate,
                this.currentQueryParams.endDate,
                this.currentQueryParams.limit,
                this.currentQueryOffset
            );
            
            if (Array.isArray(data) && data.length > 0) {
                // 将新数据添加到现有结果中
                this.currentQueryResults = [...this.currentQueryResults, ...data];
                this.displayQueryResults(data, false); // false表示是追加数据
                
                // 如果返回的数据少于限制数量，说明没有更多数据了
                if (data.length < this.currentQueryParams.limit) {
                    this.elements.loadMoreBtn.style.display = 'none';
                }
            } else {
                // 没有更多数据
                this.elements.loadMoreBtn.style.display = 'none';
                alert('没有更多数据了');
            }
        } catch (error) {
            console.error('加载更多数据失败:', error);
            alert(`加载失败: ${error.message}`);
        } finally {
            this.isLoadingMore = false;
            this.elements.loadMoreBtn.disabled = false;
            this.elements.loadMoreBtn.innerHTML = '<i class="bi bi-arrow-down-circle me-1"></i>加载更多';
            this.elements.loadingIndicator.style.display = 'none';
        }
    }

    // 清空查询结果
    clearQueryResults() {
        this.elements.resultsBody.innerHTML = '';
        this.elements.resultsCard.style.display = 'none';
        this.elements.loadMoreBtn.style.display = 'none';
        this.elements.resultCount.textContent = '0';
        this.currentQueryResults = [];
        this.currentQueryParams = null;
        this.currentQueryOffset = 0;
    }

    // 显示查询结果
    displayQueryResults(data, isNewQuery = true) {
        if (!data || data.length === 0) {
            if (isNewQuery) {
                alert('未找到符合条件的数据');
            }
            return;
        }

        // 显示结果卡片
        this.elements.resultsCard.style.display = 'block';
        
        if (isNewQuery) {
            // 新查询，清空表格，重置计数
            this.elements.resultsBody.innerHTML = '';
            this.elements.resultCount.textContent = data.length;
        } else {
            // 追加数据，更新总数
            this.elements.resultCount.textContent = this.currentQueryResults.length;
        }

        // 获取当前表格中已有的行数（用于计算正确的序号）
        const currentRowCount = this.elements.resultsBody.children.length;

        // 填充数据
        data.forEach((record, index) => {
            const tr = document.createElement('tr');
            let recordData = {};
            
            try {
                recordData = typeof record.payload === 'string' 
                    ? JSON.parse(record.payload) 
                    : record.payload;
                if (recordData && recordData.data) recordData = recordData.data;
            } catch (e) {}

            // 计算正确的序号：新查询从1开始，追加数据从当前行数+1开始
            const rowNumber = currentRowCount + index + 1;

            tr.innerHTML = `
                <th>${rowNumber}</th>
                <td>${this.formatTime(record.timestamp)}</td>
                <td class="text-primary fw-bold">${this.formatValue(recordData['1wd'])}</td>
                <td class="text-info fw-bold">${this.formatValue(recordData['2wd'])}</td>
                <td class="text-warning fw-bold">${this.formatValue(recordData['3wd'])}</td>
                <td class="text-danger fw-bold">${this.formatValue(recordData['4wd'])}</td>
                <td>${this.formatValue(recordData['1gl'])}%</td>
                <td>${this.formatValue(recordData['2gl'])}%</td>
                <td>${this.formatValue(recordData['3gl'])}%</td>
                <td>${this.formatValue(recordData['4gl'])}%</td>
                <td class="fw-bold">${this.formatValue(recordData['0wd'])}</td>
                <td>${recordData['1bh'] ?? ''}</td>
                <td>${recordData['2bh'] ?? ''}</td>
                <td>${recordData['3bh'] ?? ''}</td>
            `;
            
            this.elements.resultsBody.appendChild(tr);
        });

        // 滚动到结果区域（仅新查询时）
        if (isNewQuery) {
            this.elements.resultsCard.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // 加载初始数据
    async loadInitialData() {
        try {
            console.log('开始加载最新实时数据和最近三天温度趋勿...');
            
            // 加载最新一条数据用于更新卡片显示
            const latestData = await this.api.getLatestData(1);
            if (latestData && latestData.length > 0) {
                let recordData = latestData[0].payload;
                if (typeof recordData === 'string') {
                    recordData = JSON.parse(recordData);
                }
                if (recordData && recordData.data) {
                    recordData = recordData.data;
                }
                this.updateCards(recordData);
                console.log('已更新卡片显示');
            }
            
            // 加载最近三天的温度趋勿数据
            await this.loadThreeDaysTrend();
            
            // 设置定时刷新（每小时刷新一次图表）
            this.startChartAutoRefresh();
            
            console.log('初始数据加载完成');
        } catch (error) {
            console.error('加载初始数据失败:', error);
        }
    }

    // 开始图表自动刷新
    startChartAutoRefresh() {
        // 每小时刷新一次图表
        setInterval(() => {
            console.log('自动刷新最近三天温度趋勿图表');
            this.loadThreeDaysTrend();
        }, 60 * 60 * 1000); // 1小时 = 60 * 60 * 1000 毫秒
    }

    // 更新时钟
    updateClock() {
        const updateTime = () => {
            this.elements.currentTime.textContent = 
                '当前时间：' + this.formatTime(Date.now());
        };
        
        updateTime();
        setInterval(updateTime, 1000);
    }

    // 设置连接状态
    setStatus(status) {
        const indicator = this.elements.statusIndicator;
        switch (status) {
            case 'connected':
                indicator.style.background = '#28a745';
                indicator.title = '连接正常';
                break;
            case 'error':
                indicator.style.background = '#dc3545';
                indicator.title = '连接异常';
                break;
            case 'disconnected':
                indicator.style.background = '#6c757d';
                indicator.title = '连接断开';
                break;
        }
    }

    // 格式化数值
    formatValue(value) {
        return (value || value === 0) ? Math.round(value) : '--';
    }

    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const pad = (num) => num.toString().padStart(2, '0');
        
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ` +
               `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    // 格式化图表时间（更简洁的格式）
    formatChartTime(timestamp) {
        const date = new Date(timestamp);
        const pad = (num) => num.toString().padStart(2, '0');
        
        // 只显示时分秒，简洁清晰
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    // 格式化三天趋勿图表时间（显示月-日 时:分）
    formatChartTimeForThreeDays(timestamp) {
        const date = new Date(timestamp);
        const pad = (num) => num.toString().padStart(2, '0');
        
        // 显示月-日 时:分格式
        return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }



    // 销毁实例
    destroy() {
        this.poller.stop();
        if (this.chart) {
            this.chart.destroy();
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.monitor = new TuihuoluMonitor();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.monitor) {
        window.monitor.destroy();
    }
});
