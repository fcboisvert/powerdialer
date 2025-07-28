import OpenAI from 'openai';

export interface Env {
  OPENAI_API_KEY: string;
}

const analyzeTranscript = async (transcription: string, apiKey: string): Promise<string> => {
  const openai = new OpenAI({
    apiKey: apiKey,
    timeout: 120000,
  });

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
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 3000,
  });

  return completion.choices[0].message.content || '';
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      const body = await request.json();
      const { transcription } = body;

      if (!transcription) {
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

      console.log('🔄 Analyzing transcript with GPT-4...');
      const analysis = await analyzeTranscript(transcription, env.OPENAI_API_KEY);

      return new Response(JSON.stringify({
        success: true,
        analysis,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error: any) {
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
  },
};