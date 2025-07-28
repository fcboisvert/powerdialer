// /mnt/c/Users/Frédéric-CharlesBois/projects/Powerdialer/functions/api/analyze.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000,
});

const analyzeTranscript = async (transcription: string): Promise<string> => {
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

export async function onRequestPost(context: any) {
  try {
    const request = context.request;
    const { transcription } = await request.json();

    if (!transcription) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No transcription provided' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('🔄 Analyzing transcript with GPT-4...');
    const analysis = await analyzeTranscript(transcription);

    return new Response(JSON.stringify({
      success: true,
      analysis,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Analysis API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Analysis failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}