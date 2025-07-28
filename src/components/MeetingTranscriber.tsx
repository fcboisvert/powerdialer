import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Upload,
  FileAudio,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Mic,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '/texion-logo.svg';

interface TranscriptionResult {
  success: boolean;
  analysis?: string;
  error?: string;
  filename?: string;
}

export default function MeetingTranscriber() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const audioFile = droppedFiles.find(file => 
      file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')
    );

    if (audioFile) {
      setFile(audioFile);
      setResult(null);
      setDownloadUrl(null);
    }
  }, []);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setDownloadUrl(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Process the audio file
  const processAudio = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress('🔄 Préparation du fichier audio...');

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audio', file);

      // Step 1: Upload and transcribe
      setProgress('🎤 Transcription en cours avec Whisper...');
      
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeResponse.ok) {
        throw new Error('Erreur lors de la transcription');
      }

      const transcriptionData = await transcribeResponse.json();

      // Step 2: Analyze with GPT-4
      setProgress('🧠 Analyse avec GPT-4...');
      
      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription: transcriptionData.transcription,
        }),
      });

      if (!analyzeResponse.ok) {
        throw new Error('Erreur lors de l\'analyse');
      }

      const analysisData = await analyzeResponse.json();

      // Step 3: Generate Word document
      setProgress('📄 Génération du document Word...');
      
      const docResponse = await fetch('/api/generate-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: analysisData.analysis,
          filename: file.name,
        }),
      });

      if (!docResponse.ok) {
        throw new Error('Erreur lors de la génération du document');
      }

      // Create download URL
      const blob = await docResponse.blob();
      const url = URL.createObjectURL(blob);
      const filename = `Meeting-Summary-${file.name.replace(/\.[^/.]+$/, '')}.docx`;

      setDownloadUrl(url);
      setResult({
        success: true,
        analysis: analysisData.analysis,
        filename,
      });
      setProgress('✅ Traitement terminé avec succès !');

    } catch (error: any) {
      console.error('Processing error:', error);
      setResult({
        success: false,
        error: error.message || 'Une erreur est survenue',
      });
      setProgress('❌ Erreur lors du traitement');
    } finally {
      setProcessing(false);
    }
  };

  // Download the generated document
  const downloadDocument = () => {
    if (downloadUrl && result?.filename) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Reset the component
  const reset = () => {
    setFile(null);
    setResult(null);
    setDownloadUrl(null);
    setProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] via-[#fff] to-[#f3f4f6] py-12">
      <div className="rounded-2xl shadow-2xl bg-white/95 px-8 py-12 w-full max-w-4xl flex flex-col items-center">
        {/* Header */}
        <header className="flex flex-col items-center w-full mb-8">
          <img
            src={Logo}
            alt="texion"
            className="w-full h-[100px] mb-3"
            style={{ objectFit: 'contain' }}
          />
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            TRANSCRIPTEUR DE RÉUNIONS
          </h1>
          <p className="text-slate-500 text-center mb-4">
            Transformez vos enregistrements audio en comptes-rendus structurés
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/select')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </Button>
        </header>

        {/* File Upload Area */}
        {!file && (
          <Card className="w-full mb-6">
            <CardContent className="p-8">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive
                    ? 'border-[#E24218] bg-orange-50'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-slate-100 rounded-full">
                    <FileAudio className="w-8 h-8 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Glissez votre fichier audio ici
                    </h3>
                    <p className="text-slate-500 mb-4">
                      Formats supportés : MP3, WAV, M4A (max 25MB)
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-[#E24218] hover:bg-[#d03d15] text-white gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Sélectionner un fichier
                    </Button>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a"
                onChange={handleFileChange}
                className="hidden"
              />
            </CardContent>
          </Card>
        )}

        {/* File Selected */}
        {file && !processing && !result && (
          <Card className="w-full mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-full">
                    <FileAudio className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{file.name}</h3>
                    <p className="text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={processAudio}
                    className="bg-[#E24218] hover:bg-[#d03d15] text-white gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    Transcrire
                  </Button>
                  <Button
                    variant="outline"
                    onClick={reset}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing */}
        {processing && (
          <Card className="w-full mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-[#E24218]" />
                <div>
                  <h3 className="font-semibold text-slate-900">Traitement en cours...</h3>
                  <p className="text-slate-500">{progress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <Card className="w-full">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${
                  result.success ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {result.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${
                    result.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {result.success ? 'Transcription réussie !' : 'Erreur de transcription'}
                  </h3>
                  {result.success ? (
                    <div className="space-y-4">
                      <p className="text-slate-600">
                        Votre fichier audio a été transcrit et analysé avec succès.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={downloadDocument}
                          className="bg-[#E24218] hover:bg-[#d03d15] text-white gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Télécharger le rapport
                        </Button>
                        <Button
                          variant="outline"
                          onClick={reset}
                        >
                          Nouveau fichier
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-red-600 mb-4">{result.error}</p>
                      <Button
                        variant="outline"
                        onClick={reset}
                      >
                        Réessayer
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <footer className="mt-8 text-center text-slate-400 text-xs">
          © 2025 TEXION. Tous droits réservés.
        </footer>
      </div>
    </div>
  );
}