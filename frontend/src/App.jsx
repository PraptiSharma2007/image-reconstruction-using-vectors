import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Cpu,
  Sliders,
  Terminal as TerminalIcon,
  Layers,
  Download,
  Zap,
  RefreshCw,
  Eye
} from 'lucide-react';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mode, setMode] = useState('compress');
  const [variance, setVariance] = useState(50);
  const [upscaleMultiplier, setUpscaleMultiplier] = useState(1.5);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([
    'VectorVision Kernel initialized.',
    'Waiting for image...'
  ]);

  const fileInputRef = useRef(null);

  const addLog = (msg) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setProcessedImage(null);
      setMetrics(null);
      addLog(`Image loaded: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
    }
  };

  const handleExecute = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    addLog(`Starting ${mode} operation...`);

    const formData = new FormData();
    formData.append('file', selectedFile);

    let endpoint = 'http://localhost:8000/api/compress';

    if (mode === 'compress') {
      formData.append('percentage', variance);
      formData.append('target_kb', 0); // Always 0 since target size UI is removed
    } else {
      endpoint = 'http://localhost:8000/api/upscale';
      formData.append('scale', upscaleMultiplier);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);

      const data = await response.json();

      addLog(`DEBUG: Backend sent -> ${Object.keys(data).join(', ')}`);

      if (data.math_logs && Array.isArray(data.math_logs)) {
        data.math_logs.forEach(log => addLog(log));
      } else if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach(log => addLog(log));
      }

      // Convert Base64 to Blob URL to fix 'about:blank' drag/drop issue
      const base64Data = data.processed_image_base64 || data.image_base64 || data.image || data.result_image || data.base64;
      if (base64Data) {
        const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const byteCharacters = atob(rawBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        const blobUrl = URL.createObjectURL(blob);
        setProcessedImage(blobUrl);
      } else {
        addLog("ERR: Could not find image string in backend response.");
      }

      // ---------------------------------------------------------
      // FIX: Dynamically handle metrics based on operation mode
      // ---------------------------------------------------------
      let finalRank = 'N/A';
      let finalVariance = `${variance}%`;
      let finalSize = 'Calculated';

      if (mode === 'compress') {
        const allLogs = data.math_logs || data.logs || [];
        allLogs.forEach(log => {
          if (log.includes('k=')) {
            const match = log.match(/k=(\d+)/);
            if (match) finalRank = match[1];
          }
          if (log.includes('Retained:')) {
            const match = log.match(/Retained:\s*([\d.]+)%/);
            if (match) finalVariance = match[1] + '%';
          }
          if (log.includes('reduction:')) {
            const match = log.match(/reduction:\s*([\d.]+):1/);
            if (match) finalSize = match[1] + 'x Smaller';
          }
        });
      } else {
        // Upscale mode metrics
        finalSize = `${upscaleMultiplier}x Scale`;
        finalRank = 'Bilinear';
        finalVariance = 'Interpolated';
      }

      setMetrics({
        originalSize: (selectedFile.size / 1024).toFixed(1) + ' KB',
        processedSize: finalSize,
        rankRetained: finalRank,
        variancePreserved: finalVariance
      });
      // ---------------------------------------------------------

      addLog(`Process completed successfully.`);
    } catch (err) {
      addLog(`ERR: Pipeline failed - ${err.message}.`);
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-cyan-500 selection:text-black">
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
              <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                Vector<span className="text-cyan-400">Vision</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Linear Algebra Studio
                </span>
              </h1>
              <p className="text-xs text-zinc-400 font-mono">Image Compression & Upscaling</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono text-zinc-400">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Engine Ready
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold tracking-wide flex items-center gap-2 text-zinc-200">
                  <UploadCloud className="w-4 h-4 text-cyan-400" /> 1. Upload Image
                </span>
                {selectedFile && (
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                  previewUrl
                    ? 'border-zinc-700 bg-zinc-950/40 hover:border-cyan-500/50'
                    : 'border-zinc-800 bg-zinc-900/20 hover:border-cyan-500/50 hover:bg-zinc-900/40'
                }`}
              >
                {previewUrl ? (
                  <div className="relative group w-full">
                    <img
                      src={previewUrl}
                      alt="Source input"
                      className="max-h-48 mx-auto rounded-lg object-contain shadow-md"
                    />
                    <div className="mt-3 text-xs text-zinc-400 font-mono group-hover:text-cyan-400">
                      Click to swap image
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-6">
                    <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                      <UploadCloud className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Select or drop an image file</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-5">
              <span className="text-sm font-semibold tracking-wide flex items-center gap-2 text-zinc-200">
                <Sliders className="w-4 h-4 text-cyan-400" /> 2. Choose Operation
              </span>

              <div className="grid grid-cols-2 p-1 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMode('compress')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                    mode === 'compress'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Compress Image
                </button>
                <button
                  type="button"
                  onClick={() => setMode('upscale')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                    mode === 'upscale'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" /> Upscale Image
                </button>
              </div>

              {mode === 'compress' ? (
                <div className="space-y-4 pt-1">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-2">
                      <span className="text-zinc-400">Image Quality / Retained Variance:</span>
                      <span className="text-cyan-400 font-bold">{variance}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={variance}
                      onChange={(e) => setVariance(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer bg-zinc-800 rounded-lg h-2"
                    />
                    <p className="text-[11px] text-zinc-500 font-mono mt-2">
                        Lower percentages discard structural matrix data (lower rank k), reducing visual clarity.
                        Note: Reconstructed physical file sizes may exceed the original optimized JPEG.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-zinc-400">Upscale Multiplier:</span>
                    <span className="text-cyan-400 font-bold">{upscaleMultiplier}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.1"
                    max="4.0"
                    step="0.1"
                    value={upscaleMultiplier}
                    onChange={(e) => setUpscaleMultiplier(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer bg-zinc-800 rounded-lg h-2"
                  />
                  <p className="text-[11px] text-zinc-500 font-mono mt-2">
                    Increases image resolution by estimating new pixels.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={!selectedFile || isProcessing}
                onClick={handleExecute}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-black" />
                    <span>Execute Transformation</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold tracking-wide flex items-center gap-2 text-zinc-200">
                  <Eye className="w-4 h-4 text-cyan-400" /> Output Result
                </span>
                {processedImage && (
                  <a
                    href={processedImage}
                    download={`vectorvision_${mode}_result.jpg`}
                    className="text-xs font-mono flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Image
                  </a>
                )}
              </div>

              <div className="min-h-[280px] bg-zinc-950/60 border border-zinc-800/80 rounded-xl flex items-center justify-center p-4 overflow-hidden">
                {processedImage ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div className="space-y-2 text-center">
                      <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Original Image</span>
                      <img src={previewUrl} alt="Original" className="max-h-56 mx-auto rounded-lg object-contain border border-zinc-800" />
                    </div>
                    <div className="space-y-2 text-center">
                      <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">Processed Image</span>
                      <img src={processedImage} alt="Processed" className="max-h-56 mx-auto rounded-lg object-contain border border-cyan-500/40 shadow-lg shadow-cyan-950 cursor-grab active:cursor-grabbing" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2 py-12">
                    <div className="w-10 h-10 mx-auto rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                      <Layers className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-mono text-zinc-500">Waiting for process execution...</p>
                  </div>
                )}
              </div>

              {metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-800/60 font-mono">
                  <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase">Original Size</p>
                    <p className="text-xs font-bold text-zinc-200 mt-0.5">{metrics.originalSize}</p>
                  </div>
                  <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase">Processed Size</p>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5">{metrics.processedSize}</p>
                  </div>
                  <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase">Retained Rank</p>
                    <p className="text-xs font-bold text-cyan-400 mt-0.5">{metrics.rankRetained}</p>
                  </div>
                  <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase">Variance Kept</p>
                    <p className="text-xs font-bold text-purple-400 mt-0.5">{metrics.variancePreserved}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 mb-3">
                <span className="text-xs font-mono font-semibold tracking-wide flex items-center gap-2 text-zinc-300">
                  <TerminalIcon className="w-4 h-4 text-emerald-400" /> System Console
                </span>
                <div className="flex space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                </div>
              </div>

              <div className="h-44 overflow-y-auto font-mono text-xs space-y-1.5 bg-zinc-950 p-3.5 rounded-xl border border-zinc-900/90 shadow-inner">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-zinc-600 select-none">&gt;</span>
                    <span className={
                      log.includes('ERR')
                        ? 'text-red-400 font-semibold'
                        : log.includes('successfully') || log.includes('Ready')
                        ? 'text-emerald-400'
                        : log.includes('DEBUG')
                        ? 'text-yellow-400'
                        : log.includes('Decomposing') || log.includes('SVD') || log.includes('Starting')
                        ? 'text-cyan-300'
                        : 'text-zinc-400'
                    }>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
