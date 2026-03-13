const GKEY = "AIzaSyC1W0Qni6n9qTZMCFlKd7cTP9d6k91TbDY";
const GMODEL = "gemini-2.5-flash"; // Confirmed available model

export async function gem(prompt, maxTokens = 1000, temp = 0.7) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GMODEL}:generateContent?key=${GKEY}`;
        console.log(`[Gemini] Calling ${GMODEL} at v1beta endpoint...`);
        const r = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: maxTokens, temperature: temp }
            })
        });
        console.log(`[Gemini] Status: ${r.status}`);
        const d = await r.json();
        if (!r.ok) {
            console.error('[Gemini] API Error:', d);
            throw new Error(d.error?.message || 'Gemini API Error');
        }
        const text = d.candidates[0].content.parts[0].text;
        console.log(`[Gemini] Success (Length: ${text.length})`);
        return text;
    } catch (e) {
        console.error('[Gemini] Fetch Error:', e);
        throw e;
    }
}

export function safeJ(txt) {
    try {
        const clean = txt.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        console.error('JSON Parse Error:', e, txt);
        return null;
    }
}
