export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');

        if (!audioFile) {
            return new Response(JSON.stringify({
                success: false,
                error: 'No audio file provided'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Dynamic import of OpenAI
        const { default: OpenAI } = await import('openai');

        const openai = new OpenAI({
            apiKey: env.OPENAI_API_KEY,
            timeout: 120000,
        });

        console.log(`🎙️ Transcribing audio: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)}MB)`);

        const response = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            response_format: 'text',
            language: 'fr',
        });

        return new Response(JSON.stringify({
            success: true,
            transcription: response,
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        console.error('❌ Transcription error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Transcription failed',
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