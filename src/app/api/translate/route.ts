import { NextResponse } from 'next/server';
import axios from 'axios';

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'thirdeyeai/DeepSeek-R1-Distill-Qwen-7B-uncensored'; // 或其他您安裝的模型
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_BLOCK_SIZE = 1;
const REQUEST_DELAY = 0;

// 日誌函數
function logTranslation(original: string, translated: string) {
  console.log('=== 翻譯內容 ===');
  console.log('原始文本:');
  console.log(original);
  console.log('翻譯結果:');
  console.log(translated);
  console.log('===============');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: '未提供檔案' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const translatedText = await translateSrt(text);

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: '翻譯過程中發生錯誤，請稍後再試' },
      { status: 500 }
    );
  }
}

async function translateSrt(text: string): Promise<string> {
  // 解析 SRT 檔案
  const lines = text.split('\n');
  let translatedLines: string[] = [];
  let currentBlock: string[] = [];
  let currentSubtitle: string[] = [];
  let blockCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '') {
      // 完成一個字幕
      if (currentSubtitle.length > 0) {
        currentBlock.push(currentSubtitle.join('\n'));
        currentSubtitle = [];
        blockCount++;
      }

      // 當區塊達到最大大小或是最後一個字幕時，進行翻譯
      if (blockCount >= MAX_BLOCK_SIZE || i === lines.length - 1) {
        if (currentBlock.length > 0) {
          try {
            const translatedBlock = await translateBlockWithRetry(currentBlock);
            translatedLines.push(...translatedBlock);
            translatedLines.push('');
            
            // 記錄翻譯內容
            logTranslation(currentBlock.join('\n\n'), translatedBlock.join('\n\n'));
          } catch (error) {
            console.error('區塊翻譯失敗，跳過此區塊:', error);
            // 如果翻譯失敗，保留原始文字
            translatedLines.push(...currentBlock);
            translatedLines.push('');
          }
          currentBlock = [];
          blockCount = 0;
          
          // 在每個請求之間添加延遲
          await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
        }
      }
    } else if (!/^\d+$/.test(line) && !line.includes('-->')) {
      // 只收集字幕文字，跳過序號和時間碼
      currentSubtitle.push(line);
    } else {
      // 序號和時間碼直接加入結果
      translatedLines.push(line);
    }
  }

  // 處理最後一個區塊
  if (currentBlock.length > 0) {
    try {
      const translatedBlock = await translateBlockWithRetry(currentBlock);
      translatedLines.push(...translatedBlock);
      
      // 記錄翻譯內容
      logTranslation(currentBlock.join('\n\n'), translatedBlock.join('\n\n'));
    } catch (error) {
      console.error('最後區塊翻譯失敗，跳過此區塊:', error);
      translatedLines.push(...currentBlock);
    }
  }

  return translatedLines.join('\n');
}

async function translateBlockWithRetry(block: string[]): Promise<string[]> {
  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await translateBlock(block);
    } catch (error) {
      lastError = error;
      console.log(`翻譯嘗試 ${attempt}/${MAX_RETRIES} 失敗，等待 ${RETRY_DELAY}ms 後重試`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  throw lastError;
}

async function translateBlock(block: string[]): Promise<string[]> {
  const text = block.join('\n\n');
  const prompt = `請將以下文本翻譯成繁體中文，保持原文的格式和標點符號。如果原文已經是中文，請直接返回原文：
  
${text}

翻譯結果：`;

  try {
    const response = await axios.post(OLLAMA_API_URL, {
      model: MODEL_NAME,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
      }
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.data && response.data.response) {
      // 清理回應，移除提示詞
      const translatedText = response.data.response
        .replace('翻譯結果：', '')
        .trim();
      
      return translatedText.split('\n\n');
    }
    throw new Error('翻譯失敗：無效的響應格式');
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Ollama API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    } else {
      console.error('Ollama API Error:', error);
    }
    throw error;
  }
} 