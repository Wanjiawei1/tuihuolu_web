// main.js - 炉温监控仪表板

const socket = io();
const tbody = document.getElementById('msg-body');
const tempCardsRow = document.getElementById('temp-cards');
const powerCardsRow = document.getElementById('power-cards');
const currentTimeEl = document.getElementById('current-time');

// Chart.js 配置
const ctx = document.getElementById('tempChart').getContext('2d');
const canvasEl = ctx.canvas;
// 每个点宽度 80px，初始宽度 8*80=640
canvasEl.width = 640;
// 通用整数格式化
const round = v => (v||v===0) ? Math.round(v) : '--';
const colors = ['#0d6efd','#20c997','#ffc107','#dc3545'];

// 存储所有历史数据
let allChartData = {
  labels: [],
  datasets: [1,2,3,4].map((i,idx)=>({
    label: `${i}区温度`,
    data: [],
    borderColor: colors[idx],
    backgroundColor: colors[idx]+'33',
    borderWidth: 2,
    tension: 0.25,
    pointRadius: 3,
    pointHoverRadius: 6,
  }))
};

// 当前显示的数据（只显示8条）
const chartData = {
  labels: [],
  datasets: [1,2,3,4].map((i,idx)=>({
    label: `${i}区温度`,
    data: [],
    borderColor: colors[idx],
    backgroundColor: colors[idx]+'33',
    borderWidth: 2,
    tension: 0.25,
    pointRadius: 3,
    pointHoverRadius: 6,
  }))
};

// 滑动条相关变量
let currentStartIndex = 0;
const DISPLAY_COUNT = 8;
const tempChart = new Chart(ctx, {
  type: 'line',
  data: chartData,
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { position: 'bottom' }
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    layout: { padding: 10 },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: 450,
        ticks: {
          stepSize: 50,
          callback: v=>v
        }
      }
    }
  }
});

let counter = 0;
function pad(num) { return num.toString().padStart(2, '0'); }
function fmtTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function updateClock() {
  currentTimeEl.textContent = "当前时间：" + fmtTime(Date.now());
}
setInterval(updateClock, 1000);
updateClock();

function buildCard(type, index) {
  const col = document.createElement('div');
  col.className = 'col-6 col-lg-3';
  col.innerHTML = `
    <div class="card shadow-sm ${type==='temp'?'card-temp':'card-power'} h-100">
      <div class="card-body text-center">
        <h6 class="card-title mb-1">${index}${type==='temp'? '区温度':'区功率'}</h6>
        <div class="display-6 fw-bold" id="${type}-${index}">--</div>
        <small class="text-muted">${type==='temp'? '℃':'%'}</small>
      </div>
    </div>
  `;
  return col;
}

// 初始化 8 个卡片
[1,2,3,4].forEach(i=>{
  tempCardsRow.appendChild(buildCard('temp', i));
  powerCardsRow.appendChild(buildCard('power', i));
});

function refreshCards(data) {
  [1,2,3,4].forEach(i=>{
    const tempEl = document.getElementById(`temp-${i}`);
    const powerEl = document.getElementById(`power-${i}`);
    if (tempEl) tempEl.textContent = round(data[`${i}wd`]);
    if (powerEl) powerEl.textContent = round(data[`${i}gl`]);
  });
}

function updateChart(ts, data) {
  // 添加到完整数据集
  allChartData.labels.push(ts);
  [1,2,3,4].forEach((i, idx)=>{
    const val = data[`${i}wd`];
    allChartData.datasets[idx].data.push(val!=null? Math.round(val): null);
  });
  
  // 限制全部数据最多保存1000条
  if (allChartData.labels.length > 1000) {
    allChartData.labels.shift();
    allChartData.datasets.forEach(ds=>ds.data.shift());
    if (currentStartIndex > 0) currentStartIndex--;
  }
  
  // 更新滑动条
  updateSlider();
  
  // 自动滚动到最新数据（如果当前在最后位置）
  const maxStartIndex = Math.max(0, allChartData.labels.length - DISPLAY_COUNT);
  if (currentStartIndex >= maxStartIndex - 1 || allChartData.labels.length <= DISPLAY_COUNT) {
    currentStartIndex = maxStartIndex;
    updateDisplayedChart();
  }
}

function updateDisplayedChart() {
  const endIndex = Math.min(currentStartIndex + DISPLAY_COUNT, allChartData.labels.length);
  
  chartData.labels = allChartData.labels.slice(currentStartIndex, endIndex);
  [1,2,3,4].forEach((i, idx)=>{
    chartData.datasets[idx].data = allChartData.datasets[idx].data.slice(currentStartIndex, endIndex);
  });
  
  tempChart.update('none'); // 'none' 模式避免动画
}

function updateSlider() {
  const slider = document.getElementById('chartSlider');
  const sliderContainer = document.getElementById('sliderContainer');
  
  if (slider && allChartData.labels.length > DISPLAY_COUNT) {
    slider.max = allChartData.labels.length - DISPLAY_COUNT;
    slider.value = currentStartIndex;
    slider.style.display = 'block';
    if (sliderContainer) sliderContainer.style.display = 'block';
    updateSliderInfo();
  } else if (slider && sliderContainer) {
    slider.style.display = 'none';
    sliderContainer.style.display = 'none';
  }
}

