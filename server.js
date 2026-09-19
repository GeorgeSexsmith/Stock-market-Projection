import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import './model.js';

// Explicit allowlist keeps configuration, keys, and source files off the web.
const files = {'/':['projections.html','text/html'],'/projections.html':['projections.html','text/html'],'/styles.css':['styles.css','text/css'],'/model.js':['model.js','text/javascript'],'/app.js':['app.js','text/javascript']};
const cache=new Map();
function send(res,status,data) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export async function provider(endpoint,symbol,key) {
  const url=new URL(`https://financialmodelingprep.com/stable/${endpoint}`);
  url.search=new URLSearchParams({symbol,apikey:key,...(endpoint==='income-statement'?{period:'annual',limit:'1'}:{})});
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok) {
    const label=endpoint==='income-statement'?'financial statements':'quote';
    if(response.status===402)throw new Error(`Your Financial Modeling Prep subscription does not include ${symbol} ${label}. Use a ticker covered by your plan, enter the figures manually, or check FMP plan coverage.`);
    if(response.status===401)throw new Error('Financial Modeling Prep rejected the API key. Check your saved key and restart the calculator.');
    if(response.status===429)throw new Error('Financial Modeling Prep request limit reached. Wait before trying again.');
    throw new Error(`Financial Modeling Prep rejected the ${symbol} ${label} request (HTTP ${response.status}). Check provider access or try again later.`);
  }
  let data;
  try { data=await response.json(); }
  catch { throw new Error('Financial Modeling Prep returned an unexpected response instead of financial data. Try again shortly.'); }
  if(!Array.isArray(data))throw new Error('Data provider returned an error. Check API access.');
  if(!data.length)throw new Error('Ticker not found or financial data unavailable.');
  return data[0];
}
export function normalize(statement,quote,symbol) {
  const required=['revenue','grossProfit','operatingExpenses','netIncome','weightedAverageShsOutDil'];
  for(const key of required) if(typeof statement[key]!=='number'||!Number.isFinite(statement[key]))throw new Error(`Missing financial field: ${key}. Use manual entry for this company.`);
  if(typeof quote.price!=='number'||!Number.isFinite(quote.price))throw new Error('Current share price unavailable.');
  // This MVP only combines USD statements with US-exchange quotes to avoid currency mismatch.
  const exchange=String(quote.exchange || '').toUpperCase();
  if(statement.reportedCurrency!=='USD'||!['NASDAQ','NYSE','AMEX','NYSEARCA','NYSE AMERICAN'].includes(exchange))throw new Error('Live MVP supports USD statements and US-exchange quotes only. Use manual entry for other listings.');
  const b={symbol,name:quote.name||symbol,currency:'USD',period:`Annual period ended ${statement.date}`,source:`Financial Modeling Prep · fetched ${new Date().toISOString()} · quote timestamp ${quote.timestamp ? new Date(quote.timestamp*1000).toISOString() : 'unavailable'}`,revenue:statement.revenue/1e6,grossMargin:statement.grossProfit/statement.revenue*100,opex:statement.operatingExpenses/1e6,netIncome:statement.netIncome/1e6,shares:statement.weightedAverageShsOutDil/1e6,price:quote.price};
  globalThis.StockModel.validateBaseline(b);return b;
}
export const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
    if(url.pathname==='/api/health')return send(res,200,{app:'stock-scenario-calculator'});
    if(url.pathname==='/api/company'){
      const symbol=(url.searchParams.get('symbol')||'').trim().toUpperCase();
      if(!/^[A-Z0-9.^-]{1,15}$/.test(symbol))return send(res,400,{error:'Enter a valid ticker.'});
      const key=process.env.FMP_API_KEY;
      if(!key)return send(res,503,{error:'Live data is not configured. Set FMP_API_KEY on the server; demo and manual entry remain available.'});
      const saved=cache.get(symbol);if(saved&&Date.now()-saved.time<300000)return send(res,200,saved.data);
      const [statement,quote]=await Promise.all([provider('income-statement',symbol,key),provider('quote',symbol,key)]);
      const data=normalize(statement,quote,symbol);
      if(cache.size>=100)cache.delete(cache.keys().next().value);
      cache.set(symbol,{time:Date.now(),data});return send(res,200,data);
    }
    const file=files[url.pathname];if(!file)return send(res,404,{error:'Not found.'});
    const body=await readFile(new URL(file[0],import.meta.url));
    res.writeHead(200,{'Content-Type':`${file[1]}; charset=utf-8`,'X-Content-Type-Options':'nosniff'});res.end(body);
  }catch(error){send(res,502,{error:error.name==='TimeoutError'?'Data provider timed out. Try again.':error.message});}
});
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||3000);
  server.listen(port,'127.0.0.1',()=>console.log(`Stock calculator running at http://localhost:${port}`));
}
