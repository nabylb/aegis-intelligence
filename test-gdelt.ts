import { fetchGDELTData } from './src/lib/aggregator';
fetchGDELTData().then(data => {
  const strikes = data.filter(e => e.type === 'strike');
  console.log(`Total GDELT items: ${data.length}`);
  console.log(`Extracted Strikes (Casualty > 0): ${strikes.length}`);
  strikes.slice(0, 5).forEach(s => {
      console.log(`[FATALITIES: ${s.fatalities}] ${s.title}`);
  });
}).catch(console.error);