function addRow(rec) {
  counter += 1;
  const tr = document.createElement('tr');
  let data = {};
  try {
    data = typeof rec.payload === 'string' ? JSON.parse(rec.payload) : rec.payload;
    if (data && data.data) data = data.data; // 兼容嵌套 data 字段
  } catch (e) {}

  tr.innerHTML = `
    <th>${counter}</th>
    <td>${fmtTime(rec.timestamp)}</td>
    <td>${round(data['1wd'])}</td>
    <td>${round(data['2wd'])}</td>
    <td>${round(data['3wd'])}</td>
    <td>${round(data['4wd'])}</td>
    <td>${round(data['1gl'])}</td>
    <td>${round(data['2gl'])}</td>
    <td>${round(data['3gl'])}</td>
    <td>${round(data['4gl'])}</td>
    <td>${round(data['0wd'])}</td>
    <td>${data['1bh'] ?? ''}</td>
    <td>${data['2bh'] ?? ''}</td>
    <td>${data['3bh'] ?? ''}</td>
  `;
  tbody.prepend(tr);
  if (tbody.children.length > 500) tbody.removeChild(tbody.lastChild);

  refreshCards(data);
  updateChart(fmtTime(rec.timestamp), data);
}

function buildTableRow(rec){
  let data={};
  try{
    data = typeof rec.payload==='string'? JSON.parse(rec.payload): rec.payload;
    if(data&&data.data) data=data.data;
  }catch(e){}
  return `
    <th></th>
    <td>${fmtTime(rec.timestamp)}</td>
    <td>${round(data['1wd'])}</td>
    <td>${round(data['2wd'])}</td>
    <td>${round(data['3wd'])}</td>
    <td>${round(data['4wd'])}</td>
    <td>${round(data['1gl'])}</td>
    <td>${round(data['2gl'])}</td>
    <td>${round(data['3gl'])}</td>
    <td>${round(data['4gl'])}</td>
    <td>${round(data['0wd'])}</td>
    <td>${data['1bh'] ?? ''}</td>
    <td>${data['2bh'] ?? ''}</td>
    <td>${data['3bh'] ?? ''}</td>`;
}

function addRowHistory(rec, idx){
  const tr=document.createElement('tr');
  tr.innerHTML=buildTableRow(rec).replace('<th></th>',`<th>${idx}</th>`);
  tbody.appendChild(tr);
}

// 加载历史
function loadHistory(){
  fetch('/api/messages?limit=100') // 加载更多历史数据用于滑动条
    .then(r=>r.json())
    .then(arr=>{
      arr.reverse().forEach(addRow);
      // 初始化滑动条
      updateSlider();
    });
}

// 滑动条事件处理
function initSlider() {
  const slider = document.getElementById('chartSlider');
  const goToLatestBtn = document.getElementById('goToLatest');
  
  if (slider) {
    slider.addEventListener('input', function() {
      currentStartIndex = parseInt(this.value);
      updateDisplayedChart();
      updateSliderInfo();
    });
  }
  
  if (goToLatestBtn) {
    goToLatestBtn.addEventListener('click', function() {
      const maxStartIndex = Math.max(0, allChartData.labels.length - DISPLAY_COUNT);
      currentStartIndex = maxStartIndex;
      updateDisplayedChart();
      updateSlider();
      updateSliderInfo();
    });
  }
}

function updateSliderInfo() {
  const sliderInfo = document.getElementById('sliderInfo');
  if (sliderInfo && allChartData.labels.length > 0) {
    const startPos = currentStartIndex + 1;
    const endPos = Math.min(currentStartIndex + DISPLAY_COUNT, allChartData.labels.length);
    const total = allChartData.labels.length;
    sliderInfo.textContent = `显示第 ${startPos}-${endPos} 条，共 ${total} 条数据`;
  }
}

// 日期筛选相关变量
let filterData = [];
let currentFilterPage = 1;
let filterPageSize = 10;

// 初始化日期筛选功能
function initDateFilter() {
  const queryBtn = document.getElementById('queryBtn');
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  
  // 设置默认日期（今天）
  const today = new Date().toISOString().split('T')[0];
  endDateInput.value = today;
  startDateInput.value = today; // 默认查询今天的数据
  
  console.log('设置默认查询日期:', today);
  
  if (queryBtn) {
    queryBtn.addEventListener('click', performQuery);
  }
  
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', clearFilter);
  }
}

