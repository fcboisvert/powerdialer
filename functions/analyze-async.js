// transcribe-async.js - For files that take > 30 seconds
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

        const fileInfo = {
            name: audioFile.name,
            size: audioFile.size,
            sizeInMB: (audioFile.size / 1024 / 1024).toFixed(2),
        };

        console.log(`🎙️ Large file received for async processing:`, fileInfo);

        // Store file in R2 or KV
        const fileId = crypto.randomUUID();
        const arrayBuffer = await audioFile.arrayBuffer();

        // Store in R2 bucket (you need to set this up in Cloudflare)
        if (env.R2_BUCKET) {
            await env.R2_BUCKET.put(fileId, arrayBuffer, {
                customMetadata: {
                    filename: audioFile.name,
                    size: audioFile.size.toString(),
                    type: audioFile.type || 'audio/mpeg'
                }
            });
        } else {
            // Fallback to KV (limited to 25MB)
            await env.TRANSCRIPTION_QUEUE.put(fileId, arrayBuffer, {
                metadata: {
                    filename: audioFile.name,
                    size: audioFile.size,
                    type: audioFile.type || 'audio/mpeg'
                },
                expirationTtl: 3600 // 1 hour
            });
        }

        // Queue the transcription job
        const jobId = crypto.randomUUID();
        await env.TRANSCRIPTION_JOBS.put(jobId, JSON.stringify({
            status: 'queued',
            fileId: fileId,
            filename: audioFile.name,
            createdAt: new Date().toISOString()
        }), {
            expirationTtl: 3600 // 1 hour
        });

        // If using Cloudflare Queues
        if (env.TRANSCRIPTION_QUEUE) {
            await env.TRANSCRIPTION_QUEUE.send({
                jobId: jobId,
                fileId: fileId,
                filename: audioFile.name
            });
        }

        return new Response(JSON.stringify({
            success: true,
            jobId: jobId,
            message: 'File queued for transcription. Check status with jobId.',
            estimatedTime: 'Large files may take 2-5 minutes to process.'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        console.error('❌ Async transcription setup error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Failed to queue transcription'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }
}

// Queue consumer (runs outside of request context)
export async function queue(batch, env) {
    for (const message of batch.messages) {
        const { jobId, fileId, filename } = message.body;

        try {
            // Get file from storage
            const fileData = await env.R2_BUCKET.get(fileId);
            const arrayBuffer = await fileData.arrayBuffer();

            // Create File object
            const file = new File([arrayBuffer], filename, {
                type: fileData.customMetadata.type
            });

            // Process with OpenAI (no timeout here)
            const { default: OpenAI } = await import('openai');
            const openai = new OpenAI({
                apiKey: env.OPENAI_API_KEY,
            });

            const response = await openai.audio.transcriptions.create({
                file: file,
                model: 'whisper-1',
                response_format: 'text',
            });

            // Update job status
            await env.TRANSCRIPTION_JOBS.put(jobId, JSON.stringify({
                status: 'completed',
                transcription: response,
                completedAt: new Date().toISOString()
            }));

            // Clean up file
            await env.R2_BUCKET.delete(fileId);

            message.ack();

        } catch (error) {
            console.error('Queue processing error:', error);

            await env.TRANSCRIPTION_JOBS.put(jobId, JSON.stringify({
                status: 'failed',
                error: error.message,
                failedAt: new Date().toISOString()
            }));

            message.retry();
        }
    }
}  
