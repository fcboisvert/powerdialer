// /mnt/c/Users/Frédéric-CharlesBois/projects/Powerdialer/src/pages/api/transcribe.ts
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
});

const MAX_CHUNK_DURATION = 300; // 5 min per chunk
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

// Disable Next.js body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Starting transcription process...');

    // Parse the uploaded file
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
    });

    const [fields, files] = await form.parse(req);
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;

    if (!audioFile) {
      return res.status(400).json({ 
        success: false,
        error: 'No audio file provided' 
      });
    }

    console.log(`🎵 Processing file: ${audioFile.originalFilename} (${audioFile.size} bytes)`);

    // Transcribe the audio
    const transcription = await transcribeAudio(audioFile.filepath);

    // Clean up uploaded file
    try {
      await fsPromises.unlink(audioFile.filepath);
    } catch (cleanupError) {
      console.warn('⚠️ Error cleaning up uploaded file:', cleanupError);
    }

    console.log('✅ Transcription completed successfully');

    res.status(200).json({
      success: true,
      transcription,
    });

  } catch (error: any) {
    console.error('❌ Transcription API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Transcription failed',
    });
  }
}