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

        // Log file details for debugging
        console.log(`🎙️ Received file:`, {
            name: audioFile.name,
            size: audioFile.size,
            type: audioFile.type || 'unknown',
            sizeInMB: (audioFile.size / 1024 / 1024).toFixed(2)
        });

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

        // Validate file extension
        const fileName = audioFile.name.toLowerCase();
        const validExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.mpga', '.webm'];
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

        if (!validExtensions.includes(fileExtension)) {
            clearTimeout(timeoutId);
            console.error(`❌ Invalid file extension: ${fileExtension}`);
            return new Response(JSON.stringify({
                success: false,
                error: `Invalid file extension: ${fileExtension}. Supported: ${validExtensions.join(', ')}`
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Read first few bytes to validate it's actually an audio file
        const arrayBuffer = await audioFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Check file signatures (magic numbers)
        const isValidAudio = checkAudioSignature(bytes, fileExtension);

        if (!isValidAudio) {
            clearTimeout(timeoutId);
            console.error(`❌ File signature check failed - not a valid ${fileExtension} file`);
            return new Response(JSON.stringify({
                success: false,
                error: `The file appears to be corrupted or is not a valid ${fileExtension} audio file. Please ensure you're uploading a real audio file.`
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Determine correct MIME type based on extension
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.m4a': 'audio/mp4',
            '.mp4': 'audio/mp4',
            '.mpeg': 'audio/mpeg',
            '.mpga': 'audio/mpeg',
            '.webm': 'audio/webm'
        };

        const correctMimeType = mimeTypes[fileExtension] || 'audio/mpeg';

        // Create a new File/Blob with the correct MIME type
        const audioBlob = new Blob([arrayBuffer], { type: correctMimeType });
        const processedFile = new File([audioBlob], audioFile.name, { type: correctMimeType });

        console.log(`📝 Processed file:`, {
            name: processedFile.name,
            type: processedFile.type,
            size: processedFile.size
        });

        // Dynamic import of OpenAI
        const { default: OpenAI } = await import('openai');

        const openai = new OpenAI({
            apiKey: env.OPENAI_API_KEY,
            timeout: 24000, // Slightly less than our abort timeout
        });

        // Track start time for performance monitoring
        const startTime = Date.now();

        try {
            console.log(`🎙️ Sending to Whisper API...`);

            const response = await openai.audio.transcriptions.create({
                file: processedFile,
                model: 'whisper-1',
                response_format: 'text',
                // Let Whisper auto-detect language
            }, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Log success for monitoring
            const processingTime = Date.now() - startTime;
            console.log(`✅ Transcription successful in ${processingTime}ms`);

            return new Response(JSON.stringify({
                success: true,
                transcription: response,
                metadata: {
                    filename: audioFile.name,
                    size: audioFile.size,
                    processingTime: processingTime,
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
                    suggestion: 'Consider compressing your audio file or using a lower bitrate.'
                }), {
                    status: 524,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            // Log the actual error for debugging
            console.error('❌ Whisper API error:', {
                message: innerError.message,
                status: innerError.status,
                type: innerError.constructor.name,
                response: innerError.response?.data || innerError.response || 'No response data'
            });

            throw innerError; // Re-throw other errors
        }

    } catch (error) {
        clearTimeout(timeoutId);

        console.error('❌ Transcription error:', error);

        // Handle specific OpenAI errors
        let errorMessage = error.message || 'Transcription failed';
        let statusCode = 500;
        let suggestion = '';

        if (error.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
            statusCode = 429;
        } else if (error.status === 401) {
            errorMessage = 'API authentication failed';
            statusCode = 401;
        } else if (error.status === 400 || error.message?.includes('Invalid file format')) {
            // Get more specific error details
            const errorDetails = error.response?.data?.error?.message || error.message;
            console.error('Format error details:', errorDetails);

            errorMessage = 'Invalid audio file format. The file may be corrupted or use an unsupported codec.';
            suggestion = 'Try converting your audio to a standard MP3 or WAV format using an audio converter.';
            statusCode = 400;
        }

        return new Response(JSON.stringify({
            success: false,
            error: errorMessage,
            suggestion: suggestion,
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

// Function to check audio file signatures (magic numbers)
function checkAudioSignature(bytes, extension) {
    if (bytes.length < 4) return false;

    // Convert first few bytes to hex string for comparison
    const hex = Array.from(bytes.slice(0, 12))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    console.log(`🔍 File signature (hex): ${hex}`);

    switch (extension) {
        case '.mp3':
            // MP3 files can start with ID3 tag or MPEG sync
            return hex.startsWith('494433') || // ID3
                hex.startsWith('fffb') || // MPEG-1 Layer 3
                hex.startsWith('fff3') || // MPEG-2 Layer 3
                hex.startsWith('ffe3');    // MPEG-2.5 Layer 3

        case '.wav':
            // WAV files start with "RIFF"
            return hex.startsWith('52494646') && hex.substring(16, 24) === '57415645'; // RIFF...WAVE

        case '.m4a':
        case '.mp4':
            // M4A/MP4 files have "ftyp" at offset 4
            return hex.substring(8, 16) === '66747970'; // ftyp

        case '.webm':
            // WebM files start with EBML header
            return hex.startsWith('1a45dfa3');

        case '.mpeg':
        case '.mpga':
            // MPEG files typically start with sync pattern
            return hex.startsWith('fffb') || hex.startsWith('fff3') || hex.startsWith('ffe3');

        default:
            return false;
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
