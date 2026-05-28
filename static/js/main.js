/* ─── Theme ─────────────────────────────────────────────── */
(function(){
  const t=document.querySelector('[data-theme-toggle]'),r=document.documentElement;
  t&&t.addEventListener('click',()=>{
    const next=r.getAttribute('data-theme')==='dark'?'light':'dark';
    r.setAttribute('data-theme',next);
    localStorage.setItem('eicu_theme',next);
  });
})();

const isDark=()=>document.documentElement.getAttribute('data-theme')==='dark';
const gc=()=>isDark()?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)';
const tc=()=>isDark()?'#8892a4':'#64748b';

/* ─── Timestamp ──────────────────────────────────────────── */
document.getElementById('last-updated').textContent =
  '최종 업데이트: ' + new Date().toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

/* ─── Chart ──────────────────────────────────────────────── */
const ctx=document.getElementById('trendChart').getContext('2d');
const targetLine={id:'tl',afterDraw(c){
  const{ctx:cx,chartArea:{left,right},scales:{y}}=c;
  const yv=y.getPixelForValue(5);
  cx.save();cx.setLineDash([6,4]);
  cx.strokeStyle=isDark()?'rgba(245,158,11,0.5)':'rgba(217,119,6,0.5)';
  cx.lineWidth=1.5;cx.beginPath();cx.moveTo(left,yv);cx.lineTo(right,yv);cx.stroke();
  cx.font="10px 'Noto Sans KR'";cx.fillStyle=isDark()?'rgba(245,158,11,0.7)':'#d97706';
  cx.fillText('반영 정확도 목표',right-72,yv-5);cx.restore();
}};
const chart=new Chart(ctx,{
  type:'line',
  data:{labels:[],datasets:[
    {label:'전체 반영 불일치율',data:[],borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',tension:0.4,fill:true,pointBackgroundColor:'#3b82f6',pointRadius:4,borderWidth:2},
    {label:'연속형 항목 지연율',data:[],borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,0.04)',tension:0.4,fill:false,pointBackgroundColor:'#ef4444',pointRadius:4,borderWidth:2,borderDash:[4,3]}
  ]},
  options:{
    responsive:true,maintainAspectRatio:false,
    interaction:{mode:'index',intersect:false},
    plugins:{
      legend:{position:'top',labels:{font:{size:11,family:"'Noto Sans KR'"},color:tc(),boxWidth:12,padding:12}},
      tooltip:{backgroundColor:isDark()?'#1c2333':'#fff',titleColor:tc(),bodyColor:tc(),borderColor:isDark()?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.08)',borderWidth:1,padding:10}
    },
    scales:{
      x:{grid:{color:gc()},ticks:{color:tc(),font:{size:11}}},
      y:{min:0,max:12,grid:{color:gc()},ticks:{color:tc(),font:{size:11},callback:v=>v+'%'}}
    }
  },
  plugins:[targetLine]
});

/* ─── Animate numbers ────────────────────────────────────── */
function anim(el,end,dur,fmt){
  const st=performance.now();
  (function f(ts){
    const p=Math.min((ts-st)/dur,1),e=1-Math.pow(1-p,3),v=end*e;
    if(fmt==='money') el.textContent='₩ '+Math.round(v).toLocaleString();
    else if(fmt==='int') el.textContent=Math.round(v)+'%';
    else el.textContent=v.toFixed(1)+'%';
    if(p<1)requestAnimationFrame(f);
  })(performance.now());
}

/* ─── Load trend data ────────────────────────────────────── */
let currentPeriod='monthly';

async function loadTrend(period){
  currentPeriod=period;
  const sub=document.getElementById('chart-sub');
  if(sub) sub.textContent=period==='weekly'?'주간 · 최근 6주':'월간 · 최근 6개월';
  try {
    const res=await fetch(`/api/trend?period=${period}`);
    if(!res.ok) return;
    const d=await res.json();
    chart.data.labels=d.labels||[];
    chart.data.datasets[0].data=d.mismatch||[];
    chart.data.datasets[1].data=d.delay||[];
    chart.options.scales.y.max=12;
    chart.options.scales.y.ticks.callback=v=>v+'%';
    chart.update('active');
  } catch(e){ console.warn('trend fetch failed',e); }
}

/* ─── Chart tabs ─────────────────────────────────────────── */
document.querySelectorAll('.ctab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.ctab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    loadTrend(tab.dataset.chart);
  });
});

/* ─── Period tabs ────────────────────────────────────────── */
document.querySelectorAll('.ptab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.ptab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    loadTrend(tab.dataset.period);
  });
});

/* ─── Load checklist ─────────────────────────────────────── */
async function loadChecklist(){ loadChecklistLocal(); }

/* ─── Load incidents (localStorage) ─────────────────────── */
async function loadIncidents(){
  const tbody=document.getElementById('incidents-body');
  if(!tbody)return;
  const arr=JSON.parse(localStorage.getItem('incidents_manual')||'[]');
  if(!arr.length){
    tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:1rem">수동 입력된 인시던트가 없습니다</td></tr>';
    return;
  }
  const priorityTag={높음:'<span class="tag tag-r">높음</span>',중간:'<span class="tag tag-y">중간</span>',낮음:'<span class="tag tag-g">낮음</span>'};
  tbody.innerHTML=arr.map(i=>`
    <tr style="${i.resolved?'opacity:.55;':''}${!i.resolved?'background:rgba(254,243,199,.35)':''}">
      <td style="${i.resolved?'text-decoration:line-through':''}">${i.item}</td>
      <td>${i.cause||'-'}</td>
      <td style="font-family:'JetBrains Mono',monospace">${i.shift||'-'}</td>
      <td>${priorityTag[i.priority]||''}</td>
      <td>${i.resolved?'<span class="tag tag-g">해결</span>':'<span class="tag tag-r">미처리</span>'}</td>
      <td style="font-family:'JetBrains Mono',monospace;color:var(--muted)">${i.date||'-'}</td>
    </tr>
  `).join('');
}

/* ─── Flow calc ──────────────────────────────────────────── */
let flowRecords = [];

function _parseMins(t){
  const [h,m]=(t||'').split(':').map(Number);
  return h*60+(m||0);
}
function _durStr(a,b){
  const d=_parseMins(b)-_parseMins(a);
  if(d<=0)return '—';
  return Math.floor(d/60)+'h '+(d%60)+'m';
}

function renderFlowTable(){
  const colors={0.4:'var(--ok)',0.5:'var(--warn)',0.6:'var(--err)'};
  const maxFlow=0.6;
  const wrap=document.getElementById('flow-records');
  if(!wrap)return;
  if(flowRecords.length===0){
    wrap.innerHTML='<div style="font-size:.75rem;color:var(--faint);padding:.75rem;text-align:center">기록 추가 후 표시됩니다</div>';
    return;
  }
  wrap.innerHTML=`<div class="flow-row header"><span>시각</span><span>Flow (L/min)</span><span>값</span><span>구간</span></div>`+
  flowRecords.map((r,i)=>{
    const nextTime=flowRecords[i+1]?flowRecords[i+1].time:null;
    const dur=nextTime?_durStr(r.time,nextTime):'—';
    const barW=r.flow!=null?Math.round((r.flow/maxFlow)*70):0;
    return `<div class="flow-row">
      <span class="flow-time">${r.time}</span>
      <div class="flow-bar-cell">
        ${r.flow!=null
          ?`<div class="flow-bar" style="width:${barW}%;background:${colors[r.flow]||'var(--pri)'}"></div>`
          :'<span style="font-size:.65rem;color:var(--faint)">정산 시점</span>'}
      </div>
      <span class="flow-val" style="color:${r.flow!=null?(colors[r.flow]||'var(--pri)'):'var(--faint)'}">
        ${r.flow!=null?r.flow+' L':'-'}
      </span>
      <span class="flow-dur">${dur}</span>
    </div>`;
  }).join('');
}

function addFlowRecord(){
  const tEl=document.getElementById('flow-in-time');
  const fEl=document.getElementById('flow-in-val');
  if(!tEl||!fEl)return;
  const t=tEl.value.trim();
  const f=parseFloat(fEl.value);
  if(!t){alert('시각을 입력하세요');return;}
  flowRecords.push({time:t,flow:isNaN(f)?null:f});
  flowRecords.sort((a,b)=>_parseMins(a.time)-_parseMins(b.time));
  tEl.value='';fEl.value='';
  renderFlowTable();
}

function clearFlowRecords(){
  if(!confirm('산소 기록을 모두 삭제할까요?'))return;
  flowRecords=[];
  renderFlowTable();
  const cr=document.getElementById('calc-result');
  const cp=document.getElementById('calc-placeholder');
  if(cr)cr.style.display='none';
  if(cp)cp.style.display='flex';
}

async function runCalc(){
  if(flowRecords.length===0){alert('기록을 먼저 추가하세요');return;}
  const res=await fetch('/api/flow-calc',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({records:flowRecords})
  });
  const d=await res.json();
  document.getElementById('calc-placeholder').style.display='none';
  document.getElementById('calc-result').style.display='block';
  document.getElementById('calc-total-val').textContent=d.total_liters+' L';
  document.getElementById('calc-formula').innerHTML=
    d.segments.map(s=>`(${s.flow} × ${(s.minutes/60).toFixed(2)}h) = <strong>${s.volume} L</strong>`).join('<br>') +
    `<br>━━━━━━━━━━━━━━<br>합계 = <strong style="color:var(--pur)">${d.total_liters} L</strong>`;
}

/* ─── Upload ─────────────────────────────────────────────── */

function showResultBadges(d) {
  const wrap = document.getElementById('result-badges');
  wrap.style.display = 'flex';

  const bMiss = document.getElementById('badge-missing');
  const missCount = (d.missing_items || []).length;
  bMiss.textContent = `처방 미입력 의심 ${missCount}건`;
  bMiss.style.display = missCount > 0 ? '' : 'none';

  const bDiff = document.getElementById('badge-diff');
  if (d.diff_count !== undefined) {
    bDiff.textContent = `불출 vs 처방 차이 ${d.diff_count}건`;
    bDiff.style.display = d.diff_count > 0 ? '' : 'none';
  } else {
    bDiff.style.display = 'none';
  }

  const bCont = document.getElementById('badge-continuous');
  const contCount = (d.continuous_items || []).length;
  bCont.textContent = `연속형 항목 이브닝 정산 확인 ${contCount}건`;
  bCont.style.display = contCount > 0 ? '' : 'none';
}

