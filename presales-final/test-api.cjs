
const https = require('https');
const GKEY = "AIzaSyC1W0Qni6n9qTZMCFlKd7cTP9d6k91TbDY";
https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${GKEY}`, (r) => {
    let d = ''; r.on('data', (c) => d += c);
    r.on('end', () => {
        const j = JSON.parse(d);
        if (j.models) console.log(JSON.stringify(j.models.map(m => m.name)));
        else console.log(d);
    });
});
