const $ = id => document.getElementById(id);
const model = globalThis.StockModel;
const storageKey = 'stock-scenarios-v1';
const demo = {symbol:'DEMO',name:'Example Company (fictional)',currency:'USD',period:'Illustrative baseline',source:'Demo data — not a real company or live quote',revenue:2000,grossMargin:45,opex:500,netIncome:250,shares:100,price:50};
const forecastYears = Array.from({length:4},(_,i)=>new Date().getFullYear()+i+1);
const fields = [['revenue','Revenue (millions)',0.001],['grossMargin','Gross margin (%)',0],['opex','Operating expenses (millions)',0],['netIncome','Net income (millions)',null],['shares','Diluted shares (millions)',0.001],['price','Entry price / share',0.001]];
let state = {baseline:{...demo},scenarios:model.defaults(demo)}, selected = 'base', lastResults = null;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved) {
    model.validateBaseline(saved.baseline);
    for (const key of ['bear','base','bull']) model.project(saved.baseline,saved.scenarios[key]);
    state = saved;
    $('status').textContent = 'Restored your saved model. Prices and financials have not been refreshed.';
  }
} catch { $('status').textContent = 'Saved data could not be restored; loaded the demo.'; }
const fmt = (n,d=2) => n === null || !Number.isFinite(n) ? 'N/A' : n.toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:0});
const pct = n => n === null ? 'N/A' : `${fmt(n)}%`;
const money = n => n === null ? 'N/A' : `${state.baseline.currency || ''} ${fmt(n)}`;
function baselineUI() {
  const b = state.baseline;
  $('company').textContent = `${b.symbol} · ${b.name}`;
  $('source').textContent = `${b.source} | ${b.period} | Currency: ${b.currency}${b.overridden ? ' | Starting values manually edited' : ''}`;
  $('projection').setAttribute('aria-label',`${b.symbol} financial projections`);
}
const inputNumber = n => Number.isFinite(n) ? String(Number(n.toFixed(2))) : '';
const visibleInputs = [...model.inputs.filter(([key])=>!['opex','other'].includes(key)), ['netIncomeGrowth','Net income growth',-1000,1000]];
function incomeGrowthValues() {
  const results=model.project(state.baseline,state.scenarios[selected]);
  return results.map((r,i)=>{const previous=i?results[i-1].netIncome:state.baseline.netIncome;return previous===0?undefined:(r.netIncome-previous)/Math.abs(previous)*100;});
}
function baselineInput(key) {
  const input=document.createElement('input');
  input.type='number'; input.step='any'; input.required=true; input.value=inputNumber(state.baseline[key]); input.dataset.field=key;
  const field=fields.find(f=>f[0]===key);
  if(field[2]!==null) input.min=field[2];
  if(key==='grossMargin') input.max=100;
  input.setAttribute('aria-label',`Starting baseline ${field[1]}`);
  return input;
}
const sheet = [
  ['section','Revenue'], ['value','revenue'], ['input','growth'], ['input','grossMargin'], ['value','grossProfit'],
  ['section','Profitability'], ['value','netIncome'], ['input','netIncomeGrowth'], ['value','netMargin'],
  ['section','Earnings per share'], ['value','eps'], ['value','shares'], ['input','sharesChange'],
  ['section','Valuation & returns'], ['entry','price'], ['input','peLow'], ['input','peHigh'],
  ['value','low'], ['value','high'], ['value','cagrLow'], ['value','cagrHigh']
];
function renderTable() {
  const a = state.scenarios[selected];
  let growthValues=[];
  try {growthValues=incomeGrowthValues();} catch {} 
  $('projection').dataset.scenario=selected;
  $('projection').innerHTML = `<thead><tr><th scope="col">${selected.toUpperCase()} CASE</th><th scope="col">Baseline<small>Latest annual</small></th>${forecastYears.map(y=>`<th scope="col">${y}<small>Forecast</small></th>`).join('')}</tr></thead><tbody></tbody>`;
  const tbody=$('projection').querySelector('tbody');
  for(const [kind,key] of sheet) {
    const tr=document.createElement('tr');
    const th=document.createElement('th'); th.scope='row'; tr.append(th);
    if(kind==='section') {tr.className='section-row'; th.colSpan=6; th.textContent=key; tbody.append(tr); continue;}
    if(kind==='input') {
      const [,label,min,max]=visibleInputs.find(item=>item[0]===key);
      tr.className='assumption'; th.textContent=label+(['peLow','peHigh'].includes(key)?' (×)':' (%)');
      const fill=document.createElement('button'); fill.textContent='Fill →'; fill.className='fill'; fill.dataset.fill=key; fill.title=`Copy ${forecastYears[0]} ${label} to all forecast years`; th.append(fill);
      const baselineCell=document.createElement('td');
      if(key==='grossMargin') baselineCell.append(baselineInput(key)); else baselineCell.textContent='—';
      tr.append(baselineCell);
      a.forEach((year,i)=>{
        const td=document.createElement('td'),input=document.createElement('input');
        input.type='number'; input.step='any'; input.min=min; input.max=max; input.value=inputNumber(key==='netIncomeGrowth'?(year[key]??growthValues[i]):year[key]); input.required=true;
        input.dataset.key=key; input.dataset.year=i; input.setAttribute('aria-label',`${selected} ${forecastYears[i]} ${label}`);
        td.append(input); tr.append(td);
      });
    } else {
      th.textContent=kind==='entry'?'Entry price / share':rows.find(row=>row[0]===key)[1];
      tr.className=['low','high','cagrLow','cagrHigh'].includes(key)?'result':'metric';
      for(let i=0;i<5;i++) {
        const td=document.createElement('td');
        if(i===0&&['revenue','shares','price'].includes(key))td.append(baselineInput(key));
        else if(kind==='entry')td.textContent='—';
        else {td.dataset.result=key;td.dataset.index=i;}
        tr.append(td);
      }
    }
    tbody.append(tr);
  }
  updateResults();
}
const rows = [['revenue','Revenue (millions)'],['grossProfit','Gross profit (millions)'],['netIncome','Net income (millions)'],['netMargin','Net margin (%)'],['shares','Diluted shares (millions)'],['eps','Earnings per share'],['low','Low target price'],['high','High target price'],['cagrLow','Low annualized return (%)'],['cagrHigh','High annualized return (%)']];
function updateResults() {
  $('validation').textContent=''; $('cards').replaceChildren();
  document.querySelectorAll('[data-result]').forEach(el=>el.textContent='—'); lastResults=null;
  try {
    const b=state.baseline;
    const results=Object.fromEntries(['bear','base','bull'].map(k=>[k,model.project(b,state.scenarios[k])]));
    lastResults=results;
    for (const name of ['bear','base','bull']) {
      const last=results[name][3], card=document.createElement('article'); card.className=`card ${name}`;
      const title=document.createElement('b'); title.textContent=`${name.toUpperCase()} CASE · ${forecastYears[3]} RETURN / YEAR`;
      const value=document.createElement('strong'); value.textContent=`${pct(last.cagrLow)} to ${pct(last.cagrHigh)}`;
      const price=document.createElement('p'); price.textContent=`Target: ${money(last.low)} to ${money(last.high)}`;
      card.append(title,value,price); $('cards').append(card);
    }
    const baseline={...b,grossProfit:b.revenue*b.grossMargin/100,cost:b.revenue*(1-b.grossMargin/100),other:b.revenue*b.grossMargin/100-b.opex-b.netIncome,netMargin:b.netIncome/b.revenue*100,eps:b.netIncome/b.shares};
    document.querySelectorAll('[data-result]').forEach(td=>{
      const item=[baseline,...results[selected]][Number(td.dataset.index)],key=td.dataset.result;
      td.textContent=item[key]===undefined?'—':(['netMargin','cagrLow','cagrHigh'].includes(key)?pct(item[key]):fmt(item[key]));
      td.classList.toggle('negative',Number.isFinite(item[key])&&item[key]<0);
    });
    const growth=incomeGrowthValues();
    document.querySelectorAll('[data-key="netIncomeGrowth"]').forEach(input=>{if(input!==document.activeElement)input.value=inputNumber(state.scenarios[selected][Number(input.dataset.year)].netIncomeGrowth??growth[Number(input.dataset.year)]);input.title='Annual change in net income, relative to the magnitude of prior-year income. A zero starting income stays zero.';});
  } catch (e) { $('validation').textContent=e.message; }
  $('export').disabled=!lastResults; $('save').disabled=!lastResults;
}
$('projection').addEventListener('input',e=>{
  if (!e.target.dataset.field) return;
  state.baseline[e.target.dataset.field]=e.target.valueAsNumber; state.baseline.overridden=true;
  $('source').textContent=`${state.baseline.source} | ${state.baseline.period} | Starting values manually edited; forecast assumptions retained.`;
  updateResults();
});
$('projection').addEventListener('input',e=>{
  if (!e.target.dataset.key) return;
  const key=e.target.dataset.key;
  if(key==='netIncomeGrowth') {
    // Keep each existing forecast when switching from cost assumptions to income growth.
    try {const growth=incomeGrowthValues();state.scenarios[selected].forEach((year,i)=>{if(year.netIncomeGrowth===undefined&&Number.isFinite(growth[i])&&Math.abs(growth[i])<=1000)year.netIncomeGrowth=growth[i];});} catch {}
  }
  state.scenarios[selected][Number(e.target.dataset.year)][key]=e.target.valueAsNumber; updateResults();
});
$('projection').addEventListener('click',e=>{
  const key=e.target.dataset.fill; if (!key) return;
  const value=key==='netIncomeGrowth'?(state.scenarios[selected][0][key]??incomeGrowthValues()[0]):state.scenarios[selected][0][key];
  if(!Number.isFinite(value))return;
  for (const year of state.scenarios[selected]) year[key]=value; renderTable();
});
$('scenario').addEventListener('change',()=>{selected=$('scenario').value;renderTable();});
$('copy').addEventListener('click',()=>{state.scenarios[selected]=structuredClone(state.scenarios.base);renderTable();});
$('reset').addEventListener('click',()=>{try {state.scenarios[selected]=model.defaults(state.baseline)[selected];renderTable();}catch(e){$('validation').textContent=e.message;}});
$('save').addEventListener('click',()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));$('status').textContent='Saved in this browser.';}catch{$('status').textContent='Browser storage unavailable. Export a CSV to keep your results.';}});
$('demo').addEventListener('click',()=>{state={baseline:{...demo},scenarios:model.defaults(demo)};baselineUI();renderTable();$('status').textContent='Loaded fictional demo data. Save explicitly to replace your saved model.';});
$('export').addEventListener('click',()=>{
  if (!lastResults) return;
  const data=[['Scenario',selected],['Ticker',state.baseline.symbol],['Currency',state.baseline.currency],['Source',state.baseline.source],['Period',state.baseline.period],['Entry price',state.baseline.price],['Metric',...forecastYears],...visibleInputs.map(([k,label])=>[label,...state.scenarios[selected].map((a,i)=>k==='netIncomeGrowth'?(a[k]??incomeGrowthValues()[i]??'N/A'):a[k])]),...rows.map(([k,label])=>[label,...lastResults[selected].map(r=>r[k] ?? 'N/A')])];
  const csv=data.map(row=>row.map(v=>`"${String(typeof v==='number'?Number(v.toFixed(2)):v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})), link=document.createElement('a');link.href=url;link.download=`${state.baseline.symbol}-${selected}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('search-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(location.protocol==='file:'){$('status').textContent='Live lookup needs the local server and an FMP API key. See README.md. Demo and manual entry work here.';return;}
  $('search-button').disabled=true; $('demo').disabled=true; $('status').textContent='Loading company financials…';
  try {
    const response=await fetch(`/api/company?symbol=${encodeURIComponent($('ticker').value.trim().toUpperCase())}`);
    if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('The lookup received a web page instead of data. Open Start Stock Calculator.command, then use http://localhost:3000 for live lookup.');
    let data;
    try { data=await response.json(); }
    catch { throw new Error('The lookup returned unreadable data. Restart the calculator and try again.'); }
    if(!response.ok)throw new Error(data.error || 'Unable to load company.');
    model.validateBaseline(data);state={baseline:data,scenarios:model.defaults(data)};baselineUI();renderTable();
    $('status').textContent='Loaded latest annual financials and quote. All scenario assumptions reset to illustrative presets.';
  }catch(e){$('status').textContent=`${e.message} Your current model has been kept.`;}
  finally{$('search-button').disabled=false;$('demo').disabled=false;}
});
baselineUI();renderTable();

// Keep native numeric validation, but allow changes only through text entry.
$('projection').addEventListener('keydown',e=>{
  if(e.target.matches('input[type="number"]')&&['ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
});
$('projection').addEventListener('wheel',e=>{
  if(e.target.matches('input[type="number"]')&&e.target===document.activeElement)e.preventDefault();
},{passive:false});
$('projection').addEventListener('focusout',e=>{
  if(e.target.matches('input[type="number"]')&&Number.isFinite(e.target.valueAsNumber))e.target.value=inputNumber(e.target.valueAsNumber);
});
