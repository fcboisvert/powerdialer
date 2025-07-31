export async function onRequestPost(context) {
    const { request, env } = context;
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    // Log request start
    console.log(`[${requestId}] 🚀 Transcription request started at ${new Date().toISOString()}`);

    // INCREASED TIMEOUT: 28s for Cloudflare's 30s limit (keeping 2s buffer)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`[${requestId}] ⏱️ Aborting request after 28s timeout`);
        controller.abort();
    }, 28000);

    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio');

        if (!audioFile) {
            clearTimeout(timeoutId);
            console.error(`[${requestId}] ❌ No audio file provided`);
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

        // Log file details for monitoring
        const fileInfo = {
            name: audioFile.name,
            size: audioFile.size,
            sizeInMB: (audioFile.size / 1024 / 1024).toFixed(2),
            type: audioFile.type || 'unknown',
            extension: audioFile.name.toLowerCase().split('.').pop()
        };

        console.log(`[${requestId}] 🎙️ File received:`, JSON.stringify(fileInfo));

        // Estimate processing time based on file size
        const estimatedProcessingTime = (audioFile.size / (1024 * 1024)) * 2.5; // ~2.5 seconds per MB
        console.log(`[${requestId}] ⏳ Estimated processing time: ${estimatedProcessingTime.toFixed(1)}s`);

        // Check if estimated time exceeds timeout
        if (estimatedProcessingTime > 25) {
            clearTimeout(timeoutId);
            console.warn(`[${requestId}] ⚠️ File too large for sync processing (est: ${estimatedProcessingTime.toFixed(1)}s)`);

            return new Response(JSON.stringify({
                success: false,
                error: `File is too large to process within time limits. Estimated processing time: ${estimatedProcessingTime.toFixed(1)}s, but maximum is 28s.`,
                suggestion: 'Please use a shorter audio file (< 10 minutes) or compress it: ffmpeg -i input.mp3 -b:a 64k -ar 16000 output.mp3',
                shouldUseAsync: true,
                estimatedTime: estimatedProcessingTime
            }), {
                status: 413,
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
            console.error(`[${requestId}] ❌ File size exceeds Whisper limit`);
            return new Response(JSON.stringify({
                success: false,
                error: `File size (${fileInfo.sizeInMB}MB) exceeds Whisper API limit of 25MB`,
                suggestion: 'Compress your audio file using: ffmpeg -i input.mp3 -b:a 96k output.mp3'
            }), {
                status: 413,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Validate file extension
        const validExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.mpga', '.webm'];
        const fileExtension = '.' + fileInfo.extension;

        if (!validExtensions.includes(fileExtension)) {
            clearTimeout(timeoutId);
            console.error(`[${requestId}] ❌ Invalid file extension: ${fileExtension}`);
            return new Response(JSON.stringify({
                success: false,
                error: `Invalid file extension: ${fileExtension}. Supported: ${validExtensions.join(', ')}`,
                suggestion: 'Please ensure your file has a valid audio extension.'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // Process the file based on type
        let processedFile = audioFile;

        // Special handling for M4A files
        if (fileExtension === '.m4a') {
            console.log(`[${requestId}] 🎵 M4A file detected - applying compatibility fixes`);

            try {
                const arrayBuffer = await audioFile.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);

                // Check file signature
                const hex = Array.from(bytes.slice(0, 16))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');

                console.log(`[${requestId}] 🔍 M4A signature: ${hex}`);

                // Verify it's a valid M4A/MP4 file
                if (hex.substring(8, 16) !== '66747970') {
                    throw new Error('Invalid M4A file signature - file may be corrupted');
                }

                // Convert M4A to MP4 for better Whisper compatibility
                const mp4Blob = new Blob([arrayBuffer], { type: 'audio/mp4' });
                const mp4FileName = audioFile.name.replace(/\.m4a$/i, '.mp4');
                processedFile = new File([mp4Blob], mp4FileName, {
                    type: 'audio/mp4',
                    lastModified: audioFile.lastModified
                });

                console.log(`[${requestId}] ✅ M4A → MP4 conversion applied`);

            } catch (m4aError) {
                console.error(`[${requestId}] ❌ M4A processing error:`, m4aError);
                clearTimeout(timeoutId);

                return new Response(JSON.stringify({
                    success: false,
                    error: 'This M4A file is not compatible with the transcription API.',
                    suggestion: 'The M4A file may use an unsupported codec. Please convert to MP3 for better compatibility.'
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

        } else {
            // For other formats, ensure correct MIME type
            const mimeTypes = {
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.mp4': 'audio/mp4',
                '.mpeg': 'audio/mpeg',
                '.mpga': 'audio/mpeg',
                '.webm': 'audio/webm'
            };

            const correctMimeType = mimeTypes[fileExtension];

            // Fix MIME type if needed
            if (correctMimeType && (!audioFile.type || audioFile.type === 'application/octet-stream')) {
                console.log(`[${requestId}] 🔧 Correcting MIME type to: ${correctMimeType}`);
                const arrayBuffer = await audioFile.arrayBuffer();
                const blob = new Blob([arrayBuffer], { type: correctMimeType });
                processedFile = new File([blob], audioFile.name, { type: correctMimeType });
            }
        }

        // Import OpenAI
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({
            apiKey: env.OPENAI_API_KEY,
            timeout: 27000, // Slightly less than our abort timeout
        });

        const whisperStartTime = Date.now();

        try {
            console.log(`[${requestId}] 📤 Sending to Whisper API (${fileInfo.sizeInMB}MB file)...`);
            console.log(`[${requestId}] ⏰ Current elapsed time: ${(Date.now() - startTime) / 1000}s`);

            // Call Whisper API with minimal parameters for better compatibility
            const response = await openai.audio.transcriptions.create({
                file: processedFile,
                model: 'whisper-1',
                response_format: 'text',
                // Don't specify language - let Whisper auto-detect
            }, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const whisperTime = Date.now() - whisperStartTime;
            const totalTime = Date.now() - startTime;

            console.log(`[${requestId}] ✅ Transcription successful`);
            console.log(`[${requestId}] ⏱️ Whisper API time: ${whisperTime}ms (${(whisperTime / 1000).toFixed(1)}s)`);
            console.log(`[${requestId}] ⏱️ Total processing time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);

            return new Response(JSON.stringify({
                success: true,
                transcription: response,
                metadata: {
                    filename: audioFile.name,
                    size: audioFile.size,
                    processingTime: totalTime,
                    whisperTime: whisperTime,
                    wasM4A: fileExtension === '.m4a'
                }
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });

        } catch (innerError) {
            clearTimeout(timeoutId);

            const errorTime = Date.now() - startTime;

            // Log error details for debugging
            console.error(`[${requestId}] ❌ Whisper API error after ${errorTime}ms:`, {
                message: innerError.message,
                status: innerError.status,
                code: innerError.code,
                type: innerError.constructor.name,
                name: innerError.name,
                stack: innerError.stack?.split('\n')[0],
                processingTime: errorTime
            });

            if (innerError.name === 'AbortError' || innerError.message?.includes('aborted')) {
                const timeElapsed = (errorTime / 1000).toFixed(1);
                console.error(`[${requestId}] ⏱️ Request aborted after ${timeElapsed}s`);

                return new Response(JSON.stringify({
                    success: false,
                    error: `Request was aborted after ${timeElapsed}s. The file is too large to process within the 28-second time limit.`,
                    suggestion: 'For files longer than 10 minutes, please compress them first: ffmpeg -i input.mp3 -b:a 64k -ar 16000 -ac 1 output.mp3',
                    details: {
                        fileSize: fileInfo.sizeInMB + 'MB',
                        timeElapsed: timeElapsed + 's',
                        estimatedDuration: estimatedProcessingTime.toFixed(1) + 's'
                    }
                }), {
                    status: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            // Handle specific Whisper API errors
            if (innerError.status === 400 || innerError.message?.includes('Invalid file format')) {
                let suggestion = 'Try converting your file to standard MP3 format.';

                if (fileExtension === '.m4a') {
                    suggestion = 'This M4A file uses an unsupported codec. Convert to MP3: ffmpeg -i audio.m4a -c:a mp3 -b:a 128k audio.mp3';
                } else if (fileExtension === '.webm') {
                    suggestion = 'This WebM file may use an unsupported codec. Convert to MP3: ffmpeg -i audio.webm -c:a mp3 audio.mp3';
                }

                return new Response(JSON.stringify({
                    success: false,
                    error: 'Audio file format not supported by transcription service.',
                    suggestion: suggestion
                }), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                });
            }

            // Re-throw other errors to be handled by outer catch
            throw innerError;
        }

    } catch (error) {
        clearTimeout(timeoutId);

        const finalTime = Date.now() - startTime;
        console.error(`[${requestId}] ❌ Final transcription error after ${finalTime}ms:`, error);

        // Handle specific errors
        let errorMessage = error.message || 'Transcription failed';
        let statusCode = error.status || 500;
        let suggestion = '';

        if (error.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
            statusCode = 429;
        } else if (error.status === 401) {
            errorMessage = 'API authentication failed';
            statusCode = 401;
        } else if (error.status === 400) {
            errorMessage = 'Invalid audio file format or corrupted file.';
            suggestion = 'Ensure your file is a valid audio file and try converting to MP3 if problems persist.';
            statusCode = 400;
        } else if (error.message?.includes('timeout') || error.message?.includes('aborted')) {
            errorMessage = `Processing timeout after ${(finalTime / 1000).toFixed(1)}s - file took too long to process.`;
            suggestion = 'Compress your audio for faster processing: ffmpeg -i input.mp3 -b:a 64k -ar 16000 -ac 1 output.mp3';
            statusCode = 504;
        }

        return new Response(JSON.stringify({
            success: false,
            error: errorMessage,
            suggestion: suggestion,
            processingTime: finalTime,
            details: env.ENVIRONMENT === 'development' ? {
                stack: error.stack,
                originalError: error.message,
                requestId: requestId
            } : { requestId: requestId }
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
