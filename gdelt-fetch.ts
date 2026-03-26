const baseUrl = 'https://api.gdeltproject.org/api/v2/doc/doc';
const query = '(iran OR israel OR lebanon OR yemen OR houthi OR irgc OR idf OR palestine OR gaza) (strike OR attack OR war OR military OR drone OR missile OR explosion OR casualties OR fatalities OR dead OR killed)';
const params = new URLSearchParams({
    query,
    mode: 'artlist',
    maxrecords: '250',
    format: 'json',
    sort: 'datedesc'
});
const url = `${baseUrl}?${params.toString()}`;

console.log("Fetching GDELT:", url);

fetch(url)
    .then(async r => {
        console.log("Status:", r.status);
        const text = await r.text();
        console.log("Response text length:", text.length);
        console.log("Snippet:", text.substring(0, 150));
    })
    .catch(e => console.error("Fetch Error:", e));
