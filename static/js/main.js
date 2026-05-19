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
  cx.fillText('목표 5%',right-44,yv-5);cx.restore();
}};
const chart=new Chart(ctx,{
  type:'line',
  data:{labels:[],datasets:[
    {label:'전체 누락률',data:[],borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',tension:0.4,fill:true,pointBackgroundColor:'#3b82f6',pointRadius:4,borderWidth:2},
    {label:'연속사용 처치',data:[],borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,0.04)',tension:0.4,fill:false,pointBackgroundColor:'#ef4444',pointRadius:4,borderWidth:2,borderDash:[4,3]}
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
  anim(document.getElementById('v1'),k.overall_rate,800);
  anim(document.getElementById('v2'),k.continuous_rate,800);
  anim(document.getElementById('v3'),k.checklist_rate,800,'int');
  anim(document.getElementById('v4'),k.omission_cost,800,'money');
  const pLabel=k.period_label;
  ['v1-p','v2-p','v3-p','v4-p'].forEach(id=>document.getElementById(id).textContent=pLabel);
  document.getElementById('v1-d').textContent=(k.delta_overall>0?'↑ +':'↓ ')+Math.abs(k.delta_overall)+'%p';
  document.getElementById('v1-d').className=k.delta_overall>0?'d-dn':'d-up';
  document.getElementById('v2-d').textContent=(k.delta_continuous>0?'↑ +':'↓ ')+Math.abs(k.delta_continuous)+'%p';
  document.getElementById('v2-d').className=k.delta_continuous>0?'d-dn':'d-up';
  document.getElementById('v3-d').textContent=(k.delta_checklist>0?'↑ +':'↓ ')+Math.abs(k.delta_checklist)+'%p';
  document.getElementById('v4-d').textContent=(k.delta_cost>0?'↑ +₩':'↓ ₩')+Math.abs(k.delta_cost).toLocaleString();
  document.getElementById('v4-d').className=k.delta_cost<0?'d-up':'d-dn';
  document.getElementById('v4-tgt').textContent=period==='weekly'?'이번 주 누락 추정액':'개선 전 대비 39% 절감';

  const rate=k.continuous_rate;
  const alertBox=document.getElementById('alert-box');
  const alertTxt=document.getElementById('alert-text');
  if(rate>5){
    alertBox.style.display='flex';
    alertTxt.innerHTML=`<strong>연속사용 처치 누락률 ${rate}%</strong> — 목표치(5%) 초과. 자동계산 시스템 도입 건의 필요.`;
  } else {
    alertBox.style.display='none';
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
        ${r.flow!=null?`<div class="flow-bar" style="width:${widths[r.flow]||30}%;background:${colors[r.flow]||'var(--muted)'}"></div>`:'<span style="font-size:.65rem;color:var(--faint)">← 교대 마감</span>'}
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

/* ─── Init ───────────────────────────────────────────────── */
loadTrend('monthly');
loadChecklist();
loadIncidents();
renderFlowTable();