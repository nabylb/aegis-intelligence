async function test() {
    const url = "https://www.myshiptracking.com/requests/mget.php?type=json&minlat=10&maxlat=40&minlon=30&maxlon=60&zoom=5";
    try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const text = await r.text();
        console.log("Status:", r.status);
        console.log("Length:", text.length);
        console.log("Sample:", text.substring(0, 200));
    } catch(e) { console.error(e); }
}
test();
