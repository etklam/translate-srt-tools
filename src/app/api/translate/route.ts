import { NextResponse } from 'next/server';
import axios from 'axios';
import pLimit from 'p-limit';

const DEEPLX_API_URL = 'https://deeplx.hhhk.7182818.xyz/translate';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒
const CONCURRENT_REQUESTS = 2; // 同時最多2個請求
const MAX_BLOCK_SIZE = 10; // 每個區塊最多包含10條字幕

// 創建限制器
const limit = pLimit(CONCURRENT_REQUESTS);

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
      { error: '翻譯過程中發生錯誤' },
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
          const translatedBlock = await limit(() => translateBlockWithRetry(currentBlock));
          translatedLines.push(...translatedBlock);
          translatedLines.push('');
          currentBlock = [];
          blockCount = 0;
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
    const translatedBlock = await limit(() => translateBlockWithRetry(currentBlock));
    translatedLines.push(...translatedBlock);
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
  
  try {
    const response = await axios.post(DEEPLX_API_URL, {
      text,
      source_lang: 'auto',
      target_lang: 'zh',
    });

    if (response.data && response.data.data) {
      return response.data.data.split('\n\n');
    }
    throw new Error('翻譯失敗');
  } catch (error) {
    console.error('DeepLX API Error:', error);
    throw error;
  }
} 