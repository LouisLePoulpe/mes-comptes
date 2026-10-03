// Regression against elapsed days, so irregular transaction frequency does not bias time.
export function trend(data, key) {
  if (data.length < 2) return { data, monthly: null, last: null }
  const origin = data[0].timestamp
  const xs = data.map(row => (row.timestamp - origin) / 86400000)
  const meanX = xs.reduce((a,b)=>a+b,0) / data.length
  const meanY = data.reduce((a,row)=>a+row[key],0) / data.length
  const variance = xs.reduce((sum,x)=>sum+(x-meanX)**2,0)
  if (!variance) return { data, monthly: null, last: null }
  const slope = xs.reduce((sum,x,i)=>sum+(x-meanX)*(data[i][key]-meanY),0)/variance
  const values = data.map((row,i)=>({...row,[`${key}_trend`]:meanY+slope*(xs[i]-meanX)}))
  return { data: values, monthly: slope*30.4375, last: values.at(-1)[`${key}_trend`] }
}
export function orderedCards(accounts, order = []) {
  const valid = new Set([...accounts.map(a=>a.id), 'consumption'])
  return [...new Set([...order.filter(id=>valid.has(id)), ...valid])]
}
