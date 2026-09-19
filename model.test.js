import test from 'node:test';
import assert from 'node:assert/strict';
import './model.js';
import {normalize,server,provider} from './server.js';
const {project,defaults}=globalThis.StockModel;
const baseline={revenue:1000,grossMargin:50,opex:300,netIncome:100,shares:100,price:20};
const years=()=>Array.from({length:4},()=>({growth:10,grossMargin:50,opex:30,other:10,sharesChange:0,peLow:20,peHigh:25}));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
test('provider distinguishes subscription, key, and request-limit failures without exposing the key',async t=>{
  for(const [status,message] of [[402,/subscription does not include CELH financial statements/],[401,/rejected the API key/],[429,/request limit reached/]]){
    const mock=t.mock.method(globalThis,'fetch',async()=>new Response('Provider failure',{status}));
    await assert.rejects(provider('income-statement','CELH','private-test-key'),error=>message.test(error.message)&&!error.message.includes('private-test-key'));
    mock.mock.restore();
  }
});
test('four-year compounding, accounting identity, EPS and annualized return',()=>{
  const result=project(baseline,years());close(result[3].revenue,1464.1);close(result[3].netIncome,146.41);close(result[3].eps,1.4641);close(result[3].low,29.282);close(result[3].cagrLow,10);
  for(const r of result)close(r.netIncome,r.revenue-r.cost-r.opex-r.other);
});
test('dilution offsets matching earnings growth; buybacks raise EPS',()=>{
  const a=years();a.forEach(y=>y.sharesChange=10);close(project(baseline,a)[3].eps,1);
  a.forEach(y=>{y.growth=0;y.sharesChange=-10;});close(project(baseline,a)[3].eps,1/(0.9**4));
});
test('income growth compounds independently of revenue and keeps margin, EPS and valuation consistent',()=>{
  const a=years();a.forEach(y=>y.netIncomeGrowth=20);
  const r=project(baseline,a);
  close(r[3].netIncome,207.36);close(r[3].netMargin,207.36/1464.1*100);
  close(r[3].eps,2.0736);close(r[3].low,41.472);
  for(const year of r)close(year.netIncome,year.grossProfit-year.opex-year.other);
  a[0].netIncomeGrowth=NaN;assert.throws(()=>project(baseline,a));
});
test('income growth handles losses and zero baseline without invalid prices',()=>{
  const a=years();a.forEach(y=>y.netIncomeGrowth=20);
  const loss=project({...baseline,netIncome:-100},a);close(loss[0].netIncome,-80);assert.equal(loss[0].low,null);
  const zero=project({...baseline,netIncome:0},a);close(zero[3].netIncome,0);assert.equal(zero[3].low,null);
});
test('declining revenue compounds correctly and losses have no P/E valuation',()=>{
  const a=years();a.forEach(y=>y.growth=-10);close(project(baseline,a)[3].revenue,656.1);
  a[0].opex=80;const r=project(baseline,a)[0];assert.ok(r.netIncome<0);assert.equal(r.low,null);assert.equal(r.cagrHigh,null);
});
test('invalid values and reversed valuation ranges are rejected',()=>{
  assert.throws(()=>project({...baseline,shares:0},years()));
  const a=years();a[0].growth=NaN;assert.throws(()=>project(baseline,a));
  a[0].growth=0;a[1].peLow=50;assert.throws(()=>project(baseline,a));
});
test('defaults reconcile starting earnings and scenarios do not share objects',()=>{
  const d=defaults(baseline);close(project(baseline,d.bear)[0].netIncome,100);
  d.bear[0].growth=99;assert.equal(d.bear[1].growth,0);assert.equal(d.base[0].growth,8);
});
test('provider normalization preserves units and rejects missing data or currency mismatch',()=>{
  const s={revenue:1e9,grossProfit:5e8,operatingExpenses:3e8,netIncome:1e8,weightedAverageShsOutDil:1e8,reportedCurrency:'USD',date:'2025-12-31'};
  const q={price:20,exchange:'NASDAQ'};close(normalize(s,q,'TEST').shares,100);
  assert.throws(()=>normalize({...s,netIncome:null},q,'TEST'));
  assert.throws(()=>normalize({...s,reportedCurrency:'EUR'},q,'TEST'));
});
test('server serves the page, protects files and handles unavailable API configuration',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base)).status,200);
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(),{app:'stock-scenario-calculator'});
    assert.equal((await fetch(`${base}/.env`)).status,404);
    assert.equal((await fetch(`${base}/server.js`)).status,404);
    assert.equal((await fetch(`${base}/api/company?symbol=bad!`)).status,400);
    if(!process.env.FMP_API_KEY)assert.equal((await fetch(`${base}/api/company?symbol=AAPL`)).status,503);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
