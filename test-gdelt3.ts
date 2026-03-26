import { fetchGDELTData } from './src/lib/aggregator';
fetchGDELTData().then(data => {
  data.slice(0, 20).forEach((s, idx) => {
      console.log(`[${idx+1}] ${s.title}`);
  });
}).catch(console.error);
