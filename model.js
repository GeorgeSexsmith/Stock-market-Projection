/* Pure calculations shared by the browser and Node tests. Values use millions. */
(function () {
  const inputs = [
    ['growth', 'Revenue growth', -99.9, 1000],
    ['grossMargin', 'Gross margin', 0, 100],
    ['opex', 'Operating expenses / revenue', 0, 1000],
    ['other', 'Other net costs / revenue', -1000, 1000],
    ['sharesChange', 'Dilution (+) / buybacks (−)', -99.9, 1000],
    ['peLow', 'Low P/E', 0.1, 1000],
    ['peHigh', 'High P/E', 0.1, 1000]
  ];
  function validateBaseline(b) {
    for (const key of ['revenue','grossMargin','opex','netIncome','shares','price']) {
      if (!Number.isFinite(b[key])) throw new Error('Every starting financial must be a valid number.');
    }
    if (b.revenue <= 0 || b.shares <= 0 || b.price <= 0) throw new Error('Revenue, diluted shares, and entry price must be greater than zero.');
    if (b.grossMargin < 0 || b.grossMargin > 100 || b.opex < 0) throw new Error('Gross margin must be 0–100%; operating expenses cannot be negative.');
  }
  function defaults(b) {
    validateBaseline(b);
    const opex = b.opex / b.revenue * 100;
    const other = b.grossMargin - opex - b.netIncome / b.revenue * 100;
    return Object.fromEntries(['bear','base','bull'].map((name,i) => [name, Array.from({length:4}, () => ({growth:[0,8,15][i],grossMargin:b.grossMargin,opex,other,sharesChange:0,peLow:[12,18,24][i],peHigh:[16,24,30][i]}))]));
  }
  function project(b, assumptions) {
    validateBaseline(b);
    if (!Array.isArray(assumptions) || assumptions.length !== 4) throw new Error('Each scenario needs four years of assumptions.');
    let revenue = b.revenue, shares = b.shares, previousIncome = b.netIncome;
    return assumptions.map((a,i) => {
      for (const [key,label,min,max] of inputs) {
        if (!Number.isFinite(a[key]) || a[key] < min || a[key] > max) throw new Error(`Year ${i+1}: ${label} must be between ${min} and ${max}.`);
      }
      if (a.peLow > a.peHigh) throw new Error(`Year ${i+1}: low P/E cannot exceed high P/E.`);
      revenue *= 1 + a.growth / 100;
      shares *= 1 + a.sharesChange / 100;
      const grossProfit = revenue * a.grossMargin / 100;
      const opex = revenue * a.opex / 100;
      let other = revenue * a.other / 100;
      let netIncome = grossProfit - opex - other;
      if (a.netIncomeGrowth !== undefined) {
        if (!Number.isFinite(a.netIncomeGrowth) || a.netIncomeGrowth < -1000 || a.netIncomeGrowth > 1000) throw new Error(`Year ${i+1}: Net income growth must be between -1000 and 1000.`);
        netIncome = previousIncome + Math.abs(previousIncome) * a.netIncomeGrowth / 100;
        other = grossProfit - opex - netIncome;
      }
      previousIncome = netIncome;
      const eps = netIncome / shares;
      const low = eps > 0 ? eps * a.peLow : null;
      const high = eps > 0 ? eps * a.peHigh : null;
      return {revenue,shares,grossProfit,cost:revenue-grossProfit,opex,other,netIncome,netMargin:netIncome/revenue*100,eps,low,high,cagrLow:low === null ? null : ((low/b.price)**(1/(i+1))-1)*100,cagrHigh:high === null ? null : ((high/b.price)**(1/(i+1))-1)*100};
    });
  }
  globalThis.StockModel = {inputs,defaults,project,validateBaseline};
})();