function renderDelayTable(items) {
  if (!items || items.length === 0) return;
  const rows = items.map(i => {
    const bg = i.highlight === 'red'    ? 'background:rgba(239,68,68,.08)' :
               i.highlight === 'orange' ? 'background:rgba(245,158,11,.08)' :
               i.highlight === 'yellow' ? 'background:rgba(234,179,8,.08)'  :
               i.highlight === 'green'  ? 'background:rgba(34,197,94,.06)'  : '';
    // 단독 분석: item/cause / 비교 분석: 그룹/차이
    const itemName = i.item || i['그룹'] || '-';
    const cause = i.cause ||
      (i['차이'] !== undefined
        ? `불출 ${i['불출_출고량'] ?? '-'}건 / 처방 ${i['처방_실수량'] ?? '-'}건 (차이 ${i['차이'] > 0 ? '+' : ''}${i['차이']})`
        : '-');
    const eveningBadge = i.highlight === 'yellow'
      ? '<span class="tag tag-y" style="margin-left:.25rem">이브닝cost</span>' : '';
    const statusCell = statusTag[i.status] ||
      (i.highlight === 'green'
        ? '<span class="tag tag-g">일치</span>'
        : '<span class="tag tag-y">확인필요</span>');
    return `<tr style="${bg}">
      <td>${itemName}${eveningBadge}</td>
      <td>${cause}</td>
      <td style="font-family:'JetBrains Mono',monospace">${i.shift || '업로드'}</td>
      <td>${severityTag[i.severity] || ''}</td>
      <td>${statusCell}</td>
    </tr>`;
  });
  document.getElementById('incidents-body').innerHTML = rows.join('');
}

function renderMissingTable(items) {
  if (!items || items.length === 0) return;
  let sec = document.getElementById('missing-section');
  if (!sec) {
    sec = document.createElement('div');
    sec.id = 'missing-section';
    sec.className = 'card';
    sec.style.marginTop = '1rem';
    const anchor = document.getElementById('incidents-body').closest('.card');
    anchor.after(sec);
  }
  sec.innerHTML = `
    <div class="card-hd">
      <div>
        <div class="card-title">처방 미입력 의심 항목</div>
        <div class="card-sub">처방코드 없이 실수량이 기록된 항목 — 사후 처방 확인 필요</div>
      </div>
    </div>
    <table class="tbl"><thead><tr>
      <th>항목</th><th>원인</th><th>교대</th><th>우선순위</th><th>상태</th>
    </tr></thead><tbody>
    ${items.map(i => `<tr style="background:rgba(234,179,8,.08)">
      <td>${i.item || '-'}</td>
      <td>${i.cause || '-'}</td>
      <td style="font-family:'JetBrains Mono',monospace">${i.shift || '업로드'}</td>
      <td>${severityTag[i.severity] || ''}</td>
      <td><span class="tag tag-y">처방미입력</span></td>
    </tr>`).join('')}
    </tbody></table>`;
}

async function handleUpload() {
  const file = document.getElementById('upload-ganhocheo').files[0];
  if (!file) { alert('간호처방집계 파일을 선택해주세요.'); return; }
  const form = new FormData();
  form.append('file', file);
  document.getElementById('upload-status').textContent = '⏳ 분석 중...';

  const res = await fetch('/api/upload', { method: 'POST', body: form });
  const d = await res.json();
  if (d.error) {
    document.getElementById('upload-status').textContent = '❌ 오류: ' + d.error;
    return;
  }

  // KPI 갱신
  anim(document.getElementById('v1'), d.kpi.match_rate,      800);
  anim(document.getElementById('v2'), d.kpi.evening_rate,    800);
  anim(document.getElementById('v3'), d.kpi.checklist_rate,  800, 'int');
  anim(document.getElementById('v4'), d.kpi.delay_cost,      800, 'money');
  ['v1-p','v2-p','v3-p','v4-p'].forEach(id =>
    document.getElementById(id).textContent = d.kpi.period_label);

  // match_note 표시
  const noteEl = document.getElementById('v1-note');
  if (noteEl && d.match_note) noteEl.textContent = d.match_note;

  // 차트 갱신 (중복 방지)
  const idx = chart.data.labels.indexOf(d.date);
  if (idx === -1) {
    chart.data.labels.push(d.date);
    chart.data.datasets[0].data.push(d.kpi.match_rate);
    chart.data.datasets[1].data.push(d.kpi.evening_rate);
  } else {
    chart.data.datasets[0].data[idx] = d.kpi.match_rate;
    chart.data.datasets[1].data[idx] = d.kpi.evening_rate;
  }
  chart.update('active');

  // 사례 테이블 갱신
  if (d.delay_items && d.delay_items.length > 0) renderDelayTable(d.delay_items);
  if (d.missing_items && d.missing_items.length > 0) renderMissingTable(d.missing_items);
  updateTypeChart(d);

  document.getElementById('upload-status').textContent =
    `✓ ${d.upload_type} 반영 완료 · 총 ${d.total_items}건 · ${d.date}`;
  document.getElementById('last-updated').textContent =
    '최종 업데이트: ' + new Date().toLocaleString('ko-KR');
  showResultBadges(d);

  // 업로드 내역 저장
  const _today = new Date().toISOString().slice(0,10);
  const _csvKey = `upload_${d.date||_today}_ganhocheo_csv`;
  const _csvRows = [...(d.delay_items||[]), ...(d.missing_items||[])].map(r => ({
    item: r.item||'', order_qty: r.order_qty||0, delivered_qty: r.delivered_qty||0,
    undelivered_qty: r.undelivered_qty||0, note: r.cause||''
  }));
  localStorage.setItem(_csvKey, JSON.stringify({
    meta: { date: d.date||_today, doctype: 'ganhocheo', duty: 'csv' },
    rows: _csvRows,
    confirmedAt: new Date().toISOString(),
    stats: { total: d.total_items||0, delay: (d.delay_items||[]).length,
             overstock: 0, evening: 0 }
  }));
  renderUploadHistory();
}

async function handleCompare() {
  const f1 = document.getElementById('upload-ganhocheo').files[0];
  const f2 = document.getElementById('upload-bulchul').files[0];
  if (!f1 || !f2) { alert('두 파일을 모두 선택해주세요. (① 간호처방집계 + ② 불출증)'); return; }
  const form = new FormData();
  form.append('ganhocheo', f1);
  form.append('bulchul', f2);
  document.getElementById('upload-status').textContent = '⏳ 비교 분석 중...';

  const res = await fetch('/api/compare', { method: 'POST', body: form });
  const d = await res.json();
  if (d.error) {
    document.getElementById('upload-status').textContent = '❌ 오류: ' + d.error;
    return;
  }

  anim(document.getElementById('v1'), d.kpi.match_rate,  800);
  anim(document.getElementById('v4'), d.kpi.delay_cost,  800, 'money');
  ['v1-p','v2-p','v3-p','v4-p'].forEach(id =>
    document.getElementById(id).textContent = d.kpi.period_label);

  if (d.diff_items && d.diff_items.length > 0) renderDelayTable(d.diff_items);
  updateTypeChart(d);

  // Phase 4: CSV 다운로드용 데이터 저장
  if (d.diff_items) {
    window._comparisonData = d.diff_items.map(r => ({
      item: r.item,
      prescribed: r.order_qty ?? r.prescribed ?? 0,
      dispensed:  r.delivered_qty ?? r.dispensed ?? 0
    }));
    const dlArea = document.getElementById('csv-download-area');
    if (dlArea) dlArea.style.display = 'block';
  }

  document.getElementById('upload-status').textContent =
    `⇄ 비교 완료 · 차이 항목 ${d.diff_count}건 · ${d.date}`;
  document.getElementById('last-updated').textContent =
    '최종 업데이트: ' + new Date().toLocaleString('ko-KR');
  showResultBadges(d);

  // 업로드 내역 저장
  const _today2 = new Date().toISOString().slice(0,10);
  const _cmpKey = `upload_${d.date||_today2}_compare_csv`;
  const _cmpRows = (d.diff_items||[]).map(r => ({
    item: r.item||'', order_qty: r.order_qty||r.prescribed||0,
    delivered_qty: r.delivered_qty||r.dispensed||0,
    undelivered_qty: r.diff||0, note: r.status||''
  }));
  localStorage.setItem(_cmpKey, JSON.stringify({
    meta: { date: d.date||_today2, doctype: 'compare', duty: 'csv' },
    rows: _cmpRows,
    confirmedAt: new Date().toISOString(),
    stats: { total: _cmpRows.length, delay: d.diff_count||0, overstock: 0, evening: 0 }
  }));
  renderUploadHistory();
}

/* ─── Checklist (localStorage) ───────────────────────────── */
const CHECKLIST_ITEMS = [
  "일회성 소모품 전산 반영 완료",
  "산소/HFNC 입력 및 이브닝 cost 확인",
  "인공호흡기 사용 시간 반영 확인",
  "CRRT 가동 시간 및 세트 반영 확인",
  "지속정주약물 사용량 반영 확인",
  "수혈 완료/중단 반영 확인",
  "드레싱 세트 반영 확인",
  "미반영 항목 인수인계 확인",
];
const SHIFT_LABEL = "D교대";

function getTodayKey() {
  return 'checklist_' + new Date().toISOString().slice(0,10);
}

function loadChecklistLocal() {
  const key = getTodayKey();
  const saved = JSON.parse(localStorage.getItem(key) || 'null');
  const state = CHECKLIST_ITEMS.map((_, i) =>
    (saved && saved[i]) ? saved[i] : { done: false, time: '' }
  );
  renderChecklist(state);
}

function toggleCheck(idx) {
  const key = getTodayKey();
  const saved = JSON.parse(localStorage.getItem(key) || 'null');
  const state = CHECKLIST_ITEMS.map((_, i) =>
    (saved && saved[i]) ? saved[i] : { done: false, time: '' }
  );
  state[idx].done = !state[idx].done;
  state[idx].time = state[idx].done
    ? new Date().toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'})
    : '';
  localStorage.setItem(key, JSON.stringify(state));
  renderChecklist(state);
}

function renderChecklist(state) {
  const completed = state.filter(s => s.done).length;
  const total = CHECKLIST_ITEMS.length;
  const today = new Date().toLocaleDateString('ko-KR',
    {year:'numeric', month:'2-digit', day:'2-digit'});

  document.getElementById('chk-meta').textContent = `${today} ${SHIFT_LABEL}`;
  document.getElementById('chk-count').textContent = `${completed} / ${total} 완료`;

  const ul = document.getElementById('chk-list');
  ul.innerHTML = CHECKLIST_ITEMS.map((text, i) => {
    const s = state[i];
    return `<div class="chk" data-chk-idx="${i}" style="cursor:pointer;user-select:none">
      <div class="chk-ico ${s.done ? 'done' : 'pend'}">
        ${s.done
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'
        }
      </div>
      <span class="chk-txt" ${s.done ? '' : 'style="color:var(--muted)"'}>${text}</span>
      <span class="chk-time">${s.time || '미완료'}</span>
    </div>`;
  }).join('');
}

