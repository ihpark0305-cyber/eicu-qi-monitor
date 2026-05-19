/* ─── Theme ─────────────────────────────────────────────── */
(function(){
  const t=document.querySelector('[data-theme-toggle]'),r=document.documentElement;
  t&&t.addEventListener('click',()=>{r.setAttribute('data-theme',r.getAttribute('data-theme')==='dark'?'light':'dark');});
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

/* ─── Load trend data from API ───────────────────────────── */
let currentPeriod='monthly';

async function loadTrend(period){
  currentPeriod=period;
  const res=await fetch(`/api/trend?period=${period}`);
  const d=await res.json();
  chart.data.labels=d.labels;
  chart.data.datasets[0].data=d.total;
  chart.data.datasets[1].data=d.continuous;
  chart.update('active');
  document.getElementById('chart-sub').textContent=d.sub;
  const k=d.kpi;
  anim(document.getElementById('v1'),k.match_rate,800);
  anim(document.getElementById('v2'),k.evening_rate,800);
  anim(document.getElementById('v3'),k.checklist_rate,800,'int');
  anim(document.getElementById('v4'),k.delay_cost,800,'money');
  const pLabel=k.period_label;
  ['v1-p','v2-p','v3-p','v4-p'].forEach(id=>document.getElementById(id).textContent=pLabel);
  document.getElementById('v1-d').textContent=(k.delta_match>0?'↑ +':'↓ ')+Math.abs(k.delta_match)+'%p';
  document.getElementById('v1-d').className=k.delta_match>0?'d-dn':'d-up';
  document.getElementById('v2-d').textContent=(k.delta_evening>0?'↑ +':'↓ ')+Math.abs(k.delta_evening)+'%p';
  document.getElementById('v2-d').className=k.delta_evening>0?'d-dn':'d-up';
  document.getElementById('v3-d').textContent=(k.delta_checklist>0?'↑ +':'↓ ')+Math.abs(k.delta_checklist)+'%p';
  document.getElementById('v4-d').textContent=(k.delta_delay_cost>0?'↑ +₩':'↓ ₩')+Math.abs(k.delta_delay_cost).toLocaleString();
  document.getElementById('v4-d').className=k.delta_delay_cost<0?'d-up':'d-dn';
  document.getElementById('v4-tgt').textContent=period==='weekly'?'이번 주 반영 지연 추정액':'입력-청구 반영 차이 추정액';

  // 연속형 항목 지연율이 높으면 항상 안내 알림 표시
  const alertBox=document.getElementById('alert-box');
  const alertTxt=document.getElementById('alert-text');
  if(k.evening_rate>5){
    alertBox.style.display='flex';
    alertTxt.innerHTML=`연속형 항목(산소·HFNC·인공호흡기)은 EMR 입력과 실제 전산 반영이 분리될 수 있어, <strong>이브닝 정산 확인이 필요합니다.</strong>`;
  } else {
    alertBox.style.display='flex';
    alertTxt.innerHTML='EMR 입력이 곧바로 청구 완료를 의미하지 않으므로, <strong>입력-반영 매칭 확인</strong>이 필요합니다.';
  }
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
  });
});

/* ─── Load checklist ─────────────────────────────────────── */
async function loadChecklist(){
  const res=await fetch('/api/checklist');
  const d=await res.json();
  document.getElementById('chk-meta').textContent=`${d.date} ${d.shift}`;
  document.getElementById('chk-count').textContent=`${d.completed} / ${d.total} 완료`;
  const ul=document.getElementById('chk-list');
  ul.innerHTML=d.items.map(item=>`
    <div class="chk">
      <div class="chk-ico ${item.done?'done':'pend'}">
        ${item.done
          ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
          :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        }
      </div>
      <span class="chk-txt" ${item.done?'':'style="color:var(--warn)"'}>${item.text}</span>
      <span class="chk-time">${item.time}</span>
    </div>
  `).join('');
}

/* ─── Load incidents ─────────────────────────────────────── */
const severityTag={high:'<span class="tag tag-r">높음</span>',medium:'<span class="tag tag-y">중간</span>',low:'<span class="tag tag-g">낮음</span>'};
const statusTag={review:'<span class="tag tag-y">검토중</span>',done:'<span class="tag tag-g">완료</span>',training:'<span class="tag tag-b">교육중</span>'};

async function loadIncidents(){
  const res=await fetch('/api/incidents');
  const d=await res.json();
  document.getElementById('incidents-body').innerHTML=d.items.map(i=>`
    <tr>
      <td>${i.item}</td>
      <td>${i.cause}</td>
      <td style="font-family:'JetBrains Mono',monospace">${i.shift}</td>
      <td>${severityTag[i.severity]||''}</td>
      <td>${statusTag[i.status]||''}</td>
    </tr>
  `).join('');
}

/* ─── Flow calc ──────────────────────────────────────────── */
const DEMO_RECORDS=[
  {time:"08:00",flow:0.4},
  {time:"10:30",flow:0.5},
  {time:"13:00",flow:0.6},
  {time:"15:20",flow:0.4},
  {time:"18:00",flow:null}
];

function renderFlowTable(){
  const colors={0.4:'var(--ok)',0.5:'var(--warn)',0.6:'var(--err)'};
  const widths={0.4:40,0.5:55,0.6:70};
  const durs=['2h 30m','2h 30m','2h 20m','2h 40m','—'];
  const wrap=document.getElementById('flow-records');
  wrap.innerHTML=`<div class="flow-row header"><span>시각</span><span>Flow (L/min)</span><span>값</span><span>구간</span></div>`+
  DEMO_RECORDS.map((r,i)=>`
    <div class="flow-row" style="${i===DEMO_RECORDS.length-1?'opacity:.4':''}">
      <span class="flow-time">${r.time}</span>
      <div class="flow-bar-cell">
        ${r.flow!=null?`<div class="flow-bar" style="width:${widths[r.flow]||30}%;background:${colors[r.flow]||'var(--muted)'}"></div>`:'<span style="font-size:.65rem;color:var(--faint)">← 이브닝 정산 시점</span>'}
      </div>
      <span class="flow-val" style="color:${r.flow!=null?colors[r.flow]:'var(--faint)'}">
        ${r.flow!=null?r.flow+' L':'-'}
      </span>
      <span class="flow-dur">${durs[i]}</span>
    </div>
  `).join('');
}

async function runCalc(){
  const res=await fetch('/api/flow-calc',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({records:DEMO_RECORDS})
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
        ? `불출 ${i['불출_출고량']}건 / 처방 ${i['처방_실수량']}건 (차이 ${i['차이'] > 0 ? '+' : ''}${i['차이']})`
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

  document.getElementById('upload-status').textContent =
    `⇄ 비교 완료 · 차이 항목 ${d.diff_count}건 · ${d.date}`;
  document.getElementById('last-updated').textContent =
    '최종 업데이트: ' + new Date().toLocaleString('ko-KR');
  showResultBadges(d);
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
    return `<div class="chk" onclick="toggleCheck(${i})" style="cursor:pointer;user-select:none">
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

/* ─── Init ───────────────────────────────────────────────── */
initEmptyState();
loadChecklistLocal();
renderFlowTable();
