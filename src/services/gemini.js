const GKEY = "AIzaSyDnOmsfj0_uhXkjjFON0Ji3roF5VIZg-VM".trim();

// Model routing: flash for quick conversational turns, pro for deep analysis & proposal gen
const MODELS = {
    flash: "gemini-1.5-flash",   // fast, cheap — greetings, short Q&A, simple follow-ups
    pro:   "gemini-1.5-pro"      // powerful — complex analysis, proposal generation, solution design
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
