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
  chartData.labels.push(ts);
  [1,2,3,4].forEach((i, idx)=>{
    const val = data[`${i}wd`];
    chartData.datasets[idx].data.push(val!=null? Math.round(val): null);
  });
  if (chartData.labels.length > 50) {
    chartData.labels.shift();
    chartData.datasets.forEach(ds=>ds.data.shift());
  }
  tempChart.update();
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
  fetch('/api/messages')
    .then(r=>r.json())
    .then(arr=>{
      arr.reverse().forEach(addRow);
    });
}

loadHistory();

socket.on('mqtt_message', addRow);