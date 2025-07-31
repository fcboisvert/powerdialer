export async function onRequestPost(context) {
    const { request, env } = context;

    // Add timeout protection (10s should be more than enough for doc generation)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const body = await request.json();
        const { content, filename, metadata = {} } = body;

        if (!content) {
            clearTimeout(timeoutId);
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

        console.log(`📄 Generating document for: ${filename || 'unnamed'}`);

        const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = await import('docx');

        // Detect language from content
        const isFrench = /résumé|actions à prendre|transcription|locuteur/i.test(content);
        const documentTitle = isFrench ? 'Compte-rendu de réunion' : 'Meeting Summary';
        const sourceLabel = isFrench ? 'Fichier source' : 'Source file';
        const dateLabel = isFrench ? 'Date de génération' : 'Generated on';

        // Create Word document
        const sections = content.split('\n\n');
        const paragraphs = [];

        // Add title with better formatting
        paragraphs.push(
            new Paragraph({
                text: documentTitle,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            })
        );

        // Add metadata section
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${sourceLabel}: `,
                        bold: true,
                    }),
                    new TextRun({
                        text: filename || 'unknown',
                    }),
                ],
                spacing: { after: 200 },
            })
        );

        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `${dateLabel}: `,
                        bold: true,
                    }),
                    new TextRun({
                        text: new Date().toLocaleDateString(isFrench ? 'fr-FR' : 'en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                    }),
                ],
                spacing: { after: 200 },
            })
        );

        // Add processing metadata if available
        if (metadata.model || metadata.processedBy) {
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Processing info: ',
                            bold: true,
                            size: 20,
                            color: '666666',
                        }),
                        new TextRun({
                            text: `${metadata.model || 'AI'} (${metadata.processedBy || 'sync'})`,
                            size: 20,
                            color: '666666',
                        }),
                    ],
                    spacing: { after: 400 },
                })
            );
        }

        // Add horizontal line separator
        paragraphs.push(
            new Paragraph({
                text: '─'.repeat(50),
                spacing: { before: 200, after: 400 },
                alignment: AlignmentType.CENTER,
            })
        );

        // Process sections with better detection
        sections.forEach((section) => {
            const trimmedSection = section.trim();
            if (!trimmedSection) return;

            // Enhanced heading detection for both languages
            const headingPatterns = [
                /^(résumé|summary)$/i,
                /^(actions à prendre|action items)$/i,
                /^(transcription|transcript)$/i,
                /^##\s*(.+)$/,  // Markdown style headings
                /^\d+\.\s*(.+)$/, // Numbered headings
            ];

            const isHeading = headingPatterns.some(pattern => pattern.test(trimmedSection));

            if (isHeading || trimmedSection.startsWith('##')) {
                // Remove ## if present
                const headingText = trimmedSection.replace(/^##\s*/, '');

                paragraphs.push(
                    new Paragraph({
                        text: headingText,
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 400, after: 200 },
                    })
                );
            } else {
                const lines = trimmedSection.split('\n');
                lines.forEach((line) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return;

                    // Handle bullet points
                    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
                        paragraphs.push(
                            new Paragraph({
                                text: trimmedLine.substring(2),
                                bullet: { level: 0 },
                                spacing: { after: 100, left: 200 },
                            })
                        );
                    }
                    // Handle speaker labels (both French and English)
                    else if (trimmedLine.match(/^(Speaker|Locuteur|Single Speaker|Locuteur unique)\s*\d*\s*:/i)) {
                        const [speaker, ...textParts] = trimmedLine.split(':');
                        const text = textParts.join(':').trim();

                        paragraphs.push(
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: speaker + ': ',
                                        bold: true,
                                        color: '2B579A', // Blue color for speakers
                                    }),
                                    new TextRun({
                                        text: text,
                                    }),
                                ],
                                spacing: { after: 150 },
                            })
                        );
                    }
                    // Handle other lines with colons as potential labels
                    else if (trimmedLine.includes(':') && trimmedLine.indexOf(':') < 50) {
                        const [label, ...textParts] = trimmedLine.split(':');
                        const text = textParts.join(':').trim();

                        if (text) {
                            paragraphs.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: label + ': ',
                                            bold: true,
                                        }),
                                        new TextRun({
                                            text: text,
                                        }),
                                    ],
                                    spacing: { after: 100 },
                                })
                            );
                        } else {
                            // If no text after colon, treat as regular paragraph
                            paragraphs.push(
                                new Paragraph({
                                    text: trimmedLine,
                                    spacing: { after: 100 },
                                })
                            );
                        }
                    }
                    // Regular paragraphs
                    else {
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

        // Add footer
        paragraphs.push(
            new Paragraph({
                text: '─'.repeat(50),
                spacing: { before: 400, after: 200 },
                alignment: AlignmentType.CENTER,
            })
        );

        paragraphs.push(
            new Paragraph({
                text: `${isFrench ? 'Généré par' : 'Generated by'} TEXION Meeting Transcriber`,
                alignment: AlignmentType.CENTER,
                color: '666666',
                size: 20,
            })
        );

        const doc = new Document({
            sections: [
                {
                    properties: {
                        page: {
                            margin: {
                                top: 1440,    // 1 inch
                                right: 1440,
                                bottom: 1440,
                                left: 1440,
                            },
                        },
                    },
                    children: paragraphs,
                },
            ],
            creator: 'TEXION Meeting Transcriber',
            description: 'AI-generated meeting summary and transcript',
        });

        const buffer = await Packer.toBuffer(doc);
        clearTimeout(timeoutId);

        const outputFilename = `Meeting-Summary-${filename?.replace(/\.[^/.]+$/, '') || 'transcript'}-${new Date().toISOString().slice(0, 10)}.docx`;

        console.log(`✅ Document generated: ${outputFilename} (${(buffer.byteLength / 1024).toFixed(2)}KB)`);

        return new Response(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${outputFilename}"`,
                'Content-Length': buffer.byteLength.toString(),
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache',
            },
        });

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            console.error('⏱️ Document generation timeout');
            return new Response(JSON.stringify({
                success: false,
                error: 'Document generation timeout',
            }), {
                status: 524,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        console.error('❌ Document generation error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Document generation failed',
            details: env.ENVIRONMENT === 'development' ? error.stack : undefined
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