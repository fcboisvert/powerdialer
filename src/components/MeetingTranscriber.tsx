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
  Info,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '/texion-logo.svg';

const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit = {}, timeout = 300000) => {
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
  jobId?: string;
  processedBy?: 'sync' | 'async';
  model?: string;
  suggestion?: string;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
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

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Whisper API limit)
const SAFE_M4A_SIZE = 22 * 1024 * 1024; // 22MB (safer limit for M4A files)
const POLLING_INTERVAL = 2000; // 2 seconds

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
  const [asyncJobId, setAsyncJobId] = useState<string | null>(null);
  const [pollingCount, setPollingCount] = useState(0);
  const [showM4AWarning, setShowM4AWarning] = useState(false);
  const [isValidatingAudio, setIsValidatingAudio] = useState(false);

  // Polling for async job status
  useEffect(() => {
    if (!asyncJobId || !file) return;

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

          updateStep('analyze', 'completed');
          setProgress('✅ Analyse terminée avec succès');

          await generateDocument(jobData.analysis, file.name, jobData);
        } else if (jobData.status === 'failed') {
          clearInterval(pollInterval);
          setAsyncJobId(null);
          setPollingCount(0);
          throw new Error(jobData.error || 'Async analysis failed');
        } else {
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
  }, [asyncJobId, pollingCount, file]);

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
  const updateStep = (stepId: string, status: ProcessingStep['status']) => {
    setProcessingSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status } : step
    ));
  };

  // Validate audio file content
  const validateAudioFile = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    try {
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
          resolve({
            valid: false,
            error: 'Impossible de valider le fichier audio. Il pourrait être corrompu.'
          });
        }, 10000); // 10 second timeout

        audio.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);

          if (audio.duration === Infinity || isNaN(audio.duration) || audio.duration === 0) {
            resolve({
              valid: false,
              error: 'Impossible de déterminer la durée du fichier audio. Le fichier pourrait être corrompu.'
            });
            return;
          }

          if (audio.duration > 7200) { // 2 hours
            resolve({
              valid: false,
              error: `Fichier trop long (${Math.round(audio.duration / 60)} minutes). Maximum recommandé: 120 minutes.`
            });
            return;
          }

          console.log('Audio validation passed:', {
            duration: audio.duration,
            durationMinutes: Math.round(audio.duration / 60)
          });

          resolve({ valid: true });
        });

        audio.addEventListener('error', (e) => {
          clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          console.error('Audio validation error:', e);

          let errorMsg = 'Le fichier ne peut pas être lu comme audio. ';
          const ext = file.name.toLowerCase().split('.').pop();

          if (ext === 'm4a') {
            errorMsg += 'Si c\'est un fichier Apple Music ou iTunes, il pourrait être protégé par DRM. Essayez de convertir en MP3.';
          } else if (ext === 'webm') {
            errorMsg += 'Le codec audio dans ce WebM pourrait ne pas être supporté. Essayez de convertir en MP3.';
          } else {
            errorMsg += 'Veuillez vérifier que c\'est un vrai fichier audio ou essayez de le convertir en MP3.';
          }

          resolve({ valid: false, error: errorMsg });
        });

        audio.src = objectUrl;
      });
    } catch (error) {
      console.error('Audio validation exception:', error);
      return {
        valid: false,
        error: 'Erreur lors de la validation du fichier audio.'
      };
    }
  };

  // Validate file
  const validateFile = async (file: File): Promise<string | null> => {
    // Get file extension
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));

    // Check file size based on format
    const maxSize = fileExtension === '.m4a' ? SAFE_M4A_SIZE : MAX_FILE_SIZE;
    const maxSizeMB = maxSize / (1024 * 1024);

    if (file.size > maxSize) {
      return `Fichier trop volumineux. Taille maximale: ${maxSizeMB}MB${fileExtension === '.m4a' ? ' (limite réduite pour M4A)' : ''}, votre fichier: ${Math.round(file.size / 1024 / 1024)}MB. Compressez avec: ffmpeg -i input${fileExtension} -b:a 96k output.mp3`;
    }

    // Define supported extensions
    const supportedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.mpga', '.webm'];

    // Check MIME type
    const hasValidMimeType = SUPPORTED_FORMATS.some(format => file.type === format);

    // Check file extension
    const hasValidExtension = supportedExtensions.includes(fileExtension);

    // File is valid if either MIME type or extension matches
    const isValidFormat = hasValidMimeType || hasValidExtension;

    if (!isValidFormat) {
      console.log('File validation failed:', {
        fileName: file.name,
        mimeType: file.type,
        extension: fileExtension,
        hasValidMimeType,
        hasValidExtension
      });
      return 'Format de fichier non supporté. Formats acceptés: MP3, WAV, M4A, MP4, MPEG, WEBM';
    }

    // Validate the audio content
    setIsValidatingAudio(true);
    const audioValidation = await validateAudioFile(file);
    setIsValidatingAudio(false);

    if (!audioValidation.valid) {
      return audioValidation.error || 'Le fichier audio est invalide ou corrompu.';
    }

    // Show M4A warning if applicable
    if (fileExtension === '.m4a') {
      setShowM4AWarning(true);
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
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);

    const audioFile = droppedFiles.find(file => {
      const fileName = file.name.toLowerCase();
      const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
      const supportedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.mpeg', '.mpga', '.webm'];

      return SUPPORTED_FORMATS.some(format => file.type === format) ||
        supportedExtensions.includes(fileExtension);
    });

    if (audioFile) {
      setResult({
        success: false,
        error: 'Validation du fichier audio en cours...'
      });

      const validationError = await validateFile(audioFile);
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
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setResult({
        success: false,
        error: 'Validation du fichier audio en cours...'
      });

      const validationError = await validateFile(selectedFile);
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

    try {
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
      }, 60000);

      if (!docResponse.ok) {
        const errorData = await docResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur lors de la génération du document (${docResponse.status})`);
      }

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
      setProcessing(false);
    } catch (error) {
      updateStep('generate', 'error');
      throw error;
    }
  };

  // Handle errors
  const handleError = (error: any) => {
    console.error('Processing error:', error);

    let userFriendlyError = error.message || 'Une erreur est survenue lors du traitement';
    let suggestion = error.suggestion || '';

    // Specific error handling
    if (error.name === 'AbortError') {
      userFriendlyError = 'Le traitement a pris trop de temps et a été interrompu.';
      suggestion = 'Veuillez réessayer avec un fichier plus court ou le compresser.';
    } else if (error.message?.includes('524')) {
      userFriendlyError = 'Le serveur a mis trop de temps à répondre.';
      suggestion = 'Votre fichier est peut-être trop long. Essayez de le compresser: ffmpeg -i input.mp3 -b:a 96k output.mp3';
    } else if (error.message?.includes('413') || error.message?.includes('dépasse la limite')) {
      userFriendlyError = 'Le fichier est trop volumineux pour être traité.';
      suggestion = 'Compressez votre fichier avec: ffmpeg -i input.mp3 -b:a 96k output.mp3';
    } else if (error.message?.includes('Invalid audio file format') || error.message?.includes('Invalid file extension')) {
      userFriendlyError = 'Format audio invalide ou non supporté.';
      suggestion = 'Convertissez votre fichier en MP3 standard pour une meilleure compatibilité.';
    }

    processingSteps.forEach(step => {
      if (step.status === 'processing') {
        updateStep(step.id, 'error');
      }
    });

    setResult({
      success: false,
      error: userFriendlyError,
      suggestion: suggestion,
    });
    setProgress('❌ Erreur lors du traitement');
    setProcessing(false);
  };

  // Process the audio file
  const processAudio = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress('🔄 Initialisation du traitement...');
    setAsyncJobId(null);
    setPollingCount(0);
    setShowM4AWarning(false);
    initializeSteps();

    try {
      // Check if file is too large for Whisper (25MB limit)
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `Votre fichier (${(file.size / 1024 / 1024).toFixed(2)}MB) dépasse la limite de 25MB. ` +
          `Veuillez compresser votre fichier audio. ` +
          `Suggestion: Utilisez FFmpeg avec: ffmpeg -i input.mp3 -b:a 96k output.mp3`
        );
      }

      updateStep('upload', 'processing');
      updateStep('transcribe', 'processing');
      setProgress('📤 Téléchargement et transcription en cours...');

      // Send file directly without chunking
      const formData = new FormData();
      formData.append('audio', file);

      console.log('Sending file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        sizeInMB: (file.size / 1024 / 1024).toFixed(2)
      });

      const transcribeResponse = await fetchWithTimeout('/transcribe', {
        method: 'POST',
        body: formData,
      }, 180000); // 3 min timeout

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({}));
        console.error('Transcription error response:', errorData);

        if (errorData.suggestion) {
          throw {
            message: errorData.error || `Erreur lors de la transcription (${transcribeResponse.status})`,
            suggestion: errorData.suggestion
          };
        }

        throw new Error(errorData.error || `Erreur lors de la transcription (${transcribeResponse.status})`);
      }

      const data = await transcribeResponse.json();

      if (!data.success) {
        if (data.suggestion) {
          throw { message: data.error || 'Erreur lors de la transcription', suggestion: data.suggestion };
        }
        throw new Error(data.error || 'Erreur lors de la transcription');
      }

      updateStep('upload', 'completed');
      updateStep('transcribe', 'completed');
      setProgress('✅ Transcription terminée avec succès');

      // Analyze with GPT
      updateStep('analyze', 'processing');
      setProgress('🧠 Analyse intelligente en cours...');

      const analyzeResponse = await fetchWithTimeout('/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription: data.transcription,
        }),
      }, 300000); // 5 min timeout

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur lors de l'analyse (${analyzeResponse.status})`);
      }

      const analysisData = await analyzeResponse.json();

      if (analysisData.jobId) {
        setAsyncJobId(analysisData.jobId);
        setProgress('🔄 Analyse complexe détectée - Traitement en arrière-plan...');
        updateStep('analyze', 'processing');
        return;
      }

      if (!analysisData.success) {
        throw new Error(analysisData.error || 'Erreur lors de l\'analyse');
      }

      updateStep('analyze', 'completed');
      setProgress('✅ Analyse terminée avec succès');

      await generateDocument(analysisData.analysis, file.name, analysisData);

    } catch (error: any) {
      handleError(error);
    }
  };

  // Retry processing
  const retryProcessing = () => {
    if (retryCount >= 2) {
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
    setAsyncJobId(null);
    setPollingCount(0);
    setShowM4AWarning(false);
    setIsValidatingAudio(false);
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
                      Taille maximale : 25MB (22MB pour M4A)
                    </p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-[#E24218] hover:bg-[#d03d15] text-white gap-2"
                      disabled={isValidatingAudio}
                    >
                      {isValidatingAudio ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Validation...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Sélectionner un fichier
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.mp4,.mpeg,.mpga,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm"
                onChange={handleFileChange}
                className="hidden"
                disabled={isValidatingAudio}
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

              {/* M4A Warning */}
              {showM4AWarning && file.name.toLowerCase().endsWith('.m4a') && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-900">Fichier M4A détecté</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Les fichiers M4A peuvent avoir des problèmes de compatibilité. Si la transcription échoue,
                        convertissez en MP3:
                      </p>
                      <code className="block text-xs bg-yellow-100 px-2 py-1 rounded mt-1">
                        ffmpeg -i audio.m4a -b:a 128k audio.mp3
                      </code>
                    </div>
                  </div>
                </div>
              )}
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
                        <div className="flex-1">
                          <p className="text-red-800 font-medium">Détails de l'erreur:</p>
                          <p className="text-red-700 text-sm">{result.error}</p>
                          {result.suggestion && (
                            <div className="mt-2">
                              <p className="text-red-800 font-medium">Suggestion:</p>
                              <p className="text-red-700 text-sm">{result.suggestion}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Conversion help */}
                      {(result.error?.includes('M4A') || result.error?.includes('format') || result.error?.includes('volumineux')) && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                              <p className="font-medium text-blue-900 mb-1">Options de conversion:</p>
                              <ol className="text-blue-800 space-y-1 list-decimal list-inside">
                                <li>En ligne: <a href="https://cloudconvert.com/m4a-to-mp3" target="_blank" rel="noopener noreferrer" className="underline">CloudConvert</a></li>
                                <li>FFmpeg (MP3): <code className="bg-blue-100 px-1 rounded text-xs">ffmpeg -i audio.m4a -b:a 128k audio.mp3</code></li>
                                <li>Réduire la taille: <code className="bg-blue-100 px-1 rounded text-xs">ffmpeg -i audio.mp3 -b:a 96k output.mp3</code></li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={retryProcessing}
                          variant="outline"
                          className="gap-2"
                          disabled={processing}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Réessayer {retryCount > 0 && `(${retryCount + 1}/3)`}
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
