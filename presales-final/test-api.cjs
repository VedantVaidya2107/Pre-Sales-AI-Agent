
const https = require('https');
const GKEY = "AIzaSyDnOmsfj0_uhXkjjFON0Ji3roF5VIZg-VM";
https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${GKEY}`, (r) => {
    let d = ''; r.on('data', (c) => d += c);
    r.on('end', () => {
        const j = JSON.parse(d);
        if (j.models) console.log(JSON.stringify(j.models.map(m => m.name)));
        else console.log(d);
    });
});
