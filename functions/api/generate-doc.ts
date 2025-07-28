// /mnt/c/Users/Frédéric-CharlesBois/projects/Powerdialer/functions/api/transcribe.ts
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
});

const MAX_CHUNK_DURATION = 300; // 5 min per chunk
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

const splitAudio = async (filePath: string): Promise<string[]> => {
  const chunkDir = path.join(path.dirname(filePath), 'chunks');
  await fsPromises.mkdir(chunkDir, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions(['-f segment', `-segment_time ${MAX_CHUNK_DURATION}`, '-c copy'])
      .output(path.join(chunkDir, 'chunk_%03d.mp3'))
      .on('end', async () => {
        const files = (await fsPromises.readdir(chunkDir))
          .map(f => path.join(chunkDir, f))
          .sort();
        resolve(files);
      })
      .on('error', reject)
      .run();
  });
};

const transcribeChunk = async (chunkPath: string): Promise<string> => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const stream = fs.createReadStream(chunkPath);
      const response = await openai.audio.transcriptions.create({
        file: stream,
        model: 'whisper-1',
        response_format: 'text',
      });
      return response;
    } catch (error: any) {
      console.error(`❌ Error transcribing chunk (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      if (attempt === MAX_RETRIES) throw error;
      console.log(`🔄 Retrying in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(res => setTimeout(res, RETRY_DELAY));
    }
  }
  throw new Error('Failed to transcribe after retries');
};

const transcribeAudio = async (filePath: string): Promise<string> => {
  const { size } = await fsPromises.stat(filePath);
  const MAX_SIZE_BYTES = 24 * 1024 * 1024;

  if (size <= MAX_SIZE_BYTES) {
    console.log('🔄 Transcribing single audio file...');
    return await transcribeChunk(filePath);
  }

  console.log('🔄 Large file detected. Splitting audio...');
  const chunks = await splitAudio(filePath);

  let combinedTranscript = '';
  for (let i = 0; i < chunks.length; i++) {
    console.log(`🔄 Transcribing chunk ${i + 1}/${chunks.length}`);
    combinedTranscript += await transcribeChunk(chunks[i]) + '\n';
    try {
      await fsPromises.unlink(chunks[i]);
    } catch (cleanupError) {
      console.warn(`⚠️ Error cleaning chunk ${i + 1}:`, cleanupError);
    }
  }

  try {
    await fsPromises.rmdir(path.join(path.dirname(filePath), 'chunks'));
  } catch (dirError) {
    console.warn('⚠️ Error removing chunk directory:', dirError);
  }

  return combinedTranscript;
};

export async function onRequestPost(context: any) {
  try {
    console.log('🔄 Starting transcription process...');

    const request = context.request;
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No audio file provided' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`🎵 Processing file: ${audioFile.name} (${audioFile.size} bytes)`);

    // Save uploaded file to temporary location
    const buffer = await audioFile.arrayBuffer();
    const tempFilePath = `/tmp/${Date.now()}-${audioFile.name}`;
    await fsPromises.writeFile(tempFilePath, Buffer.from(buffer));

    // Transcribe the audio
    const transcription = await transcribeAudio(tempFilePath);

    // Clean up uploaded file
    try {
      await fsPromises.unlink(tempFilePath);
    } catch (cleanupError) {
      console.warn('⚠️ Error cleaning up uploaded file:', cleanupError);
    }

    console.log('✅ Transcription completed successfully');

    return new Response(JSON.stringify({
      success: true,
      transcription,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Transcription API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Transcription failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}