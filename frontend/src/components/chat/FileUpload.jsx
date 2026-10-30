import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileSpreadsheet, X, Loader2, Database, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { cn } from '../../utils/cn';

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function FileUpload({ chatId, onComplete }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef(null);

  const processFiles = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    const validFiles = fileArray.filter(
      file => file.name.endsWith('.csv') || file.name.endsWith('.xlsx')
    );
    
    if (validFiles.length !== fileArray.length) {
      toast.error('Only .csv and .xlsx files are supported');
    }

    setFiles(prev => {
      const newFiles = validFiles.filter(vf => !prev.some(pf => pf.name === vf.name));
      return [...prev, ...newFiles];
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) processFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length > 0) processFiles(e.target.files);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (nameToRemove) => {
    setFiles(files.filter(f => f.name !== nameToRemove));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('chat_id', chatId);

    try {
      // FIX: Added /api to the upload endpoint to match main.py routing
      await api.post('/api/upload_documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Datasets processed successfully!');
      onComplete(); 
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 w-full max-w-3xl mx-auto overflow-y-auto">
      
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-200 shadow-sm">
          <Database className="text-zinc-700" size={24} />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Ingest Datasets</h2>
        <p className="text-zinc-500 text-sm">Upload your CSV or Excel files. We will map them for natural language querying.</p>
      </div>

      {/* NEW PRO TIP BANNER */}
      <div className="mb-6 w-full p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-start gap-3 text-left shadow-sm">
        <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700 leading-relaxed">
          <span className="font-semibold text-blue-800">Pro Tip:</span> For the best AI analysis, please give your files clear, descriptive names before uploading. For example, if your file contains sales data, name it <code className="bg-blue-100/50 px-1.5 py-0.5 rounded text-xs text-blue-900 font-mono font-medium">sales.csv</code> rather than <code className="bg-blue-100/50 px-1.5 py-0.5 rounded text-xs text-blue-900 font-mono font-medium">Book1.csv</code>.
        </p>
      </div>

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "w-full border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
          isDragging 
            ? "border-zinc-900 bg-zinc-50 scale-[1.02]" 
            : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50"
        )}
      >
        <UploadCloud size={40} className={cn("mb-4 transition-colors", isDragging ? "text-zinc-900" : "text-zinc-400")} />
        <p className="text-sm font-medium text-zinc-900">
          Click to browse or drag and drop files here
        </p>
        <p className="text-xs text-zinc-500 mt-2">Supports multiple .csv and .xlsx files</p>
        <input type="file" multiple accept=".csv,.xlsx" className="hidden" ref={fileRef} onChange={handleFileSelect} />
      </div>

      <div className="w-full mt-6 space-y-3">
        <AnimatePresence>
          {files.map((file) => (
            <motion.div 
              key={file.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-xl shadow-sm"
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="p-2 bg-green-50 rounded-lg shrink-0">
                  <FileSpreadsheet size={20} className="text-green-600" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-900 truncate">{file.name}</span>
                  <span className="text-xs text-zinc-500">{formatSize(file.size)}</span>
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                disabled={isUploading}
                className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <motion.div layout className="w-full mt-8">
        <button 
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading}
          className="w-full py-3.5 bg-zinc-900 text-white font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center transition-all shadow-sm"
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} /> 
              Processing {files.length} {files.length === 1 ? 'file' : 'files'}...
            </>
          ) : (
            `Upload & Process ${files.length > 0 ? `(${files.length})` : ''}`
          )}
        </button>
      </motion.div>
    </div>
  );
}