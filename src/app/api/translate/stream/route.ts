import { NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { updateTranslationProgress } from './events/route';

const OLLAMA_API_URL = 'http://localhost:11434/api/generate';
const MODEL_NAME = 'thirdeyeai/DeepSeek-R1-Distill-Qwen-7B-uncensored';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const MAX_BLOCK_SIZE = 20;
const REQUEST_DELAY = 0;

async function translateBlock(block: string[]): Promise<string[]> {
  const text = block.join('\n\n');
  const prompt = `請將以下文本翻譯成繁體中文，保持原文的格式和標點符號。如果原文已經是中文，請直接返回原文。注意：只需要翻譯字幕文字，不要修改任何格式，不要包含任何思考過程或英文內容：

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
      const translatedText = response.data.response
        .replace('翻譯結果：', '')
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/[a-zA-Z]/g, '') // 移除所有英文字母
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