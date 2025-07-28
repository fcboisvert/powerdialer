import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';

// Utility function to chunk files
const chunkFile = (file, chunkSize = 5 * 1024 * 1024) => { // 5MB chunks
  const chunks = [];
  let start = 0;
  
  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    chunks.push(file.slice(start, end));
    start = end;
  }
  
  return chunks;
};

// Hook for chunked file upload
const useChunkedUpload = () => {
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  
  const uploadFile = async (file, uploadUrl) => {
    const fileId = Date.now().toString();
    const chunks = chunkFile(file);
    const totalChunks = chunks.length;
    
    setUploadStatus(prev => ({ ...prev, [fileId]: 'uploading' }));
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
    
    try {
      // Upload chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        const formData = new FormData();
        formData.append('chunk', chunks[i]);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
        formData.append('fileId', fileId);
        
        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`Chunk ${i + 1} upload failed`);
        }
        
        const progress = ((i + 1) / totalChunks) * 100;
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
      }
      
      setUploadStatus(prev => ({ ...prev, [fileId]: 'completed' }));
      return { success: true, fileId };
    } catch (error) {
      setUploadStatus(prev => ({ ...prev, [fileId]: 'error' }));
      return { success: false, error: error.message };
    }
  };
  
  return { uploadFile, uploadProgress, uploadStatus };
};

// Main component
export default function FileUploadWithChunking() {
  const [files, setFiles] = useState([]);
  const [uploadUrl, setUploadUrl] = useState('/api/upload-chunk');
  const fileInputRef = useRef(null);
  const { uploadFile, uploadProgress, uploadStatus } = useChunkedUpload();
  
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      status: 'pending'
    }))]);
  };
  
  const handleUpload = async (fileItem) => {
    const result = await uploadFile(fileItem.file, uploadUrl);
    
    setFiles(prev => prev.map(f => 
      f.id === fileItem.id 
        ? { ...f, status: result.success ? 'completed' : 'error', error: result.error }
        : f
    ));
  };
  
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">File Upload with Auto-Chunking</h2>
      
      {/* Upload URL Configuration */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Endpoint URL
        </label>
        <input
          type="text"
          value={uploadUrl}
          onChange={(e) => setUploadUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="/api/upload-chunk"
        />
        <p className="mt-1 text-sm text-gray-600">
          Configure this to point to your Cloudflare Worker or backend endpoint
        </p>
      </div>
      
      {/* File Input Area */}
      <div className="mb-6">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            Files will be automatically chunked into 5MB pieces
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
      
      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold mb-3">Files</h3>
          {files.map((fileItem) => {
            const fileId = fileItem.file.lastModified?.toString();
            const progress = uploadProgress[fileId] || 0;
            const status = uploadStatus[fileId] || fileItem.status;
            
            return (
              <div key={fileItem.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="font-medium">{fileItem.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(fileItem.size)}
                        {fileItem.file.size > 5 * 1024 * 1024 && (
                          <span className="ml-2 text-blue-600">
                            ({Math.ceil(fileItem.file.size / (5 * 1024 * 1024))} chunks)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {status === 'pending' && (
                      <button
                        onClick={() => handleUpload(fileItem)}
                        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Upload
                      </button>
                    )}
                    
                    {status === 'uploading' && (
                      <Loader className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                    
                    {status === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    
                    {status === 'error' && (
                      <div className="flex items-center space-x-1">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-500">{fileItem.error}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {status === 'uploading' && (
                  <div className="mt-2">
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{Math.round(progress)}% uploaded</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Implementation Guide */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3">Integration Steps:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Copy this component into your React app</li>
          <li>Create a Cloudflare Worker to handle chunk uploads at your endpoint</li>
          <li>The Worker should store chunks temporarily and reassemble when all chunks arrive</li>
          <li>Configure the upload URL to point to your Worker endpoint</li>
          <li>Customize chunk size and styling as needed</li>
        </ol>
        
        <div className="mt-4 p-4 bg-yellow-100 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> You'll need to implement the server-side logic in a Cloudflare Worker
            to receive and reassemble the chunks. The Worker can use R2 for storage or forward
            completed files to your preferred storage solution.
          </p>
        </div>
      </div>
    </div>
  );
}