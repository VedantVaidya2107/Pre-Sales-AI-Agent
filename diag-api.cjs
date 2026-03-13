
const https = require('https');
const GKEY = "AIzaSyC1W0Qni6n9qTZMCFlKd7cTP9d6k91TbDY";

function getModels(version) {
    return new Promise((resolve) => {
        https.get(`https://generativelanguage.googleapis.com/${version}/models?key=${GKEY}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`--- ${version} ---`);
                    if (json.models) {
                        json.models.forEach(m => console.log(m.name));
                    } else {
                        console.log(JSON.stringify(json));
                    }
                } catch (e) {
                    console.log(`${version} parsing failed: ${data}`);
                }
                resolve();
            });
        }).on('error', (err) => {
            console.log(`${version} request failed: ${err.message}`);
            resolve();
        });
    });
}

async function run() {
    await getModels('v1');
    await getModels('v1beta');
}

run();
