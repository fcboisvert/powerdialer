export async function onRequestPost(context) {
    const { request, env } = context;

    // Create abort controller with 20s timeout (leaving buffer for Cloudflare's 30s limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
        const body = await request.json();
        const { transcription } = body;

        if (!transcription) {
            clearTimeout(timeoutId);
            return new Response(JSON.stringify({
                success: false,
                error: 'No transcription provided'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Estimate processing time based on transcript length
        const transcriptLength = transcription.length;
        const estimatedProcessingTime = transcriptLength > 5000 ? 'long' : 'short';

        console.log(`📊 Transcript length: ${transcriptLength} chars - Estimated: ${estimatedProcessingTime}`);

        // For very long transcripts, immediately delegate to async processing
        if (transcriptLength > 10000) {
            clearTimeout(timeoutId);
            console.log('📤 Delegating to async processing due to length');

            // Forward to async endpoint
            const asyncResponse = await fetch(`${request.url.origin}/analyze-async`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ transcription }),
            });

            const asyncResult = await asyncResponse.json();
            return new Response(JSON.stringify(asyncResult), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Try synchronous processing for shorter transcripts
        try {
            const { default: OpenAI } = await import('openai');
            const openai = new OpenAI({
                apiKey: env.OPENAI_API_KEY,
                timeout: 19000, // Slightly less than our abort timeout
            });

            // Use GPT-3.5 for shorter transcripts (faster)
            const model = transcriptLength < 3000 ? 'gpt-3.5-turbo' : 'gpt-4-turbo';
            console.log(`🤖 Using model: ${model}`);

            const prompt = `
Analyze this conversation transcript and produce the following:

1. Identify the language spoken.
2. Provide a concise summary in the identified language:
   - Minimum of 3 sentences and a maximum of 7 sentences, depending on the length and complexity of the transcript.
   - Use fewer sentences for shorter, simpler transcripts, and more sentences for longer, detailed transcripts.
3. Provide clear action items as bullet points in the identified language.
4. Format the transcript clearly with accurate speaker labels in the identified language, preserving the original dialogue order. 

Important rules:
- If only one speaker is detected throughout the entire transcript, label all utterances consistently as "Locuteur unique" (for French) or "Single Speaker" (for English), rather than introducing multiple speakers. 
- Do not assume multiple speakers unless clearly indicated by the content or clear dialogue shifts.

Transcript:
${transcription}`;

            const completion = await openai.chat.completions.create({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 3000,
            }, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            return new Response(JSON.stringify({
                success: true,
                analysis: completion.choices[0].message.content || '',
                processedBy: 'sync',
                model: model
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });

        } catch (innerError) {
            // If it's a timeout, switch to async processing
            if (innerError.name === 'AbortError') {
                clearTimeout(timeoutId);
                console.log('⏱️ Timeout detected, switching to async processing');

                // Forward to async endpoint
                const asyncResponse = await fetch(`${request.url.origin}/analyze-async`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ transcription }),
                });

                const asyncResult = await asyncResponse.json();
                return new Response(JSON.stringify({
                    ...asyncResult,
                    message: 'Processing time exceeded limit. Switched to background processing.',
                }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            throw innerError; // Re-throw other errors
        }

    } catch (error) {
        clearTimeout(timeoutId);

        console.error('❌ Analysis API error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Analysis failed',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}
