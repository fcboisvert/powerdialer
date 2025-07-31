import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  AlertCircle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '/texion-logo.svg';

const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit = {}, timeout = 300000) => { // 5 min timeout
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
};

interface TranscriptionResult {
  success: boolean;
  analysis?: string;
  error?: string;
  filename?: string;
  jobId?: string; // For async processing
  processedBy?: 'sync' | 'async';
  model?: string;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

const SUPPORTED_FORMATS = [
  'audio/mpeg',     // MP3, MPEG
  'audio/mp3',      // MP3
  'audio/wav',      // WAV
  'audio/x-wav',    // WAV (alternative MIME type)
  'audio/mp4',      // MP4, M4A
  'audio/x-m4a',    // M4A (alternative MIME type)
  'audio/webm',     // WEBM
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const POLLING_INTERVAL = 2000; // 2 seconds

// Utility function to chunk files in browser
const chunkFile = (file: File, chunkSize: number = CHUNK_SIZE): Blob[] => {
  const chunks: Blob[] = [];
  let start = 0;

  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    chunks.push(file.slice(start, end, file.type));
    start = end;
  }

  return chunks;
};

export default function MeetingTranscriber() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [asyncJobId, setAsyncJobId] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);

  // Polling for async job status
  useEffect(() => {
    if (!asyncJobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetchWithTimeout(`/analyze-status?jobId=${asyncJobId}`, {
          method: 'GET',
        }, 30000);

        if (!response.ok) {
          throw new Error('Failed to check job status');
        }

        const jobData = await response.json();

        if (jobData.status === 'completed') {
          clearInterval(pollInterval);
          setAsyncJobId(null);
          setPollingCount(0);

          // Update UI with completed analysis
          updateStep('analyze', 'completed');
          setProgress('✅ Analyse terminée avec succès');

          // Continue with document generation
          await generateDocument(jobData.analysis, file!.name, jobData);
        } else if (jobData.status === 'failed') {
          clearInterval(pollInterval);
          setAsyncJobId(null);
          setPollingCount(0);
          throw new Error(jobData.error || 'Async analysis failed');
        } else {
          // Still processing
          setPollingCount(prev => prev + 1);
          setProgress(`🧠 Analyse en cours... (${Math.floor(pollingCount * POLLING_INTERVAL / 1000)}s)`);
        }
      } catch (error) {
        clearInterval(pollInterval);
        setAsyncJobId(null);
        setPollingCount(0);
        handleError(error);
      }
    }, POLLING_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [asyncJobId, pollingCount]);

  // Initialize processing steps
  const initializeSteps = () => {
    setProcessingSteps([
      { id: 'upload', label: 'Téléchargement du fichier', status: 'pending' },
      { id: 'transcribe', label: 'Transcription audio (Whisper)', status: 'pending' },
      { id: 'analyze', label: 'Analyse intelligente (GPT)', status: 'pending' },
      { id: 'generate', label: 'Génération du document Word', status: 'pending' },
    ]);
  };

  // Update processing step status
  const updateStep = (stepId: string, status: ProcessingStep['status'], progress?: number) => {
    setProcessingSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status, progress } : step
    ));
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `Fichier trop volumineux. Taille maximale: ${MAX_FILE_SIZE / 1024 / 1024}MB, votre fichier: ${Math.round(file.size / 1024 / 1024)}MB`;
    }

    // Check file format
    const isValidFormat = SUPPORTED_FORMATS.some(format =>
      file.type === format || file.name.toLowerCase().endsWith(format.split('/')[1])
    );

    // And update the error message in validateFile function:
    if (!isValidFormat) {
      return 'Format de fichier non supporté. Formats acceptés: MP3, WAV, M4A, MP4, MPEG, WEBM';
    }

    return null;
  };

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
      SUPPORTED_FORMATS.some(format =>
        file.type === format || file.name.toLowerCase().endsWith(format.split('/')[1])
      )
    );

    if (audioFile) {
      const validationError = validateFile(audioFile);
      if (validationError) {
        setResult({
          success: false,
          error: validationError,
        });
        return;
      }

      setFile(audioFile);
      setResult(null);
      setDownloadUrl(null);
      setRetryCount(0);
      setAsyncJobId(null);
    } else {
      setResult({
        success: false,
        error: 'Aucun fichier audio valide détecté dans les fichiers déposés.',
      });
    }
  }, []);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setResult({
          success: false,
          error: validationError,
        });
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setDownloadUrl(null);
      setRetryCount(0);
      setAsyncJobId(null);
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

  // Get file duration estimate
  const getEstimatedDuration = (fileSize: number): string => {
    // Rough estimate: 1MB ≈ 1 minute of audio
    const estimatedMinutes = Math.round(fileSize / (1024 * 1024));
    if (estimatedMinutes < 1) return '< 1 min';
    if (estimatedMinutes < 60) return `~${estimatedMinutes} min`;
    const hours = Math.floor(estimatedMinutes / 60);
    const mins = estimatedMinutes % 60;
    return `~${hours}h ${mins}min`;
  };

  // Generate document
  const generateDocument = async (analysis: string, filename: string, metadata?: any) => {
    updateStep('generate', 'processing');
    setProgress('📄 Génération du document Word...');

    const docResponse = await fetchWithTimeout('/generate-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: analysis,
        filename: filename,
        metadata: {
          model: metadata?.model,
          processedBy: metadata?.processedBy,
        }
      }),
    }, 60000); // 1 min timeout

    if (!docResponse.ok) {
      const errorData = await docResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur lors de la génération du document (${docResponse.status})`);
    }

    // Create download URL
    const blob = await docResponse.blob();
    const url = URL.createObjectURL(blob);
    const outputFilename = `Meeting-Summary-${filename.replace(/\.[^/.]+$/, '')}.docx`;

    updateStep('generate', 'completed');
    setDownloadUrl(url);
    setResult({
      success: true,
      analysis: analysis,
      filename: outputFilename,
      processedBy: metadata?.processedBy,
      model: metadata?.model,
    });
    setProgress('🎉 Traitement terminé avec succès !');
  };

  // Handle errors
  const handleError = (error: any) => {
    console.error('Processing error:', error);

    let userFriendlyError = error.message || 'Une erreur est survenue lors du traitement';

    // Specific handling for different error types
    if (error.name === 'AbortError') {
      userFriendlyError = 'Le traitement a pris trop de temps et a été interrompu. Veuillez réessayer avec un fichier plus court.';
    } else if (error.message?.includes('524')) {
      userFriendlyError = 'Le serveur a mis trop de temps à répondre. Votre fichier est peut-être trop long.';
    } else if (error.message?.includes('413')) {
      userFriendlyError = 'Le fichier est trop volumineux pour être traité.';
    }

    // Update failed step
    processingSteps.forEach(step => {
      if (step.status === 'processing') {
        updateStep(step.id, 'error');
      }
    });

    setResult({
      success: false,
      error: userFriendlyError,
    });
    setProgress('❌ Erreur lors du traitement');
    setProcessing(false);
    setUploadProgress(0);
  };

  // Process the audio file
  const processAudio = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress('🔄 Initialisation du traitement...');
    setUploadProgress(0);
    setAsyncJobId(null);
    setPollingCount(0);
    initializeSteps();

    try {
      // Step 1: Handle transcription
      updateStep('upload', 'processing');
      updateStep('transcribe', 'processing');

      let fullTranscription = '';

      if (file.size <= CHUNK_SIZE) {
        // Small file - direct upload
        setProgress('📤 Téléchargement et transcription en cours...');

        const formData = new FormData();
        formData.append('audio', file);

        const transcribeResponse = await fetchWithTimeout('/transcribe', {
          method: 'POST',
          body: formData,
        }, 180000); // 3 min timeout

        if (!transcribeResponse.ok) {
          const errorData = await transcribeResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Erreur lors de la transcription (${transcribeResponse.status})`);
        }

        const data = await transcribeResponse.json();

        if (!data.success) {
          throw new Error(data.error || 'Erreur lors de la transcription');
        }

        fullTranscription = data.transcription;

      } else {
        // Large file - split and transcribe chunks
        const chunks = chunkFile(file, CHUNK_SIZE);
        setProgress(`📦 Fichier volumineux détecté - Division en ${chunks.length} parties...`);

        const transcriptions: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
          setProgress(`🎙️ Transcription partie ${i + 1}/${chunks.length}...`);
          setUploadProgress((i / chunks.length) * 100);

          const formData = new FormData();
          // Create a new File object from the chunk
          const chunkFile = new File([chunks[i]], `${file.name}.part${i}`, { type: file.type });
          formData.append('audio', chunkFile);

          const response = await fetchWithTimeout('/transcribe', {
            method: 'POST',
            body: formData,
          }, 180000); // 3 min timeout per chunk

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Échec transcription partie ${i + 1}`);
          }

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || `Erreur transcription partie ${i + 1}`);
          }

          transcriptions.push(data.transcription);

          // Update progress
          setUploadProgress(((i + 1) / chunks.length) * 100);
        }

        // Combine all transcriptions
        fullTranscription = transcriptions.join('\n\n');
      }

      updateStep('upload', 'completed');
      updateStep('transcribe', 'completed');
      setProgress('✅ Transcription terminée avec succès');
      setUploadProgress(0);

      // Step 2: Analyze with GPT
      updateStep('analyze', 'processing');
      setProgress('🧠 Analyse intelligente en cours...');

      const analyzeResponse = await fetchWithTimeout('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription: fullTranscription,
        }),
      }, 300000); // 5 min timeout

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur lors de l'analyse (${analyzeResponse.status})`);
      }

      const analysisData = await analyzeResponse.json();

      // Check if it's async processing
      if (analysisData.jobId) {
        setAsyncJobId(analysisData.jobId);
        setProgress('🔄 Analyse complexe détectée - Traitement en arrière-plan...');
        updateStep('analyze', 'processing');
        // The useEffect will handle polling
        return;
      }

      if (!analysisData.success) {
        throw new Error(analysisData.error || 'Erreur lors de l\'analyse');
      }

      updateStep('analyze', 'completed');
      setProgress('✅ Analyse terminée avec succès');

      // Step 3: Generate Word document
      await generateDocument(analysisData.analysis, file.name, analysisData);

    } catch (error: any) {
      handleError(error);
    }
  };

  // Retry processing
  const MAX_FRONTEND_RETRIES = 2;

  const retryProcessing = () => {
    if (retryCount >= MAX_FRONTEND_RETRIES) {
      setResult({
        success: false,
        error: 'Nombre maximal de tentatives atteint. Veuillez réessayer plus tard ou utiliser un fichier plus petit.',
      });
      return;
    }

    setRetryCount(prev => prev + 1);
    setResult(null);
    setDownloadUrl(null);
    setAsyncJobId(null);
    processAudio();
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

      // Clean up blob URL after download
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 100);
    }
  };

  // Reset the component
  const reset = () => {
    setFile(null);
    setResult(null);
    setDownloadUrl(null);
    setProgress('');
    setProcessingSteps([]);
    setRetryCount(0);
    setUploadProgress(0);
    setAsyncJobId(null);
    setPollingCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
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
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive
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
                    <p className="text-slate-500 mb-2">
                      Formats supportés : MP3, WAV, M4A, MP4, MPEG, WEBM
                    </p>
                    <p className="text-sm text-slate-400 mb-4">
                      Taille maximale : 100MB • Division automatique pour les gros fichiers
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
              // Replace with:
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,.mpeg,.mpga,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm"
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
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>Durée estimée: {getEstimatedDuration(file.size)}</span>
                      {file.size > CHUNK_SIZE && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600">
                            {Math.ceil(file.size / CHUNK_SIZE)} parties
                          </span>
                        </>
                      )}
                    </div>
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

        {/* Processing Steps */}
        {processing && processingSteps.length > 0 && (
          <Card className="w-full mb-6">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Loader2 className="w-6 h-6 animate-spin text-[#E24218]" />
                  <div>
                    <h3 className="font-semibold text-slate-900">Traitement en cours...</h3>
                    <p className="text-slate-500">{progress}</p>
                  </div>
                </div>

                {/* Upload Progress Bar */}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mb-4">
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#E24218] h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{Math.round(uploadProgress)}% téléchargé</p>
                  </div>
                )}

                {/* Async Processing Notice */}
                {asyncJobId && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-800 font-medium">Traitement complexe en cours</p>
                      <p className="text-xs text-blue-600">
                        Votre fichier nécessite un traitement approfondi. Cela peut prendre quelques minutes.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {processingSteps.map((step, index) => (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step.status === 'completed' ? 'bg-green-100 text-green-700' :
                        step.status === 'processing' ? 'bg-orange-100 text-orange-700' :
                          step.status === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-500'
                        }`}>
                        {step.status === 'completed' ? '✓' :
                          step.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                            step.status === 'error' ? '✗' :
                              index + 1}
                      </div>
                      <span className={`flex-1 ${step.status === 'completed' ? 'text-green-700' :
                        step.status === 'processing' ? 'text-orange-700' :
                          step.status === 'error' ? 'text-red-700' :
                            'text-slate-500'
                        }`}>
                        {step.label}
                        {step.id === 'analyze' && asyncJobId && ' (Traitement en arrière-plan)'}
                      </span>
                    </div>
                  ))}
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
                <div className={`p-3 rounded-full ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  {result.success ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                    {result.success ? 'Transcription réussie !' : 'Erreur de transcription'}
                  </h3>
                  {result.success ? (
                    <div className="space-y-4">
                      <p className="text-slate-600">
                        Votre fichier audio a été transcrit et analysé avec succès.
                        Le document contient un résumé intelligent, les actions à retenir et la transcription complète.
                      </p>

                      {/* Processing info */}
                      {(result.processedBy || result.model) && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                          Traité avec: {result.model || 'AI'} • Mode: {result.processedBy === 'async' ? 'Traitement approfondi' : 'Traitement rapide'}
                        </div>
                      )}

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
                    <div className="space-y-4">
                      <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-red-800 font-medium">Détails de l'erreur:</p>
                          <p className="text-red-700 text-sm">{result.error}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={retryProcessing}
                          variant="outline"
                          className="gap-2"
                          disabled={processing}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Réessayer {retryCount > 0 && `(${retryCount + 1})`}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={reset}
                        >
                          Nouveau fichier
                        </Button>
                      </div>
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