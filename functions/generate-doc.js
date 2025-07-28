export async function onRequestPost(context) {
    const { request, env } = context;

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

        const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import('docx');

        // Create Word document
        const sections = content.split('\n\n');
        const paragraphs = [];

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
                        text: `Fichier source: ${filename || 'unknown'}`,
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

        // Process sections
        sections.forEach((section) => {
            const trimmedSection = section.trim();
            if (!trimmedSection) return;

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
                const lines = trimmedSection.split('\n');
                lines.forEach((line) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return;

                    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
                        paragraphs.push(
                            new Paragraph({
                                text: trimmedLine.substring(2),
                                bullet: { level: 0 },
                                spacing: { after: 100 },
                            })
                        );
                    } else if (trimmedLine.includes(':') && trimmedLine.length < 100) {
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

        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children: paragraphs,
                },
            ],
        });

        const buffer = await Packer.toBuffer(doc);
        const outputFilename = `Meeting-Summary-${filename?.replace(/\.[^/.]+$/, '') || 'transcript'}.docx`;

        return new Response(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${outputFilename}"`,
                'Content-Length': buffer.byteLength.toString(),
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
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