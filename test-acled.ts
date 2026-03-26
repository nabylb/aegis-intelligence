import { fetchACLEDData } from './src/lib/aggregator';
process.env.ACLED_EMAIL = 'nabylb@gmail.com';
process.env.ACLED_PASSWORD = 'Fat74*Musat';
fetchACLEDData().then(data => {
  const pure = data.filter(e => e.id.startsWith('acled-'));
  console.log(`ACLED Returns: ${pure.length}`);
}).catch(console.error);
