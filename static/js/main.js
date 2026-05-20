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
  const file = document.getElementById('upload-image').files[0];
  if (!file) { alert('이미지 파일을 선택해주세요.'); return; }

  const date    = document.getElementById('meta-date').value    || new Date().toISOString().slice(0,10);
  const doctype = document.getElementById('meta-doctype').value;
  const duty    = document.getElementById('meta-duty').value;

  if (!checkDuplicate(date, doctype, duty)) return;

  const st = document.getElementById('upload-status');
  st.textContent = '⏳ AI가 이미지를 읽는 중...';

  const form = new FormData();
  form.append('file', file);

  try {
    const res = await fetch('/api/ocr-upload', { method: 'POST', body: form });
    const d   = await res.json();

    if (d.error && !d.manual_mode) {
      st.textContent = '❌ ' + d.error;
      return;
    }
    window._currentMeta = {
      date, doctype, duty,
      memo: document.getElementById('meta-memo').value
    };
    if (d.manual_mode) {
      renderOcrTable([], true);
      st.textContent = '✏️ 수동 입력 모드 — 직접 입력 후 확정해주세요.';
    } else {
      renderOcrTable(d.items || [], false);
      st.textContent = `✓ ${d.count}개 항목 추출 완료 — 수정 후 "분석 확정" 클릭`;
    }
  } catch(e) {
    st.textContent = '❌ 네트워크 오류: ' + e.message;
  }
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

  const tbody = document.getElementById('ocr-tbody');
  tbody.innerHTML = items.map((r, i) => _ocrRowHtml(i, r)).join('');
  if (manualMode || items.length === 0) _addEmptyOcrRow();

  tbody.addEventListener('input', _onOcrEdit, { once: false });
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

  // Top5 갱신
  buildTop5();

  // 경고 beep
  if (delay.length > 0 || overstock.length > 0) playBeep(660, 0.18);

  document.getElementById('ocr-status').textContent =
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

/* ─── Phase 2-A: Duty Alarm ─────────────────────────────── */
const DUTY_END_TIMES = { day:'14:30', evening:'22:30', night:'06:30' };

function checkDutyAlarm() {
  const now   = new Date();
  const hhmm  = now.toTimeString().slice(0,5);
  const today = now.toISOString().slice(0,10);
  Object.entries(DUTY_END_TIMES).forEach(([duty, time]) => {
    if (hhmm !== time) return;
    const confirmed = ['bulchul','ganhocheo','other'].some(doc =>
      localStorage.getItem(`upload_${today}_${doc}_${duty}`)
    );
    if (!confirmed) _showDutyModal(duty);
  });
}

function _showDutyModal(duty) {
  const labels = { day:'Day', evening:'Evening', night:'Night' };
  const el  = document.getElementById('duty-alarm-modal');
  const msg = document.getElementById('duty-alarm-msg');
  if (!el || !msg) return;
  msg.textContent =
    `인수인계 30분 전입니다.\n금일 ${labels[duty]} 근무 코스트 누락 점검 서류가 아직 확정되지 않았습니다.`;
  el.style.display = 'flex';
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
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    ['bulchul','ganhocheo','other'].forEach(doc =>
      ['day','evening','night'].forEach(duty => {
        const raw = localStorage.getItem(`upload_${ds}_${doc}_${duty}`);
        if (!raw) return;
        try {
          const { rows = [] } = JSON.parse(raw);
          rows.filter(r => r.undelivered_qty > 0 || r.actual_qty < r.order_qty)
              .forEach(r => { if(r.item) counts[r.item] = (counts[r.item]||0)+1; });
        } catch(e) {}
      })
    );
  }
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
initEmptyState();
loadChecklistLocal();
renderFlowTable();
renderHandoverBanner();
buildTop5();
renderMaxList();

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
