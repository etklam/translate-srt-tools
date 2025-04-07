'use client';

import { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = (acceptedFiles: File[]) => {
    setIsDragging(false);
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (selectedFile.name.endsWith('.srt')) {
        setFile(selectedFile);
        toast.success('檔案已成功上傳');
      } else {
        toast.error('請上傳 .srt 格式的檔案');
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.srt']
    },
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false)
  });

  const handleTranslate = async () => {
    if (!file) {
      toast.error('請先上傳檔案');
      return;
    }

    setIsTranslating(true);
    setTranslatedText('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('翻譯失敗');
      }

      const data = await response.json();
      setTranslatedText(data.translatedText);
      toast.success('翻譯完成！');
    } catch (error) {
      console.error('Error:', error);
      toast.error('翻譯過程中發生錯誤，請稍後再試');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownload = () => {
    if (!translatedText) {
      toast.error('沒有可下載的內容');
      return;
    }

    const blob = new Blob([translatedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file ? `translated_${file.name}` : 'translated.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          SRT 字幕翻譯工具
        </h1>
        
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
          >
            <input {...getInputProps()} ref={fileInputRef} />
            <div className="space-y-4">
              <div className="text-6xl mb-4">📄</div>
              {isDragActive ? (
                <p className="text-lg text-blue-600">放開以上傳檔案</p>
              ) : (
                <div>
                  <p className="text-lg text-gray-600">
                    拖放 .srt 檔案到這裡，或點擊選擇檔案
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    支援 .srt 格式的字幕檔案
                  </p>
                </div>
              )}
            </div>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700">
                已選擇檔案：<span className="font-medium">{file.name}</span>
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-center space-x-4">
            <button
              onClick={handleTranslate}
              disabled={!file || isTranslating}
              className={`px-6 py-3 rounded-lg font-medium text-white transition-all duration-200
                ${!file || isTranslating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              {isTranslating ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  翻譯中...
                </span>
              ) : (
                '開始翻譯'
              )}
            </button>
            
            {translatedText && (
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all duration-200"
              >
                下載翻譯結果
              </button>
            )}
          </div>
        </div>

        {translatedText && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">翻譯結果</h2>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-all duration-200"
              >
                下載
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-gray-700 font-mono text-sm">
                {translatedText}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
