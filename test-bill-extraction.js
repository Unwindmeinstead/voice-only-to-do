/**
 * Mock Verification Script for Bill Extraction Logic
 * Since we can't run OAuth/Gmail API here, we test the AI parsing logic.
 */

const sampleSnippet = "Your Comcast invoice for February is ready. The amount of $85.42 is due on March 1st, 2026. Log in to your account to pay.";

async function testExtraction(apiKey, model) {
    const systemPrompt = `Extract bill details from this email snippet. 
    Return ONLY a valid JSON object with: 
    { "merchant": "name", "amount": "dollar value", "dueDate": "YYYY-MM-DD or readable date", "isBill": true/false }
    If it's NOT a bill, set isBill to false. 
    Snippet: "${sampleSnippet}"`;

    console.log("Testing with snippet:", sampleSnippet);

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'system', content: systemPrompt }],
                temperature: 0.1,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            console.error("AI Request failed with status:", response.status);
            return;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        console.log("AI Response Content:", content);

        const billInfo = JSON.parse(content.replace(/```json|```/g, '').trim());
        console.log("Parsed Bill Info:", billInfo);

        if (billInfo.merchant && billInfo.amount && billInfo.isBill) {
            console.log("✅ Verification SUCCESS: Extraction works correctly.");
        } else {
            console.log("❌ Verification FAILED: Extraction missing details.");
        }
    } catch (e) {
        console.error("Test Error:", e);
    }
}

const key = process.argv[2];
if (key) {
    testExtraction(key, "llama-3.1-8b-instant");
} else {
    console.log("Please provide a Groq API Key: node test-bill-extraction.js <key>");
}