/* ─── Init empty state ───────────────────────────────────── */
function initEmptyState() {
  // KPI 카드: 모두 "—"
  ['v1','v2','v3','v4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  ['v1-d','v2-d','v3-d','v4-d'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  ['v1-p','v2-p','v3-p','v4-p'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '파일 업로드 후 표시';
  });

  // 차트: 빈 상태
  chart.data.labels = [];
  chart.data.datasets[0].data = [];
  chart.data.datasets[1].data = [];
  chart.update();
  const sub = document.getElementById('chart-sub');
  if (sub) sub.textContent = '간호처방집계 또는 불출증 파일을 업로드하면 차트가 표시됩니다.';

  // 사례 테이블: 안내
  const tbody = document.getElementById('incidents-body');
  if (tbody) tbody.innerHTML =
    `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem;font-size:.8rem">
      ▲ 파일을 업로드하면 반영 지연·불일치 사례가 여기에 표시됩니다.
    </td></tr>`;

  // 알림: 업로드 유도
  const alertBox = document.getElementById('alert-box');
  const alertTxt = document.getElementById('alert-text');
  if (alertBox && alertTxt) {
    alertBox.style.display = 'flex';
    alertTxt.innerHTML = '상단의 <strong>간호처방집계 또는 불출증 파일을 업로드</strong>하면 오늘 교대의 반영 현황이 표시됩니다.';
  }

  // 처치 유형별 진행바: 안내
  const panelDelay = document.getElementById('panel-delay');
  if (panelDelay) panelDelay.innerHTML =
    `<div style="color:var(--muted);font-size:.8rem;padding:1rem;text-align:center">
      파일 업로드 후 처치 유형별 지연 현황이 표시됩니다.
    </div>`;
}