// 执行查询
async function performQuery() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const limit = document.getElementById('dataLimit').value;
  
  if (!startDate || !endDate) {
    alert('请选择开始和结束日期');
    return;
  }
  
  if (new Date(startDate) > new Date(endDate)) {
    alert('开始日期不能大于结束日期');
    return;
  }
  
  try {
    // 显示加载状态
    const queryBtn = document.getElementById('queryBtn');
    const originalText = queryBtn.innerHTML;
    queryBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>查询中...';
    queryBtn.disabled = true;
    
    // 构建查询参数
    const params = new URLSearchParams({
      startDate,
      endDate,
      limit: limit || 100
    });
    
    const url = `/api/messages/range?${params}`;
    console.log('查询URL:', url);
    console.log('查询参数:', { startDate, endDate, limit });
    
    const response = await fetch(url);
    console.log('响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('查询结果:', data.length, '条数据');
    
    filterData = data;
    currentFilterPage = 1;
    filterPageSize = parseInt(document.getElementById('dataLimit').value) || 10;
    
    displayFilterResults();
    
    // 恢复按钮状态
    queryBtn.innerHTML = originalText;
    queryBtn.disabled = false;
    
  } catch (error) {
    console.error('查询失败:', error);
    alert('查询失败，请稍后重试');
    
    // 恢复按钮状态
    const queryBtn = document.getElementById('queryBtn');
    queryBtn.innerHTML = '<i class="bi bi-search me-1"></i>查询数据';
    queryBtn.disabled = false;
  }
}

// 显示筛选结果
function displayFilterResults() {
  const resultsContainer = document.getElementById('filterResults');
  const resultCount = document.getElementById('resultCount');
  const filterBody = document.getElementById('filter-body');
  
  if (filterData.length === 0) {
    resultsContainer.style.display = 'none';
    alert('未找到符合条件的数据');
    return;
  }
  
  // 显示结果容器
  resultsContainer.style.display = 'block';
  resultCount.textContent = filterData.length;
  
  // 计算分页
  const totalPages = Math.ceil(filterData.length / filterPageSize);
  const startIndex = (currentFilterPage - 1) * filterPageSize;
  const endIndex = Math.min(startIndex + filterPageSize, filterData.length);
  const pageData = filterData.slice(startIndex, endIndex);
  
  // 清空表格
  filterBody.innerHTML = '';
  
  // 填充数据
  pageData.forEach((rec, index) => {
    const tr = document.createElement('tr');
    let data = {};
    try {
      data = typeof rec.payload === 'string' ? JSON.parse(rec.payload) : rec.payload;
      if (data && data.data) data = data.data;
    } catch (e) {}
    
    tr.innerHTML = `
      <th>${startIndex + index + 1}</th>
      <td>${fmtTime(rec.timestamp)}</td>
      <td class="text-primary fw-bold">${round(data['1wd'])}</td>
      <td class="text-info fw-bold">${round(data['2wd'])}</td>
      <td class="text-warning fw-bold">${round(data['3wd'])}</td>
      <td class="text-danger fw-bold">${round(data['4wd'])}</td>
      <td>${round(data['1gl'])}%</td>
      <td>${round(data['2gl'])}%</td>
      <td>${round(data['3gl'])}%</td>
      <td>${round(data['4gl'])}%</td>
      <td class="fw-bold">${round(data['0wd'])}</td>
      <td>${data['1bh'] ?? ''}</td>
      <td>${data['2bh'] ?? ''}</td>
      <td>${data['3bh'] ?? ''}</td>
    `;
    filterBody.appendChild(tr);
  });
  
  // 更新分页控件
  updateFilterPagination(totalPages);
  
  // 滚动到结果区域
  resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 更新分页控件
function updateFilterPagination(totalPages) {
  const pagination = document.getElementById('filterPagination');
  pagination.innerHTML = '';
  
  if (totalPages <= 1) return;
  
  // 上一页按钮
  const prevLi = document.createElement('li');
  prevLi.className = `page-item ${currentFilterPage === 1 ? 'disabled' : ''}`;
  prevLi.innerHTML = `<a class="page-link" href="#"><i class="bi bi-chevron-left"></i></a>`;
  if (currentFilterPage > 1) {
    prevLi.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      currentFilterPage--;
      displayFilterResults();
    });
  }
  pagination.appendChild(prevLi);
  
  // 页码按钮
  const startPage = Math.max(1, currentFilterPage - 2);
  const endPage = Math.min(totalPages, currentFilterPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${i === currentFilterPage ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    
    if (i !== currentFilterPage) {
      li.querySelector('a').addEventListener('click', (e) => {
        e.preventDefault();
        currentFilterPage = i;
        displayFilterResults();
      });
    }
    
    pagination.appendChild(li);
  }
  
  // 下一页按钮
  const nextLi = document.createElement('li');
  nextLi.className = `page-item ${currentFilterPage === totalPages ? 'disabled' : ''}`;
  nextLi.innerHTML = `<a class="page-link" href="#"><i class="bi bi-chevron-right"></i></a>`;
  if (currentFilterPage < totalPages) {
    nextLi.querySelector('a').addEventListener('click', (e) => {
      e.preventDefault();
      currentFilterPage++;
      displayFilterResults();
    });
  }
  pagination.appendChild(nextLi);
}

// 清除筛选
function clearFilter() {
  document.getElementById('filterResults').style.display = 'none';
  filterData = [];
  currentFilterPage = 1;
  
  // 重置日期（默认今天）
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('endDate').value = today;
  document.getElementById('startDate').value = today;
  
  document.getElementById('dataLimit').value = '10';
}

loadHistory();
// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  initSlider();
  initDateFilter();
});

socket.on('mqtt_message', addRow);