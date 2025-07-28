import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

export interface Env {
  // Add any environment variables if needed
}

const createWordDocument = async (content: string, originalFilename: string): Promise<ArrayBuffer> => {
  // Split content into sections for better formatting
  const sections = content.split('\n\n');
  const paragraphs: Paragraph[] = [];

  // Add title
  paragraphs.push(
    new Paragraph({
      text: 'Compte-rendu de réunion',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
    })
  );

  // Add source info
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Fichier source: ${originalFilename}`,
          bold: true,
        }),
        new TextRun({
          text: `\nDate de génération: ${new Date().toLocaleDateString('fr-FR')}`,
          break: 1,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Process each section
  sections.forEach((section) => {
    const trimmedSection = section.trim();
    if (!trimmedSection) return;

    // Check if this is a heading (starts with number or specific keywords)
    const isHeading = /^(\d+\.|•|RÉSUMÉ|SUMMARY|ACTION|TRANSCRIPT|TRANSCRIPTION)/i.test(trimmedSection);

    if (isHeading) {
      paragraphs.push(
        new Paragraph({
          text: trimmedSection,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 200 },
        })
      );
    } else {
      // Handle bullet points and regular paragraphs
      const lines = trimmedSection.split('\n');
      lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
          // Bullet point
          paragraphs.push(
            new Paragraph({
              text: trimmedLine.substring(2),
              bullet: { level: 0 },
              spacing: { after: 100 },
            })
          );
        } else if (trimmedLine.includes(':') && trimmedLine.length < 100) {
          // Speaker label or short descriptive line
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedLine,
                  bold: true,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        } else {
          // Regular paragraph
          paragraphs.push(
            new Paragraph({
              text: trimmedLine,
              spacing: { after: 100 },
            })
          );
        }
      });
    }
  });

  // Create the document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer.buffer as ArrayBuffer;
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
      const { content, filename } = body;

      if (!content) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No content provided'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      console.log('🔄 Generating Word document...');
      const buffer = await createWordDocument(content, filename || 'unknown-file');

      // Set headers for file download
      const outputFilename = `Meeting-Summary-${filename?.replace(/\.[^/.]+$/, '') || 'transcript'}.docx`;

      return new Response(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${outputFilename}"`,
          'Content-Length': buffer.byteLength.toString(),
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error: any) {
      console.error('❌ Document generation error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Document generation failed',
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