/* ─── 처치 유형별 진행바 동적 갱신 ───────────────────────── */
function updateTypeChart(d) {
  const panel = document.getElementById('panel-delay');
  if (!panel) return;
  const items = [...(d.delay_items || []), ...(d.missing_items || [])];
  if (items.length === 0) {
    panel.innerHTML = `<div style="color:var(--ok);font-size:.8rem;padding:.75rem;font-weight:600">✓ 반영 지연 항목 없음</div>`;
    return;
  }
  const total = d.total_items || 1;
  const groups = {};
  items.forEach(item => {
    const g = item['그룹'] || (item.item
      ? (item.item.match(/산소|O2|HFNC|고유량/i) ? '산소' :
         item.item.match(/인공호흡|ventilator/i) ? '인공호흡기' :
         item.item.match(/CRRT|신대체/i) ? 'CRRT' :
         item.item.match(/드레싱|OPSITE|BETAFOAM|Allevyn|TEGADERM/i) ? '드레싱' :
         item.item.match(/catheter|카테터|INSYTE/i) ? '카테터' :
         item.item.match(/suction|흡인/i) ? '흡인' : '기타')
      : '기타');
    groups[g] = (groups[g] || 0) + 1;
  });
  panel.innerHTML = Object.entries(groups).map(([g, cnt]) => {
    const pct = Math.round(cnt / total * 100);
    const barW = Math.min(pct * 8, 100);
    const color = pct >= 10 ? 'var(--err)' : pct >= 5 ? 'var(--warn)' : 'var(--ok)';
    return `<div class="prog-item">
      <div class="prog-row">
        <span class="prog-lbl">${g}</span>
        <span class="prog-val" style="color:${color}">${pct}% <span style="color:var(--faint);font-size:.65rem">(${cnt}건)</span></span>
      </div>
      <div class="prog-bg"><div class="prog-fill" style="width:${barW}%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

/* ─── Upload Tab Switch ──────────────────────────────────── */
function switchUploadTab(tab) {
  const csv   = document.getElementById('upload-csv-panel');
  const image = document.getElementById('upload-image-panel');
  if (csv)   csv.style.display   = tab === 'csv'   ? '' : 'none';
  if (image) image.style.display = tab === 'image' ? '' : 'none';
  document.querySelectorAll('.upload-tab').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab));
}

/* ─── Image OCR Upload ───────────────────────────────────── */
async function handleImageUpload() {
  const files = Array.from(document.getElementById('upload-image').files);
  if (!files.length) { alert('이미지 파일을 선택해주세요.'); return; }

  const date    = document.getElementById('meta-date').value    || new Date().toISOString().slice(0,10);
  const doctype = document.getElementById('meta-doctype').value;
  const duty    = document.getElementById('meta-duty').value;

  const st = document.getElementById('upload-status');
  window._currentMeta = { date, doctype, duty, memo: document.getElementById('meta-memo').value };

  const allItems = [];
  let manualMode = false;

  for (let i = 0; i < files.length; i++) {
    st.textContent = `⏳ AI 분석 중... (${i + 1}/${files.length}장)`;
    const form = new FormData();
    form.append('file', files[i]);
    try {
      const res = await fetch('/api/ocr-upload', { method: 'POST', body: form });
      const d   = await res.json();
      if (d.error && !d.manual_mode) { st.textContent = `❌ ${files[i].name}: ${d.error}`; continue; }
      if (d.manual_mode) { manualMode = true; }
      else { allItems.push(...(d.items || [])); }
    } catch(e) {
      st.textContent = `❌ 네트워크 오류 (${files[i].name}): ${e.message}`; continue;
    }
  }

  renderOcrTable(allItems, manualMode);
  if (manualMode) {
    st.textContent = '✏️ 수동 입력 모드 — 직접 입력 후 확정해주세요.';
  } else {
    st.textContent = `✓ ${files.length}장 처리 완료 · 총 ${allItems.length}개 항목 추출 — 수정 후 "분석 확정" 클릭`;
  }
}

function resetTodayKpi() {
  if (!confirm('오늘 업로드 집계(총 업로드 / 추출 완료)를 0으로 초기화할까요?\n다른 날짜 기록은 유지됩니다.')) return;
  const today = new Date().toISOString().slice(0, 10);
  localStorage.removeItem('daily_summary_' + today);
  _updateSummaryCard(0, 0, 0, 0);
  ['sum-uploads','sum-extracted','sum-needs-review','sum-overstock','sum-evening'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0';
  });
  showToast('오늘 집계가 초기화되었습니다.', 'ok', 2500);
}

/* ─── Duplicate Upload Check ────────────────────────────── */
function checkDuplicate(date, doctype, duty) {
  const key = `upload_${date}_${doctype}_${duty}`;
  if (!localStorage.getItem(key)) return true;
  const labels = { bulchul:'불출증', ganhocheo:'간호처방집계', other:'기타' };
  const dutyL  = { day:'Day', evening:'Evening', night:'Night' };
  return confirm(`${date} ${dutyL[duty]} ${labels[doctype]}는 이미 등록되었습니다.\n덮어쓰시겠습니까?`);
}

/* ─── OCR Table Render ───────────────────────────────────── */
function renderOcrTable(items, manualMode) {
  document.getElementById('ocr-result-section').style.display = '';
  document.getElementById('ocr-count-label').textContent = manualMode
    ? '수동 입력 모드 — 직접 입력 후 확정'
    : `${items.length}개 항목 추출됨 · 노란 셀 = 불확실 · 수정 후 확정`;

  window._ocrOriginal = items.map(r => ({...r}));
  window._editCount   = 0;

  const oldTbody = document.getElementById('ocr-tbody');
  const tbody = oldTbody.cloneNode(false);
  oldTbody.replaceWith(tbody);
  tbody.innerHTML = items.map((r, i) => _ocrRowHtml(i, r)).join('');
  if (manualMode || items.length === 0) _addEmptyOcrRow();

  tbody.addEventListener('input', _onOcrEdit);
  document.getElementById('ocr-result-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _ocrRowHtml(i, r) {
  const cell = (val, key) => {
    const low = r.confidence === 'low' || val === null || val === undefined || val === '';
    const bg  = low ? 'background:rgba(234,179,8,.18);' : '';
    return `<td><input class="ocr-input" style="${bg}" value="${val ?? ''}"
      data-idx="${i}" data-key="${key}" data-original="${val ?? ''}" /></td>`;
  };
  return `<tr id="ocr-row-${i}">
    ${cell(r.item,'item')}${cell(r.unit,'unit')}${cell(r.order_qty,'order_qty')}
    ${cell(r.delivered_qty,'delivered_qty')}${cell(r.undelivered_qty,'undelivered_qty')}
    ${cell(r.actual_qty,'actual_qty')}${cell(r.note,'note')}
    <td><button onclick="removeOcrRow(${i})" style="color:var(--err);font-size:.75rem;background:none;border:none;cursor:pointer;padding:2px 6px">✕</button></td>
  </tr>`;
}

function _addEmptyOcrRow() {
  const i = document.getElementById('ocr-tbody').rows.length;
  document.getElementById('ocr-tbody').insertAdjacentHTML('beforeend',
    _ocrRowHtml(i, {item:'',unit:'',order_qty:null,delivered_qty:null,
                    undelivered_qty:null,actual_qty:null,note:'',confidence:'low'}));
}

function addOcrRow() { _addEmptyOcrRow(); }

function removeOcrRow(i) { document.getElementById('ocr-row-'+i)?.remove(); }

function _onOcrEdit() {
  let count = 0;
  document.querySelectorAll('.ocr-input').forEach(inp => {
    if (inp.value !== inp.dataset.original) count++;
  });
  window._editCount = count;
  const el = document.getElementById('ocr-edit-count');
  if (el) el.textContent = count > 0 ? `${count}개 셀 수정됨` : '';
}

/* ─── Confirm OCR Data → Analysis ───────────────────────── */
const CONTINUOUS_RE = /산소|O2|HFNC|고유량|인공호흡|ventilator|CRRT|지속/i;

function confirmOcrData() {
  const rows = [...document.querySelectorAll('#ocr-tbody tr')].map(tr => {
    const ins = tr.querySelectorAll('input');
    return {
      item:            ins[0]?.value.trim() || '',
      unit:            ins[1]?.value || '',
      order_qty:       parseFloat(ins[2]?.value) || 0,
      delivered_qty:   parseFloat(ins[3]?.value) || 0,
      undelivered_qty: parseFloat(ins[4]?.value) || 0,
      actual_qty:      parseFloat(ins[5]?.value) || 0,
      note:            ins[6]?.value || '',
    };
  }).filter(r => r.item);

  if (!rows.length) {
    document.getElementById('ocr-status').textContent = '⚠️ 항목이 없습니다. 행을 추가해주세요.';
    return;
  }

  const maxSettings = loadMaxSettings();
  const delay = rows.filter(r =>
    r.undelivered_qty > 0 || r.actual_qty < r.order_qty * 0.9
  );
  const overstock = rows.filter(r => {
    const customMax = maxSettings[r.item];
    return customMax ? r.actual_qty > customMax : r.delivered_qty > r.order_qty * 1.2;
  });
  const eveningItems = rows.filter(r => CONTINUOUS_RE.test(r.item));

  // 사례 테이블 갱신
  renderDelayTable([
    ...delay.map(r => ({
      item: r.item,
      cause: `청구 ${r.order_qty} / 출고 ${r.delivered_qty} / 미출고 ${r.undelivered_qty}`,
      shift: window._currentMeta?.duty || '업로드',
      severity: r.undelivered_qty > 0 ? 'high' : 'medium',
      highlight: r.undelivered_qty > 0 ? 'red' : 'orange',
    })),
    ...overstock.map(r => ({
      item: r.item,
      cause: `과다 적재 의심 (실수량 ${r.actual_qty} / MAX ${maxSettings[r.item] || '기준치'})`,
      shift: window._currentMeta?.duty || '업로드',
      severity: 'medium',
      highlight: 'yellow',
    })),
  ]);
  updateTypeChart({ delay_items: delay, total_items: rows.length });

  // KPI
  const matchRate = rows.length
    ? Math.round((rows.length - delay.length) / rows.length * 100) : 0;
  anim(document.getElementById('v1'), matchRate, 600);

  // Daily Summary
  _updateSummaryCard(rows.length, delay.length, overstock.length, eveningItems.length);

  // 인수인계 메모 저장
  const memos = rows.filter(r => r.note && r.note.trim());
  if (memos.length) {
    saveHandoverMemos(memos.map(r => ({
      item: r.item, note: r.note,
      duty: window._currentMeta?.duty || ''
    })));
    renderHandoverBanner();
  }

  // localStorage 저장
  const meta = window._currentMeta || {};
  const key  = `upload_${meta.date||'unknown'}_${meta.doctype||'unknown'}_${meta.duty||'unknown'}`;
  localStorage.setItem(key, JSON.stringify({
    meta, rows,
    original:    window._ocrOriginal || [],
    editCount:   window._editCount   || 0,
    confirmedAt: new Date().toISOString(),
    stats: { total: rows.length, delay: delay.length,
             overstock: overstock.length, evening: eveningItems.length }
  }));

  // Top5 갱신 + 내역 갱신
  buildTop5();
  renderUploadHistory();

  // 경고 beep
  if (delay.length > 0 || overstock.length > 0) playBeep(660, 0.18);

  const _ocrStatusEl = document.getElementById('ocr-status');
  if (_ocrStatusEl) _ocrStatusEl.textContent =
    `✓ ${rows.length}건 확정 · 지연/미처리 ${delay.length}건 · 이브닝 정산 ${eveningItems.length}건`;
  document.getElementById('last-updated').textContent =
    '최종 업데이트: ' + new Date().toLocaleString('ko-KR');
}

function _updateSummaryCard(total, delayCount, overstockCount, eveningCount) {
  const today = new Date().toISOString().slice(0,10);
  const prev  = JSON.parse(localStorage.getItem('daily_summary_'+today) || '{"uploads":0,"extracted":0}');
  const data  = { uploads: (prev.uploads||0)+1, extracted: (prev.extracted||0)+total };
  localStorage.setItem('daily_summary_'+today, JSON.stringify(data));
  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('sum-uploads',    data.uploads);
  s('sum-extracted',  data.extracted);
  s('sum-needs-review', delayCount);
  s('sum-overstock',  overstockCount);
  s('sum-evening',    eveningCount);
}

/* ─── Settings Loader ────────────────────────────────────── */
const SETTINGS_KEY = 'eicu_settings';
const SETTING_DEFAULTS = {
  duty: { D:'07:00', E:'15:00', N:'23:00' },
  o2_price: 9,
  unit_prices: { vent:150, crrt:300, pump:50 }
};

function loadAppSettings() {
  try {
    return Object.assign({}, SETTING_DEFAULTS, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch(e) { return SETTING_DEFAULTS; }
}

/* ─── Phase 2-A: Duty Alarm (개선) ──────────────────────── */
// 마감 시각 = 다음 교대 시작 30분 전
function _getDutyAlarmTimes() {
  const s = loadAppSettings();
  const duty = s.duty || SETTING_DEFAULTS.duty;
  // 마감 30분 전 = 다음 교대 시작 - 30분
  function sub30(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m - 30;
    const nh = Math.floor(((total % 1440) + 1440) % 1440 / 60);
    const nm = ((total % 1440) + 1440) % 1440 % 60;
    return `${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`;
  }
  return { D: sub30(duty.E), E: sub30(duty.N), N: sub30(duty.D) };
}

// 미처리 타이머 / 미체크 항목 집계
function _getPendingSummary() {
  const timers = Object.values(_timerState).filter(s => s.intervalId).length;
  const chkItems = JSON.parse(localStorage.getItem('checklist_' + _TODAY) || '{}');
  const totalChk = 8; // CHECKLIST_ITEMS.length
  const doneChk  = Object.values(chkItems).filter(v => v.done).length;
  const pending  = totalChk - doneChk;
  return { timers, pendingChk: pending };
}

const DUTY_END_TIMES = { day:'14:30', evening:'22:30', night:'06:30' }; // legacy fallback

function checkDutyAlarm() {
  const now   = new Date();
  const hhmm  = now.toTimeString().slice(0, 5);
  const today = now.toISOString().slice(0, 10);
  const alarmTimes = _getDutyAlarmTimes();

  Object.entries(alarmTimes).forEach(([duty, alarmTime]) => {
    if (hhmm !== alarmTime) return;
    // duty: 'D'/'E'/'N' → short + full name 모두 체크 (OCR은 day/evening/night, CSV는 csv)
    const dutyVariants = {
      D: ['d','day'], E: ['e','evening'], N: ['n','night']
    }[duty] || [duty.toLowerCase()];
    const confirmed = ['bulchul','ganhocheo','other','compare'].some(doc =>
      dutyVariants.some(dv => localStorage.getItem(`upload_${today}_${doc}_${dv}`)) ||
      localStorage.getItem(`upload_${today}_${doc}_csv`)
    );
    if (!confirmed) {
      const { timers, pendingChk } = _getPendingSummary();
      _showDutyToast(duty, timers, pendingChk);
    }
  });
}

function _showDutyToast(duty, pendingTimers, pendingChk) {
  const labels = { D:'Day', E:'Evening', N:'Night' };
  const msg = `⏰ ${labels[duty]} 교대 마감 30분 전\n미처리 타이머 ${pendingTimers}개 · 미체크 항목 ${pendingChk}개`;

  // 토스트 UI
  showToast(msg, 'warn', 8000);

  // 브라우저 Notification API
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('EICU QI Monitor', {
      body: msg,
      icon: '/static/favicon.ico'
    });
  }

  // fallback: 기존 모달
  const el  = document.getElementById('duty-alarm-modal');
  const msgEl = document.getElementById('duty-alarm-msg');
  if (el && msgEl) {
    msgEl.innerHTML = `인수인계 30분 전입니다.<br><strong>${labels[duty]} 근무 코스트 누락 점검</strong> 서류가 아직 확정되지 않았습니다.<br><br><span style="font-size:.82rem;color:var(--muted)">미처리 타이머 ${pendingTimers}개 · 미체크 항목 ${pendingChk}개</span>`;
    el.style.display = 'flex';
  }
}

// ── 토스트 알림 공통 함수 ────────────────────────────────
function showToast(msg, type='info', duration=4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const colorMap = {
    info:  { bg:'var(--pri-hl)', border:'var(--pri)', color:'var(--pri)' },
    warn:  { bg:'var(--warn-hl)', border:'var(--warn)', color:'var(--warn)' },
    error: { bg:'var(--err-hl)', border:'var(--err)', color:'var(--err)' },
    ok:    { bg:'var(--ok-hl)', border:'var(--ok)', color:'var(--ok)' },
  };
  const c = colorMap[type] || colorMap.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background:${c.bg};border:1px solid ${c.border};color:${c.color};
    border-radius:var(--r-md);padding:.65rem 1rem;font-size:.82rem;
    box-shadow:0 4px 16px rgba(0,0,0,.15);pointer-events:auto;
    max-width:320px;white-space:pre-line;line-height:1.5;
    opacity:0;transition:opacity 0.3s;cursor:pointer`;
  toast.textContent = msg;
  toast.onclick = () => toast.remove();

  container.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

setInterval(checkDutyAlarm, 60000);

/* ─── Phase 2-B: Audio Beep ─────────────────────────────── */
function playBeep(freq=880, dur=0.15, vol=0.3) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}

/* ─── Phase 2-C: Custom MAX Settings ────────────────────── */
const MAX_KEY = 'custom_max_settings';

function loadMaxSettings() {
  return JSON.parse(localStorage.getItem(MAX_KEY) || '{}');
}

function renderMaxList() {
  const settings = loadMaxSettings();
  const list     = document.getElementById('max-list');
  if (!list) return;
  list.innerHTML = Object.entries(settings).map(([item, qty]) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;
      padding:.375rem .625rem;background:var(--surf2);border-radius:var(--r-sm);font-size:.85rem">
      <span>${item}</span>
      <span style="display:flex;gap:.5rem;align-items:center">
        <span style="font-family:var(--fm);color:var(--muted)">MAX: ${qty}</span>
        <button onclick="removeMaxSetting('${item.replace(/'/g,"\\'")}');event.stopPropagation()"
          style="color:var(--err);font-size:.7rem;background:none;border:none;cursor:pointer">✕</button>
      </span>
    </div>`
  ).join('') || '<p style="color:var(--muted);font-size:.8rem;padding:.25rem">설정된 항목 없음</p>';

  // 라벨 인쇄 버튼 표시 여부
  const btn = document.getElementById('print-label-btn');
  if (btn) btn.style.display = Object.keys(settings).length ? '' : 'none';
}

function addMaxSetting() {
  const item = document.getElementById('max-item-name')?.value.trim();
  const qty  = parseInt(document.getElementById('max-item-qty')?.value);
  if (!item || !qty || qty < 1) return;
  const s = loadMaxSettings(); s[item] = qty;
  localStorage.setItem(MAX_KEY, JSON.stringify(s));
  document.getElementById('max-item-name').value = '';
  document.getElementById('max-item-qty').value  = '';
  renderMaxList();
}

function removeMaxSetting(item) {
  const s = loadMaxSettings(); delete s[item];
  localStorage.setItem(MAX_KEY, JSON.stringify(s));
  renderMaxList();
}

function openMaxSettings() {
  renderMaxList();
  const m = document.getElementById('max-settings-modal');
  if (m) m.style.display = 'flex';
}

/* ─── Phase 2-D: Weekly Top 5 ───────────────────────────── */
function buildTop5() {
  const counts = {};
  const today  = new Date();
  // 최근 7일 모든 upload_* 키 스캔
  const allUploadKeys = Object.keys(localStorage).filter(k => k.startsWith('upload_'));
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 7);
  allUploadKeys.forEach(key => {
    try {
      const parts = key.split('_');
      const ds = parts[1];
      if (!ds || new Date(ds) < cutoff) return;
      const { rows = [] } = JSON.parse(localStorage.getItem(key) || '{}');
      rows.filter(r => r.undelivered_qty > 0 || (r.order_qty > 0 && r.actual_qty < r.order_qty))
          .forEach(r => { if(r.item) counts[r.item] = (counts[r.item]||0)+1; });
    } catch(e) {}
  });
  const top5   = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCnt = top5[0]?.[1] || 1;
  const panel  = document.getElementById('top5-list');
  if (!panel) return;
  if (!top5.length) {
    panel.innerHTML = '<div style="color:var(--ok);font-size:.8rem;padding:.75rem;font-weight:600">✓ 최근 7일 누락 항목 없음</div>';
    return;
  }
  panel.innerHTML = top5.map(([item, cnt], rank) => {
    const pct   = Math.round(cnt / maxCnt * 100);
    const color = rank === 0 ? 'var(--err)' : rank <= 1 ? 'var(--warn)' : 'var(--ok)';
    return `<div class="prog-item">
      <div class="prog-row">
        <span class="prog-lbl">${rank+1}위 · ${item}</span>
        <span class="prog-val" style="color:${color}">${cnt}회</span>
      </div>
      <div class="prog-bg"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

/* ─── 업로드 내역 조회/삭제 ─────────────────────────────── */
function renderUploadHistory() {
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith('upload_'))
    .sort().reverse();

  const list  = document.getElementById('upload-history-list');
  const empty = document.getElementById('upload-history-empty');
  const sub   = document.getElementById('history-sub');
  if (!list) return;

  if (!keys.length) {
    list.innerHTML  = '';
    list.style.display  = 'none';
    if (empty) empty.style.display = 'block';
    if (sub)   sub.textContent = '업로드 내역 없음';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.style.display = 'flex';
  if (sub) sub.textContent = `총 ${keys.length}건 저장됨`;

  const DOCTYPE_LABEL = { bulchul:'불출증', ganhocheo:'간호처방집계', compare:'비교분석', other:'기타' };
  const DUTY_LABEL    = { day:'Day', evening:'Evening', night:'Night', D:'Day', E:'Evening', N:'Night' };

  list.innerHTML = keys.map(key => {
    // key = upload_DATE_DOCTYPE_DUTY
    const parts = key.split('_');
    const date    = parts[1] || '';
    const doctype = parts[2] || '';
    const duty    = parts[3] || '';

    let rowCount = 0, confirmedAt = '';
    try {
      const d = JSON.parse(localStorage.getItem(key) || '{}');
      rowCount    = d.rows?.length || d.stats?.total || 0;
      confirmedAt = d.confirmedAt ? new Date(d.confirmedAt).toLocaleString('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    } catch(e) {}

    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;background:var(--surf2);border-radius:var(--r-sm);gap:.5rem;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:.75rem;flex:1;min-width:0">
        <span style="font-size:.72rem;font-weight:700;background:var(--pri-hl);color:var(--pri);padding:2px 8px;border-radius:99px;white-space:nowrap">${date}</span>
        <span style="font-size:.78rem;font-weight:600">${DOCTYPE_LABEL[doctype]||doctype}</span>
        <span style="font-size:.73rem;color:var(--muted)">${DUTY_LABEL[duty]||duty}</span>
        <span style="font-size:.72rem;color:var(--faint);font-family:var(--fm)">${rowCount}건${confirmedAt?' · '+confirmedAt:''}</span>
      </div>
      <div style="display:flex;gap:.35rem;flex-shrink:0">
        <button class="btn btn-ghost" style="font-size:.73rem;padding:.2rem .5rem" onclick="viewUploadDetail('${key}')">🔍 조회</button>
        <button class="btn btn-ghost" style="font-size:.73rem;padding:.2rem .5rem;color:var(--pur);border-color:var(--pur)" onclick="reEditFromHistory('${key}')">✏️ 수정</button>
        <button class="btn btn-ghost" style="font-size:.73rem;padding:.2rem .5rem;color:var(--err);border-color:var(--err)" onclick="deleteUploadRecord('${key}')">🗑 삭제</button>
      </div>
    </div>`;
  }).join('');
}

function viewUploadDetail(key) {
  const raw = localStorage.getItem(key);
  if (!raw) { alert('데이터를 찾을 수 없습니다.'); return; }

  let data;
  try { data = JSON.parse(raw); } catch(e) { alert('데이터 파싱 오류'); return; }

  const parts = key.split('_');
  const DOCTYPE_LABEL = { bulchul:'불출증', ganhocheo:'간호처방집계', compare:'비교분석', other:'기타' };
  const DUTY_LABEL    = { day:'Day', evening:'Evening', night:'Night' };

  document.getElementById('hv-title').textContent =
    `${parts[1]} · ${DOCTYPE_LABEL[parts[2]]||parts[2]} · ${DUTY_LABEL[parts[3]]||parts[3]}`;
  document.getElementById('hv-meta').textContent =
    `총 ${data.rows?.length||0}건${data.confirmedAt?' · 확정: '+new Date(data.confirmedAt).toLocaleString('ko-KR'):''}${data.meta?.memo?' · 메모: '+data.meta.memo:''}`;

  const tbody = document.getElementById('hv-tbody');
  const rows  = data.rows || [];
  tbody.innerHTML = rows.length
    ? rows.map(r => `<tr>
        <td>${r.item||''}</td><td>${r.unit||''}</td>
        <td style="text-align:right">${r.order_qty??''}</td>
        <td style="text-align:right">${r.delivered_qty??''}</td>
        <td style="text-align:right;color:${r.undelivered_qty>0?'var(--err)':'inherit'}">${r.undelivered_qty??''}</td>
        <td style="text-align:right">${r.actual_qty??''}</td>
        <td style="font-size:.75rem;color:var(--muted)">${r.note||''}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:1rem">행 데이터 없음</td></tr>';

  const reEditBtn = document.getElementById('hv-reedit-btn');
  if (reEditBtn) reEditBtn.onclick = () => {
    document.getElementById('historyViewModal').style.display = 'none';
    reEditFromHistory(key);
  };
  document.getElementById('historyViewModal').style.display = 'flex';
}

function reEditFromHistory(key) {
  const raw = localStorage.getItem(key);
  if (!raw) { alert('데이터를 찾을 수 없습니다.'); return; }
  let data;
  try { data = JSON.parse(raw); } catch(e) { alert('데이터 파싱 오류'); return; }
  const rows = data.rows || [];
  if (!rows.length) { alert('저장된 행 데이터가 없습니다.'); return; }

  // 메타 복원
  const parts = key.split('_');
  if (parts[1]) document.getElementById('meta-date') && (document.getElementById('meta-date').value = parts[1]);
  if (data.meta) {
    const duty = data.meta.duty || parts[3] || '';
    const el = document.getElementById('meta-duty');
    if (el) el.value = duty;
    const memo = document.getElementById('meta-memo');
    if (memo) memo.value = data.meta.memo || '';
  }

  // OCR 테이블로 로드 후 스크롤
  renderOcrTable(rows, false);
  document.getElementById('ocr-result-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('업로드 내역을 불러왔습니다. 수정 후 "분석 확정"을 눌러주세요.', 'ok', 3500);
}

function deleteUploadRecord(key) {
  if (!confirm(`이 업로드 기록을 삭제하시겠습니까?\n${key}`)) return;
  localStorage.removeItem(key);
  renderUploadHistory();
  buildTop5();
  showToast('업로드 기록이 삭제되었습니다.', 'ok', 2500);
}

function clearAllUploadsFromDashboard() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('upload_'));
  if (!keys.length) { alert('삭제할 업로드 기록이 없습니다.'); return; }
  if (!confirm(`업로드 기록 ${keys.length}건을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
  keys.forEach(k => localStorage.removeItem(k));
  renderUploadHistory();
  buildTop5();
  initEmptyState();
  showToast(`${keys.length}건 삭제 완료`, 'warn', 3000);
}

/* ─── Phase 2-E: Handover Memo ──────────────────────────── */
const HANDOVER_KEY = 'handover_memos';

function saveHandoverMemos(items) {
  const now      = Date.now();
  const existing = JSON.parse(localStorage.getItem(HANDOVER_KEY) || '[]');
  const fresh    = existing.filter(m => m.expires > now);
  const newMemos = items.map(m => ({ ...m, expires: now + 24*60*60*1000 }));
  localStorage.setItem(HANDOVER_KEY, JSON.stringify([...fresh, ...newMemos]));
}

function renderHandoverBanner() {
  const now   = Date.now();
  const memos = JSON.parse(localStorage.getItem(HANDOVER_KEY) || '[]')
                  .filter(m => m.expires > now);
  const el    = document.getElementById('handover-banner');
  const items = document.getElementById('handover-items');
  if (!el || !items) return;
  if (!memos.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  const dutyL = { day:'Day', evening:'Evening', night:'Night' };
  items.innerHTML = memos.map(m =>
    `<div style="margin-bottom:.2rem">
      · <strong>${m.item}</strong>: ${m.note}
      <span style="color:var(--faint);font-size:.65rem;margin-left:.4rem">(${dutyL[m.duty]||m.duty} 듀티)</span>
    </div>`
  ).join('');
}

function clearHandover() {
  localStorage.removeItem(HANDOVER_KEY);
  const el = document.getElementById('handover-banner');
  if (el) el.style.display = 'none';
}

/* ─── Phase 2-F: Print Labels ───────────────────────────── */
function openPrintLabels() {
  const settings = loadMaxSettings();
  if (!Object.keys(settings).length) {
    alert('⚙️ MAX 설정에서 품목을 먼저 등록하세요.'); return;
  }
  const area = document.getElementById('print-label-area');
  if (!area) return;
  area.innerHTML = Object.entries(settings).map(([item, qty]) =>
    `<div class="label-card">
      <div class="label-item">${item}</div>
      <div class="label-max">MAX: ${qty}개</div>
      <div class="label-warn">⚠️ 초과 적재 금지</div>
    </div>`
  ).join('');
  window.print();
}

/* ─── Init ───────────────────────────────────────────────── */
// 체크리스트 이벤트 위임 (동적 HTML에서도 클릭 동작)
(function(){
  const list = document.getElementById('chk-list');
  if(list) list.addEventListener('click', e => {
    const row = e.target.closest('[data-chk-idx]');
    if(row) toggleCheck(Number(row.dataset.chkIdx));
  });
})();

initEmptyState();
loadTrend('weekly');
loadChecklistLocal();
renderFlowTable();
renderHandoverBanner();
buildTop5();
renderMaxList();
renderUploadHistory();
loadIncidents();

// meta-date 기본값 오늘
const _md = document.getElementById('meta-date');
if (_md) _md.value = new Date().toISOString().slice(0,10);

// 오늘 Daily Summary 복원
const _todayKey = 'daily_summary_' + new Date().toISOString().slice(0,10);
const _ds = JSON.parse(localStorage.getItem(_todayKey) || 'null');
if (_ds) {
  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('sum-uploads',   _ds.uploads   || 0);
  s('sum-extracted', _ds.extracted || 0);
}

/* ══════════════════════════════════════════════════════════
   Phase 4 : 실 사용 편의 기능
══════════════════════════════════════════════════════════ */

// ── 공통 유틸 ──────────────────────────────────────────────
const _TODAY = new Date().toISOString().slice(0, 10);

function _timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function _formatHMS(sec) {
  const h = Math.floor(sec / 3600).toString().padStart(2, '0');
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ── FiO₂ → Flow 변환 ───────────────────────────────────────
const FIO2_MAP = {21:0, 24:1, 28:2, 31:3, 35:4, 40:6, 44:8, 50:10, 60:12};

function fio2ToFlow(fio2) {
  const keys = Object.keys(FIO2_MAP).map(Number).sort((a, b) => a - b);
  if (fio2 <= keys[0]) return FIO2_MAP[keys[0]];
  if (fio2 >= keys[keys.length - 1]) return FIO2_MAP[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i], hi = keys[i + 1];
    if (fio2 >= lo && fio2 <= hi) {
      const r = (fio2 - lo) / (hi - lo);
      return +(FIO2_MAP[lo] + r * (FIO2_MAP[hi] - FIO2_MAP[lo])).toFixed(1);
    }
  }
  return 0;
}

// ── 1. 연속처치 타이머 ─────────────────────────────────────────────
// 단가: 산소(원/L, 10L당 9원 → 원/L = 0.9), 나머지(원/시간)
const TIMER_UNIT_PRICES = { '산소': 0.9, '인공호흥기': 150, 'CRRT': 300, '정주펜프': 50 };

let _timerState = {}; // { cardId: { intervalId, startEpoch, flow, patientId, item } }

function _saveActiveTimers() {
  const active = Object.entries(_timerState).map(([cardId, s]) => ({
    cardId, patientId: s.patientId, item: s.item, flow: s.flow, startEpoch: s.startEpoch
  }));
  localStorage.setItem('active_timers', JSON.stringify(active));
}

function openAddTimerModal() {
  document.getElementById('addTimerModal').style.display = 'flex';
}
function closeAddTimerModal() {
  document.getElementById('addTimerModal').style.display = 'none';
}

function _buildTimerCardHtml(cardId, patientId, item, flow) {
  return `
    <div style="font-weight:700;color:var(--primary,#3b82f6);margin-bottom:.2rem">${patientId}</div>
    <div style="font-size:.75rem;color:var(--muted);margin-bottom:.25rem">${item}${item==='산소'?` · ${flow}L/min`:''}</div>
    <div id="${cardId}-badge" style="font-size:.68rem;color:var(--warn);margin-bottom:.25rem;min-height:.9rem"></div>
    <div id="${cardId}-clock" style="font-family:'JetBrains Mono',monospace;font-size:1.4rem;margin-bottom:.5rem">00:00:00</div>
    <div style="display:flex;gap:.35rem;justify-content:center">
      <button class="upload-btn" style="font-size:.75rem;padding:.25rem .6rem" onclick="startTimer('${cardId}','${patientId}','${item}',${flow})">▶ 시작</button>
      <button class="btn btn-ghost" style="font-size:.75rem;padding:.25rem .6rem;border:1px solid var(--err,#ef4444);color:var(--err,#ef4444)" onclick="stopTimer('${cardId}','${patientId}','${item}',${flow})">■ 종료</button>
      <button class="btn btn-ghost" style="font-size:.75rem;padding:.25rem .5rem" onclick="removeTimerCard('${cardId}')">✕</button>
    </div>`;
}

function addTimerCard() {
  const patientId = document.getElementById('timer-patient-id').value.trim();
  const item = document.getElementById('timer-item-select').value;
  const flow = parseFloat(document.getElementById('timer-flow').value) || 3;
  if (!patientId) { alert('환자 ID를 입력하세요.'); return; }

  const cardId = `tcard_${Date.now()}`;
  const card = document.createElement('div');
  card.id = cardId;
  card.style.cssText = 'background:var(--surf2);border:1px solid var(--bdr);border-radius:var(--r-sm);padding:.75rem;text-align:center;';
  card.innerHTML = _buildTimerCardHtml(cardId, patientId, item, flow);
  document.getElementById('timer-cards').appendChild(card);
  closeAddTimerModal();
  document.getElementById('timer-patient-id').value = '';
}

function _getShiftBoundaryEpochs() {
  const s = loadAppSettings();
  const duty = s.duty || { D:'07:00', E:'15:00', N:'23:00' };
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(duty).map(t => new Date(`${today}T${t}:00`).getTime());
}

function startTimer(cardId, patientId, item, flow) {
  if (_timerState[cardId]?.intervalId) return;
  const startEpoch = _timerState[cardId]?.startEpoch || Date.now();
  _timerState[cardId] = { startEpoch, flow, patientId, item };
  _saveActiveTimers();

  _timerState[cardId].intervalId = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startEpoch) / 1000);
    const el = document.getElementById(`${cardId}-clock`);
    if (el) el.textContent = _formatHMS(elapsed);
    const badge = document.getElementById(`${cardId}-badge`);
    if (badge) {
      const boundaries = _getShiftBoundaryEpochs();
      const crossed = boundaries.some(b => b > startEpoch && b < Date.now());
      badge.textContent = crossed ? '⚠️ 교대 이월 중' : '';
    }
  }, 1000);
  const el = document.getElementById(`${cardId}-clock`);
  if (el) el.textContent = _formatHMS(Math.floor((Date.now() - startEpoch) / 1000));
}

function stopTimer(cardId, patientId, item, flow) {
  const state = _timerState[cardId];
  if (!state?.intervalId) { alert('먼저 ▶ 시작 버튼을 눌러주세요.'); return; }
  clearInterval(state.intervalId);

  const prices = (typeof _getUnitPrices === 'function') ? _getUnitPrices() : {};
  Object.assign(TIMER_UNIT_PRICES, prices);

  const endEpoch = Date.now();
  const durationMin = (endEpoch - state.startEpoch) / 60000;
  const startTime = new Date(state.startEpoch).toTimeString().slice(0, 5);
  const endTime   = new Date(endEpoch).toTimeString().slice(0, 5);

  let charge = 0;
  if (item === '산소') {
    const totalL = (flow || 3) * durationMin;
    charge = Math.round(totalL * TIMER_UNIT_PRICES['산소']);
  } else {
    charge = Math.round((durationMin / 60) * (TIMER_UNIT_PRICES[item] || 0));
  }

  alert(`✅ 종료 요약\n환자: ${patientId}\n처치: ${item}\n${startTime} → ${endTime}\n경과: ${Math.round(durationMin)}분\n수가: ${charge.toLocaleString()}원`);

  const tbody = document.getElementById('timer-settle-body');
  if (tbody) {
    const row = tbody.insertRow();
    row.innerHTML = `<td>${patientId}</td><td>${item}</td><td>${startTime}</td><td>${endTime}</td><td>${Math.round(durationMin)}</td><td>${charge.toLocaleString()}</td>`;
  }

  const key = `timers_${_TODAY}`;
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push({ patientId, item, start: startTime, end: endTime, durationMin: Math.round(durationMin), charge });
  localStorage.setItem(key, JSON.stringify(arr));

  delete _timerState[cardId];
  _saveActiveTimers();
}

function removeTimerCard(cardId) {
  if (_timerState[cardId]?.intervalId) clearInterval(_timerState[cardId].intervalId);
  delete _timerState[cardId];
  _saveActiveTimers();
  const el = document.getElementById(cardId);
  if (el) el.remove();
}

// 오늘 완료 타이머 기록 복원
(function(){
  const saved = JSON.parse(localStorage.getItem(`timers_${_TODAY}`) || '[]');
  saved.forEach(t => {
    const tbody = document.getElementById('timer-settle-body');
    if (!tbody) return;
    const row = tbody.insertRow();
    row.innerHTML = `<td>${t.patientId}</td><td>${t.item}</td><td>${t.start}</td><td>${t.end}</td><td>${t.durationMin}</td><td>${t.charge.toLocaleString()}</td>`;
  });
})();

// 진행 중인 활성 타이머 복원 (새로고침 후 이어서 진행)
(function(){
  const active = JSON.parse(localStorage.getItem('active_timers') || '[]');
  if (!active.length) return;
  active.forEach(t => {
    const container = document.getElementById('timer-cards');
    if (!container) return;
    const card = document.createElement('div');
    card.id = t.cardId;
    card.style.cssText = 'background:var(--surf2);border:2px solid var(--warn);border-radius:var(--r-sm);padding:.75rem;text-align:center;';
    card.innerHTML = _buildTimerCardHtml(t.cardId, t.patientId, t.item, t.flow);
    container.appendChild(card);
    _timerState[t.cardId] = { startEpoch: t.startEpoch, flow: t.flow, patientId: t.patientId, item: t.item };
    startTimer(t.cardId, t.patientId, t.item, t.flow);
  });
  if (active.length) showToast(`진행 중인 타이머 ${active.length}개가 복원되었습니다.`, 'warn', 4000);
})();

// ── 2. 산소 수가 계산기 (단일 구간 입력 → 시간 단위 자동 분할) ──
let _o2Mode = 'flow'; // 'flow' | 'fio2'

function setO2Mode(mode) {
  _o2Mode = mode;
  const lbl = document.getElementById('o2-val-label');
  if (lbl) lbl.textContent = mode === 'fio2' ? 'FiO₂ (%)' : 'Flow (L/min)';
  const flowBtn = document.getElementById('btn-mode-flow');
  const fio2Btn = document.getElementById('btn-mode-fio2');
  if (flowBtn) { flowBtn.className = mode === 'flow' ? 'upload-btn' : 'btn btn-ghost'; flowBtn.style.cssText = 'font-size:.8rem;padding:.3rem .7rem'; }
  if (fio2Btn) { fio2Btn.className = mode === 'fio2' ? 'upload-btn' : 'btn btn-ghost'; fio2Btn.style.cssText = 'font-size:.8rem;padding:.3rem .7rem'; }
  const valInput = document.getElementById('o2-flow-val');
  if (valInput) valInput.placeholder = mode === 'fio2' ? 'FiO₂ (%)' : '예: 0.5';
}

function _minutesToTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function calcO2Simple() {
  const patientId = (document.getElementById('o2-patient')?.value || '').trim() || '환자';
  const startStr  = document.getElementById('o2-start-time')?.value;
  const endStr    = document.getElementById('o2-end-time')?.value;
  const rawVal    = parseFloat(document.getElementById('o2-flow-val')?.value);

  if (!startStr || !endStr) { alert('시작 시간과 종료 시간을 모두 입력하세요.'); return; }
  if (isNaN(rawVal) || rawVal <= 0) { alert('Flow 또는 FiO₂ 값을 입력하세요.'); return; }

  const flow = _o2Mode === 'fio2' ? fio2ToFlow(rawVal) : rawVal;
  let startMin = _timeToMinutes(startStr);
  let endMin   = _timeToMinutes(endStr);
  if (endMin <= startMin) endMin += 1440; // 자정 넘김

  const _o2Price = loadAppSettings().o2_price || 9;
  const rows = [];
  let cur = startMin;
  while (cur < endMin) {
    // 시간 단위 경계로 분할 (첫 구간은 다음 정시까지, 이후는 60분 단위)
    const nextHour = Math.ceil((cur + 1) / 60) * 60; // 다음 정시
    const hourEnd  = Math.min(nextHour, endMin);
    const mins     = hourEnd - cur;
    const liters   = parseFloat((flow * mins).toFixed(2));
    const charge   = Math.round((liters / 10) * _o2Price);
    rows.push({
      segStart: _minutesToTime(cur % 1440),
      segEnd:   _minutesToTime(hourEnd % 1440),
      mins, flow, liters, charge
    });
    cur = hourEnd;
  }

  const tbody = document.getElementById('o2-result-body');
  const tfoot = document.getElementById('o2-result-foot');
  if (!tbody || !tfoot) return;

  let sumL = 0, sumCharge = 0;
  tbody.innerHTML = rows.map((r, i) => {
    sumL += r.liters;
    sumCharge += r.charge;
    return `<tr>
      <td>${r.segStart}~${r.segEnd}</td>
      <td>${r.flow}</td>
      <td>${r.mins}</td>
      <td>${r.liters.toFixed(2)}</td>
      <td style="font-weight:600">${r.charge.toLocaleString()}</td>
    </tr>`;
  }).join('');

  tfoot.innerHTML = `<tr>
    <td colspan="3" style="font-weight:700">${patientId} 합계</td>
    <td style="font-weight:700">${sumL.toFixed(2)}L</td>
    <td style="font-weight:700;color:var(--ok)">${sumCharge.toLocaleString()}원</td>
  </tr>`;

  document.getElementById('o2-result-area').style.display = 'block';
  window._o2Summary = `[${patientId}] 산소 사용량: ${sumL.toFixed(2)}L / 수가: ${sumCharge.toLocaleString()}원`;
}

function copyO2Result() {
  if (!window._o2Summary) return;
  navigator.clipboard.writeText(window._o2Summary)
    .then(() => alert('복사됨 ✅\n' + window._o2Summary));
}

// ── 사용 매뉴얼 토글 ──────────────────────────────────────
function toggleManual() {
  const body = document.getElementById('manual-body');
  const icon = document.getElementById('manual-toggle-icon');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▼ 펼치기' : '▲ 접기';
}

// ── 3. 불일치 사례 수동 입력 ──────────────────────────────
function toggleIncidentForm() {
  const el = document.getElementById('incident-form-area');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function saveManualIncident() {
  const item     = document.getElementById('inc-item')?.value.trim();
  const cause    = document.getElementById('inc-cause')?.value;
  const shift    = document.getElementById('inc-shift')?.value;
  const priority = document.getElementById('inc-priority')?.value;
  if (!item) { alert('항목명을 입력하세요.'); return; }

  const incident = { id: Date.now(), item, cause, shift, priority, date: _TODAY, resolved: false };
  const arr = JSON.parse(localStorage.getItem('incidents_manual') || '[]');
  arr.push(incident);
  localStorage.setItem('incidents_manual', JSON.stringify(arr));

  _appendManualIncidentRow(incident);
  toggleIncidentForm();
  if (document.getElementById('inc-item')) document.getElementById('inc-item').value = '';
}

function _appendManualIncidentRow(inc) {
  const tbody = document.getElementById('incidents-body');
  if (!tbody) return;
  const row = document.createElement('tr');
  row.id = `inc-row-${inc.id}`;
  const priColor = inc.priority === '높음' ? 'var(--err,#ef4444)' : inc.priority === '중간' ? 'var(--warn,#f59e0b)' : 'var(--ok,#22c55e)';
  row.innerHTML = `
    <td style="cursor:pointer;text-decoration:${inc.resolved ? 'line-through' : 'none'}" onclick="toggleResolved(${inc.id})">${inc.item}</td>
    <td>${inc.cause}</td>
    <td>${inc.shift}</td>
    <td style="color:${priColor};font-weight:600">${inc.priority}</td>
    <td>${inc.resolved ? '✅ 해결됨' : '⏳ 미처리'}</td>`;
  tbody.appendChild(row);
}

function toggleResolved(id) {
  const arr = JSON.parse(localStorage.getItem('incidents_manual') || '[]');
  const inc = arr.find(i => i.id === id);
  if (!inc) return;
  inc.resolved = !inc.resolved;
  localStorage.setItem('incidents_manual', JSON.stringify(arr));

  const row = document.getElementById(`inc-row-${id}`);
  if (!row) return;
  row.cells[0].style.textDecoration = inc.resolved ? 'line-through' : 'none';
  row.cells[4].textContent = inc.resolved ? '✅ 해결됨' : '⏳ 미처리';
}

// 페이지 로드 시 복원
(function(){
  const arr = JSON.parse(localStorage.getItem('incidents_manual') || '[]');
  arr.forEach(inc => _appendManualIncidentRow(inc));
})();

// ── 4. CSV 정산표 다운로드 ────────────────────────────────
function downloadSettlementCSV() {
  const data = window._comparisonData;
  if (!data || !data.length) { alert('비교 데이터가 없습니다. 먼저 파일을 비교해주세요.'); return; }

  const shift   = prompt('교대를 입력하세요 (D / E / N):', 'D') || 'D';
  const dateStr = _TODAY.replace(/-/g, '');
  const filename = `정산표_${dateStr}_${shift}.csv`;

  const header = ['품목명', '처방수량', '출고량', '차이', '상태'];
  const rows = data.map(d => {
    const diff = d.prescribed - d.dispensed;
    const status = diff === 0 ? '일치' : diff < 0 ? '과다' : '누락';
    return [d.item, d.prescribed, d.dispensed, diff, status].join(',');
  });

  const csv  = '﻿' + [header.join(','), ...rows].join('\n'); // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── 5. COST 입력 가이드 ───────────────────────────────────
const GUIDE_DATA = {
  '산소': {
    when: '데이번 종료 전 or 이브닝 일괄 처리',
    ocs: 'O2 inhalation (산소흡입)',
    tips: ['Flow 변경 시마다 시작 시각 기록 필수', '이브닝에 구간별 합산 후 한 번에 입력', 'Nasal cannula ↔ 마스크 변경 시 처치 중단 후 재시작']
  },
  '인공호흡기': {
    when: '이브닝 일괄 (FiO₂ 변경 시 그 시점에 끊고 재개)',
    ocs: 'Mechanical ventilation (기계환기)',
    tips: ['FiO₂ 변경 전 반드시 기존 오더 종료', 'SIMV→PS 모드 변경도 오더 구분', '발관 시 즉시 종료 입력']
  },
  'CRRT': {
    when: '이브닝 일괄 or 회로 교환 시점에 끊고 재개',
    ocs: 'CRRT (지속성신대체요법)',
    tips: ['회로 응고로 중단 시 중단 시각 즉시 기록', '재개 시 새 오더로 시작', '24시간 연속 가동도 자정에 끊고 재개']
  },
  '지속정주': {
    when: '속도 변경 시 or 교대 종료 시',
    ocs: 'Continuous IV infusion',
    tips: ['속도(mL/h) 변경 시 이전 오더 종료', '동일 약물이라도 농도 변경 시 새 오더', '펌프 알람으로 중단된 경우 중단 시각 기록']
  },
  '드레싱': {
    when: '처치 직후 즉시 입력',
    ocs: 'Dressing change',
    tips: ['소독제·거즈 종류 변경 시 별도 항목으로', '응급 처치로 지연됐으면 교대 전 일괄 입력', '사이즈(소/중/대) 정확히 선택']
  },
  '수혈': {
    when: '수혈 시작 즉시 + 완료 시 종료',
    ocs: 'Blood transfusion',
    tips: ['혈액 백 번호 기록 필수', '부작용 발생 시 중단 후 별도 기록', 'FFP/RBC/PLT 각각 별도 오더']
  }
};

let _guideOpen = false;

function toggleGuidePanel() {
  _guideOpen = !_guideOpen;
  const panel = document.getElementById('guide-panel');
  if (!panel) return;
  panel.style.display = _guideOpen ? 'block' : 'none';
  if (_guideOpen) renderGuideTab('산소');
}

function renderGuideTab(key) {
  const d = GUIDE_DATA[key];
  if (!d) return;
  document.querySelectorAll('.guide-tab').forEach(t => {
    const isActive = t.dataset.key === key;
    t.className = isActive ? 'guide-tab upload-btn' : 'guide-tab btn btn-ghost';
    t.style.cssText = 'font-size:.75rem;padding:.25rem .6rem';
  });
  const tips = d.tips.map(t => `<li style="margin-bottom:.2rem">${t}</li>`).join('');
  const gc = document.getElementById('guide-content');
  if (!gc) return;
  gc.innerHTML = `
    <div style="margin-bottom:.5rem"><span style="background:var(--info,#0ea5e9);color:#fff;border-radius:4px;padding:.1rem .4rem;font-size:.73rem">언제 끊는가</span>
      <span style="margin-left:.4rem">${d.when}</span></div>
    <div style="margin-bottom:.5rem"><span style="background:var(--muted,#6b7280);color:#fff;border-radius:4px;padding:.1rem .4rem;font-size:.73rem">OCS 코드</span>
      <span style="margin-left:.4rem">${d.ocs}</span></div>
    <div><span style="background:var(--warn,#f59e0b);color:#fff;border-radius:4px;padding:.1rem .4rem;font-size:.73rem">자주 틀리는 케이스</span>
      <ul style="margin:.4rem 0 0 1rem;padding:0">${tips}</ul></div>`;
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('guide-tab')) {
    renderGuideTab(e.target.dataset.key);
  }
});

// ── 6. 미처리 항목 뱃지 카운터 ──────────────────────────
function updateIncidentBadge() {
  const arr = JSON.parse(localStorage.getItem('incidents_manual') || '[]');
  const cnt = arr.filter(i => !i.resolved).length;
  const badge = document.getElementById('nav-incident-badge');
  if (!badge) return;
  if (cnt > 0) {
    badge.textContent = cnt;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// saveManualIncident / toggleResolved 호출 후 뱃지 갱신되도록 원본 함수에 후처리
const _origSaveManualIncident = saveManualIncident;
window.saveManualIncident = function() {
  _origSaveManualIncident();
  updateIncidentBadge();
};
const _origToggleResolved = toggleResolved;
window.toggleResolved = function(id) {
  _origToggleResolved(id);
  updateIncidentBadge();
};

// 페이지 로드 시 뱃지 초기화
updateIncidentBadge();

// ── 7. TIMER_UNIT_PRICES 설정에서 동적 로드 ─────────────
function _getUnitPrices() {
  const s = loadAppSettings();
  return {
    '산소': (s.o2_price || 9) / 10,   // 원/L (10L당 단가 ÷ 10)
    '인공호흡기': s.unit_prices?.vent || 150,
    'CRRT':       s.unit_prices?.crrt || 300,
    '정주펌프':   s.unit_prices?.pump || 50,
  };
}


// ── 8. 환자별 처치 요약 카드 인쇄 ───────────────────────
function printHandoverCards() {
  const records = JSON.parse(localStorage.getItem(`timers_${_TODAY}`) || '[]');

  // 환자별 그룹핑
  const byPatient = {};
  records.forEach(r => {
    if (!byPatient[r.patientId]) byPatient[r.patientId] = [];
    byPatient[r.patientId].push(r);
  });

  let content = '<p style="color:#888;font-size:.8rem">정산된 처치 기록이 없습니다.</p>';
  if (records.length) {
    content = Object.entries(byPatient).map(([pid, recs]) => {
      const rows = recs.map(r =>
        `<tr>
          <td style="padding:4px 8px;border:1px solid #ddd">${r.item}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${r.start}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${r.end}</td>
          <td style="padding:4px 8px;border:1px solid #ddd">${r.durationMin}분</td>
          <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${r.charge.toLocaleString()}원</td>
        </tr>`
      ).join('');
      const total = recs.reduce((s, r) => s + r.charge, 0);
      return `
        <div style="border:1px solid #ccc;border-radius:6px;padding:10px;margin-bottom:10px;page-break-inside:avoid">
          <div style="font-weight:700;font-size:.9rem;margin-bottom:6px">🛏 ${pid}</div>
          <table style="width:100%;border-collapse:collapse;font-size:.8rem">
            <thead><tr style="background:#f5f5f5">
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">처치</th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">시작</th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">종료</th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">시간</th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:right">수가</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="font-weight:700;background:#f9f9f9">
              <td colspan="4" style="padding:4px 8px;border:1px solid #ddd">합계</td>
              <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${total.toLocaleString()}원</td>
            </tr></tfoot>
          </table>
        </div>`;
    }).join('');
  }

  // 체크리스트 데이터 포함
  const chkKey = 'checklist_' + _TODAY;
  const chkSaved = JSON.parse(localStorage.getItem(chkKey) || 'null');
  let chkHtml = '<p style="color:#888;font-size:.8rem">체크리스트 데이터가 없습니다.</p>';
  if (chkSaved) {
    const items = CHECKLIST_ITEMS.map((item, i) => {
      const done = chkSaved[i] === true;
      return `<tr>
        <td style="padding:4px 8px;border:1px solid #ddd">${item}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:center;font-weight:700;color:${done ? '#22c55e' : '#ef4444'}">${done ? '✓ 완료' : '✗ 미완료'}</td>
      </tr>`;
    }).join('');
    chkHtml = `<table style="width:100%;border-collapse:collapse;font-size:.8rem">
      <thead><tr style="background:#f5f5f5"><th style="padding:4px 8px;border:1px solid #ddd;text-align:left">항목</th><th style="padding:4px 8px;border:1px solid #ddd;width:80px">상태</th></tr></thead>
      <tbody>${items}</tbody>
    </table>`;
  }

  // 인수인계 메모
  const notes = JSON.parse(localStorage.getItem('handover_notes') || '[]');
  const notesHtml = notes.map(n => `• ${n.text}`).join('<br>') || '(없음)';

  const printArea = document.getElementById('handover-print-area');
  const printContent = document.getElementById('handover-print-content');
  const printChk = document.getElementById('handover-print-checklist');
  const printNotes = document.getElementById('handover-print-notes');
  const printDate = document.getElementById('handover-print-date');

  if (printArea && printContent) {
    printContent.innerHTML = content;
    if (printChk) printChk.innerHTML = chkHtml;
    if (printNotes) printNotes.innerHTML = notesHtml;
    if (printDate) printDate.textContent = new Date().toLocaleString('ko-KR') + ' · EICU 수가 인수인계';
    printArea.style.display = 'block';
    window.print();
    printArea.style.display = 'none';
  }
}

// ── 9. Two-Bin 재고 현황판 ────────────────────────────────
const TWOBIN_KEY = 'twobin_items';

function loadTwoBinItems() {
  return JSON.parse(localStorage.getItem(TWOBIN_KEY) || '[]');
}

function saveTwoBinItems(items) {
  localStorage.setItem(TWOBIN_KEY, JSON.stringify(items));
}

function openAddTwoBinModal() {
  document.getElementById('twoBinModal').style.display = 'flex';
}
function closeTwoBinModal() {
  document.getElementById('twoBinModal').style.display = 'none';
}

function addTwoBinItem() {
  const name = document.getElementById('tb-name')?.value.trim();
  const unit = document.getElementById('tb-unit')?.value.trim() || '개';
  const maxA = parseInt(document.getElementById('tb-maxA')?.value) || 10;
  const maxB = parseInt(document.getElementById('tb-maxB')?.value) || 5;
  if (!name) { alert('품목명을 입력하세요.'); return; }

  const items = loadTwoBinItems();
  items.push({ id: Date.now(), name, unit, maxA, maxB, curA: maxA, curB: maxB });
  saveTwoBinItems(items);
  renderTwoBin();
  closeTwoBinModal();
  ['tb-name','tb-unit','tb-maxA','tb-maxB'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

function updateTwoBinQty(id, bin, delta) {
  const items = loadTwoBinItems();
  const item = items.find(i => i.id === id);
  if (!item) return;
  const key = 'cur' + bin; // curA or curB
  item[key] = Math.max(0, (item[key] || 0) + delta);
  saveTwoBinItems(items);
  renderTwoBin();
}

function removeTwoBinItem(id) {
  if (!confirm('이 품목을 삭제하시겠습니까?')) return;
  saveTwoBinItems(loadTwoBinItems().filter(i => i.id !== id));
  renderTwoBin();
}

function resetTwoBinA(id) {
  const items = loadTwoBinItems();
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.curA = item.maxA;
  saveTwoBinItems(items);
  renderTwoBin();
  showToast(`${item.name} Bin A 보충 완료`, 'ok', 2500);
}

function renderTwoBin() {
  const items = loadTwoBinItems();
  const tbody = document.getElementById('twobin-body');
  const empty = document.getElementById('twobin-empty');
  const wrap  = document.getElementById('twobin-table-wrap');
  if (!tbody) return;

  if (!items.length) {
    if (wrap)  wrap.style.display  = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (wrap)  wrap.style.display  = 'block';
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = items.map(item => {
    const aRatio = item.maxA > 0 ? item.curA / item.maxA : 0;
    const bRatio = item.maxB > 0 ? item.curB / item.maxB : 0;
    const aEmpty = item.curA === 0;
    const bEmpty = item.curB === 0;
    const both   = aEmpty && bEmpty;

    let statusHtml, requestBtn;
    if (both) {
      statusHtml = `<span style="color:var(--err);font-weight:700">🔴 즉시 보충</span>`;
      requestBtn = `<a href="mailto:supply@hospital.kr?subject=[EICU 긴급보충] ${item.name}&body=Bin A+B 모두 소진. 즉시 보충 요청합니다." class="btn btn-ghost" style="font-size:.73rem;border-color:var(--err);color:var(--err);padding:.2rem .5rem">📧 긴급 요청</a>`;
    } else if (aEmpty) {
      statusHtml = `<span style="color:var(--warn);font-weight:600">🟡 Bin B 사용 중</span>`;
      requestBtn = `<a href="mailto:supply@hospital.kr?subject=[EICU 보충요청] ${item.name}&body=Bin A 소진. Bin B 사용 중. 정기 보충 요청합니다." class="btn btn-ghost" style="font-size:.73rem;padding:.2rem .5rem">📧 보충 요청</a>`;
    } else {
      statusHtml = `<span style="color:var(--ok)">🟢 정상</span>`;
      requestBtn = `<span style="font-size:.73rem;color:var(--faint)">—</span>`;
    }

    const barA = `<div style="display:flex;align-items:center;gap:.4rem">
      <button onclick="updateTwoBinQty(${item.id},'A',-1)" style="font-size:.8rem;color:var(--err);font-weight:700;padding:0 .2rem;border:1px solid var(--bdr);border-radius:3px">−</button>
      <div style="flex:1;background:var(--bdr);border-radius:3px;height:6px;min-width:48px">
        <div style="width:${Math.round(aRatio*100)}%;height:100%;background:${aEmpty?'var(--err)':aRatio<0.3?'var(--warn)':'var(--ok)'};border-radius:3px;transition:.3s"></div>
      </div>
      <span style="font-size:.73rem;font-family:var(--fm)">${item.curA}/${item.maxA}</span>
      <button onclick="updateTwoBinQty(${item.id},'A',1)" style="font-size:.8rem;color:var(--ok);font-weight:700;padding:0 .2rem;border:1px solid var(--bdr);border-radius:3px">+</button>
    </div>`;

    const barB = `<div style="display:flex;align-items:center;gap:.4rem">
      <button onclick="updateTwoBinQty(${item.id},'B',-1)" style="font-size:.8rem;color:var(--err);font-weight:700;padding:0 .2rem;border:1px solid var(--bdr);border-radius:3px">−</button>
      <div style="flex:1;background:var(--bdr);border-radius:3px;height:6px;min-width:48px">
        <div style="width:${Math.round(bRatio*100)}%;height:100%;background:${bEmpty?'var(--err)':bRatio<0.3?'var(--warn)':'var(--pur)'};border-radius:3px;transition:.3s"></div>
      </div>
      <span style="font-size:.73rem;font-family:var(--fm)">${item.curB}/${item.maxB}</span>
      <button onclick="updateTwoBinQty(${item.id},'B',1)" style="font-size:.8rem;color:var(--ok);font-weight:700;padding:0 .2rem;border:1px solid var(--bdr);border-radius:3px">+</button>
    </div>`;

    return `<tr style="${both ? 'background:var(--err-hl)' : aEmpty ? 'background:var(--warn-hl)' : ''}">
      <td style="font-weight:600">${item.name}</td>
      <td style="font-size:.75rem;color:var(--muted)">${item.unit}</td>
      <td style="min-width:140px">${barA}</td>
      <td style="min-width:140px">${barB}</td>
      <td>${statusHtml}</td>
      <td>${requestBtn}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost" style="font-size:.72rem;padding:.15rem .45rem" onclick="resetTwoBinA(${item.id})">🔄A보충</button>
        <button class="btn btn-ghost" style="font-size:.72rem;padding:.15rem .45rem;color:var(--err)" onclick="removeTwoBinItem(${item.id})">삭제</button>
      </td>
    </tr>`;
  }).join('');
}

// 페이지 로드 시 Two-Bin 렌더
renderTwoBin();

// ── 탭 전환 (반영 지연율 / 입력 기준표) ────────────────────
function switchTypeTab(tab) {
  ['delay','criteria'].forEach(t => {
    const btn   = document.getElementById('tab-' + t);
    const panel = document.getElementById('panel-' + t);
    const active = t === tab;
    if (btn)   { btn.classList.toggle('active', active); }
    if (panel) { panel.style.display = active ? '' : 'none'; }
  });
}

// ── localStorage 오래된 키 정리 (7일 초과) ─────────────────
(function _cleanOldStorage() {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const prefixes = ['upload_','checklist_','timers_','daily_summary_'];
  Object.keys(localStorage).forEach(key => {
    const matched = prefixes.some(p => key.startsWith(p));
    if (!matched) return;
    const datePart = key.replace(/^[^_]+_/, '');
    const d = new Date(datePart);
    if (!isNaN(d) && d.getTime() < cutoff) localStorage.removeItem(key);
  });
})();
