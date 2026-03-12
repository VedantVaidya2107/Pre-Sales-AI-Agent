const GKEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzeQkhQclsvGDQfMVcKxRx3ngabIr7igGKZhkTG9oW20pm4D7wosLx1mQvZvNdOX1xyNA/exec";

// Model routing: flash for quick conversational turns, pro for deep analysis & proposal gen
const MODELS = {
    flash: "gemini-1.5-flash",   // stable, reliable
    pro:   "gemini-1.5-pro"     // stable, reliable
};

/**
 * Detect question intensity to route to the right model.
 * Returns 'pro' if the prompt involves deep reasoning, else 'flash'.
 */
function routeModel(prompt, forcePro = false) {
    if (forcePro) return MODELS.pro;
    const p = prompt.toLowerCase();
    // Route to Pro for complex tasks
    const proSignals = [
        'requirements_complete', 'generate proposal', 'design solution', 'architecture',
        'fsd', 'scope of work', 'implementation plan', 'roi', 'integration', 'data migration',
        'primary_products', 'implementation_phases', 'json', 'return json', 'proposal html',
        'zoho analytics', 'sap', 'custom module', 'workflow automation', 'complex'
    ];
    if (proSignals.some(s => p.includes(s))) return MODELS.pro;
    // Route to Flash for everything else (greeting, short clarifications, follow-up Qs)
    return MODELS.flash;
}

/**
 * Formats conversation history for the Gemini API.
 * Maps 'user' to 'user' and 'assistant' to 'model'.
 */
function formatHistory(history = []) {
    return history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));
}

export async function gem(prompt, maxTokens = 1000, temp = 0.7, forcePro = false, history = [], systemInstruction = "") {
    const model = routeModel(prompt, forcePro);
    console.log(`[Gemini Router] → ${model} (maxTokens:${maxTokens}, history:${history.length})`);
    
    // 1. Build formal contents history (must be alternating user/model)
    const contents = formatHistory(history);
    
    // 2. The prompt itself is the final 'user' part
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    // 3. Handle Proxy Mode (No GKEY)
    if (!GKEY) {
        console.log(`[Gemini Router] No key found. Routing via Proxy...`);
        return gemProxy(model, contents, maxTokens, temp, systemInstruction);
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GKEY}`;
        const body = {
            contents,
            generationConfig: { maxOutputTokens: maxTokens, temperature: temp }
        };

        // 3. Add official systemInstruction if provided
        if (systemInstruction) {
            body.system_instruction = { parts: [{ text: systemInstruction }] };
        }

        const r = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        const d = await r.json();
        
        if (!r.ok) {
            if (model === MODELS.pro) {
                console.warn('[Gemini Router] Pro failed, falling back to Flash:', d.error?.message);
                return gemFlashFallback(contents, maxTokens, temp, systemInstruction);
            }
            throw new Error(d.error?.message || 'Gemini API Error');
        }
        const text = d.candidates[0].content.parts[0].text;
        console.log(`[Gemini Router] ✓ ${model} responded (${text.length} chars)`);
        return text;
    } catch (e) {
        if (model === MODELS.pro) {
            console.warn('[Gemini Router] Pro exception, falling back to Flash');
            return gemFlashFallback(contents, maxTokens, temp, systemInstruction);
        }
        throw e;
    }
}

async function gemProxy(model, contents, maxTokens, temp, systemInstruction) {
    try {
        const r = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Apps Script requires no-cors for simple redirects, or handle redirects carefully
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'proxy_gemini',
                model,
                contents,
                generationConfig: { maxOutputTokens: maxTokens, temperature: temp },
                system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : null
            })
        });
        
        // Note: with 'no-cors', we can't read the response. 
        // We'll likely need a different approach for read-write cycles in Apps Script (e.g. JSONP or simpler CORS)
        // For now, I'll assume standard fetch with CORS handling on the Apps Script side.
        
        // Re-attempting standard CORS fetch
        const r2 = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'proxy_gemini',
                model,
                contents,
                generationConfig: { maxOutputTokens: maxTokens, temperature: temp },
                system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : null
            })
        });
        const d = await r2.json();
        if (!r2.ok || d.error) throw new Error(d.error || 'Proxy Error');
        return d.text;
    } catch (e) {
        throw new Error("Gemini Proxy Failed: " + e.message);
    }
}

async function gemFlashFallback(contents, maxTokens, temp, systemInstruction = "") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.flash}:generateContent?key=${GKEY}`;
    const body = {
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature: temp }
    };
    if (systemInstruction) {
        body.system_instruction = { parts: [{ text: systemInstruction }] };
    }
    
    const r = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Gemini Flash Fallback Error');
    return d.candidates[0].content.parts[0].text;
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
