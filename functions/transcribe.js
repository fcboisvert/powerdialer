export async function onRequestPost(context) {
    const { request, env } = context;

    // Create abort controller with 25s timeout (Cloudflare limit is 30s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');

        if (!audioFile) {
            clearTimeout(timeoutId);
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

        // Check file size (Whisper API limit is 25MB)
        const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB
        if (audioFile.size > MAX_WHISPER_SIZE) {
            clearTimeout(timeoutId);
            return new Response(JSON.stringify({
                success: false,
                error: `File size (${(audioFile.size / 1024 / 1024).toFixed(2)}MB) exceeds Whisper API limit of 25MB`
            }), {
                status: 413,
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
            timeout: 24000, // Slightly less than our abort timeout
        });

        console.log(`🎙️ Transcribing audio: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)}MB)`);

        try {
            const response = await openai.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-1',
                response_format: 'text',
                // Remove hardcoded language to let Whisper auto-detect
                // language: 'fr', // Removed - let Whisper detect
            }, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Log success for monitoring
            console.log(`✅ Transcription successful: ${audioFile.name}`);

            return new Response(JSON.stringify({
                success: true,
                transcription: response,
                metadata: {
                    filename: audioFile.name,
                    size: audioFile.size,
                    processingTime: Date.now() - startTime,
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });

        } catch (innerError) {
            if (innerError.name === 'AbortError') {
                clearTimeout(timeoutId);
                console.error('⏱️ Transcription timeout');

                return new Response(JSON.stringify({
                    success: false,
                    error: 'Transcription timeout - file may be too long for processing. Try a shorter audio file.',
                    suggestion: 'Consider splitting your audio file into smaller segments.'
                }), {
                    status: 524,
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

        console.error('❌ Transcription error:', error);

        // Handle specific OpenAI errors
        let errorMessage = error.message || 'Transcription failed';
        let statusCode = 500;

        if (error.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
            statusCode = 429;
        } else if (error.status === 401) {
            errorMessage = 'API authentication failed';
            statusCode = 401;
        } else if (error.status === 400) {
            errorMessage = 'Invalid audio file format. Supported formats: MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM';
            statusCode = 400;
        }

        return new Response(JSON.stringify({
            success: false,
            error: errorMessage,
            details: env.ENVIRONMENT === 'development' ? error.stack : undefined
        }), {
            status: statusCode,
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

// Add a timing tracker
const startTime = Date.now();
