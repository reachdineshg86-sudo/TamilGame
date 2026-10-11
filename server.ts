import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize GoogleGenAI client lazily
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Convert numbers into pure Tamil words for authentic speech
export function tamilNumberToWords(num: number): string {
  const ones = ["", "ஒன்று", "இரண்டு", "மூன்று", "நான்கு", "ஐந்து", "ஆறு", "ஏழு", "எட்டு", "ஒன்பது"];
  const teens = ["பத்து", "பதினொன்று", "பன்னிரண்டு", "பதின்மூன்று", "பதினான்கு", "பதினைந்து", "பதினாறு", "பதினேழு", "பதினெட்டு", "பத்தொன்பது"];
  const tens = ["", "பத்து", "இருபது", "முப்பது", "நாற்பது", "ஐம்பது", "அறுபது", "எழுபது", "எண்பது", "தொண்ணூறு"];
  const tensComp = ["", "பத்து", "இருபத்து ", "முப்பத்து ", "நாற்பத்து ", "ஐம்பத்து ", "அறுபத்து ", "எழுபத்து ", "எண்பத்து ", "தொண்ணூற்று "];
  const hundreds = ["", "நூறு", "இருநூறு", "முந்நூறு", "நாநூறு", "ஐந்நூறு", "அறுநூறு", "எழுநூறு", "எண்ணூறு", "தொள்ளாயிரம்"];
  const hundredsComp = ["", "நூற்று ", "இருநூற்று ", "முந்நூற்று ", "நாநூற்று ", "ஐந்நூற்று ", "அறுநூற்று ", "எழுநூற்று ", "எண்ணூற்று ", "தொள்ளாயிரத்து "];

  if (num === 0) return "பூஜ்ஜியம்";
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const rem = num % 10;
    const t = Math.floor(num / 10);
    return rem === 0 ? tens[t] : tensComp[t] + ones[rem];
  }
  if (num < 1000) {
    const rem = num % 100;
    const h = Math.floor(num / 100);
    return rem === 0 ? hundreds[h] : hundredsComp[h] + tamilNumberToWords(rem);
  }
  if (num === 1000) return "ஆயிரம்";
  if (num < 2000) {
    const rem = num % 1000;
    return rem === 0 ? "ஆயிரம்" : "ஆயிரத்து " + tamilNumberToWords(rem);
  }
  return String(num);
}

export function replaceDigitsWithTamilWords(text: string): string {
  return text.replace(/\b\d+\b/g, (match) => {
    const n = parseInt(match, 10);
    if (!isNaN(n) && n <= 2000) {
      return tamilNumberToWords(n);
    }
    return match;
  });
}

// Convert raw 16-bit PCM buffer to standard WAV
function pcmToWav(pcmData: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const headerSize = 44;
  const wavBuffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write('WAVE', 8);

  // "fmt " chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16); // PCM chunk size
  wavBuffer.writeUInt16LE(1, 20); // Linear PCM
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  // "data" chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);

  // Copy raw audio samples
  pcmData.copy(wavBuffer, 44);

  return wavBuffer;
}

// Cache synthesized Tamil audio buffers in memory
const ttsCache = new Map<string, string>();

// Clean and normalize Tamil text for authentic, flawless pronunciation
function normalizeTamilPronunciation(text: string): string {
  const normalized = text
    // Replace slash / or \ with natural Tamil 'அல்லது' (or) so speech never says English "slash"
    .replace(/\s*[\/\\]\s*/g, ' அல்லது ')
    // Replace & with Tamil 'மற்றும்' (and)
    .replace(/\s*&\s*/g, ' மற்றும் ')
    // Replace Avvai / Avvaiyar with phonetic spelling for clean pronunciation (prevents 'ulavaiyaar' mispronunciation)
    .replace(/ஒளவையார்|ஔவையார்/g, 'அவ்வையார்')
    .replace(/ஒளவை|ஔவை/g, 'அவ்வை')
    .replace(/ஒளடதம்|ஔடதம்/g, 'அவுடதம்')
    // Normalize decomposed Unicode characters (ஒ + ள -> ஔ)
    .replace(/\u0B92\u0BB3/g, 'ஔ');

  // Convert English digits to pure Tamil words
  return replaceDigitsWithTamilWords(normalized);
}

// Helper to fetch high-fidelity authentic Tamil audio for a text segment
async function fetchAuthenticTamilAudio(text: string): Promise<Buffer> {
  const cleanText = normalizeTamilPronunciation(text.trim());
  if (!cleanText) return Buffer.alloc(0);

  // Split into manageable chunks (under 180 chars) if needed
  const chunks: string[] = [];
  if (cleanText.length <= 180) {
    chunks.push(cleanText);
  } else {
    // Split by punctuation or spaces
    const parts = cleanText.split(/([.,?!;:|()]+|\s+)/);
    let current = '';
    for (const part of parts) {
      if ((current + part).length > 180) {
        if (current.trim()) chunks.push(current.trim());
        current = part;
      } else {
        current += part;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  const audioBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      chunk
    )}&tl=ta&client=tw-ob`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`Tamil voice synthesis failed with status ${response.status}`);
    }

    const arrayBuf = await response.arrayBuffer();
    audioBuffers.push(Buffer.from(arrayBuf));
  }

  return Buffer.concat(audioBuffers);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// TTS API endpoint - Authentic Tamil Voice Synthesis
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'ta-IN' } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text prompt is required' });
      return;
    }

    const cleanText = text.trim();
    const cacheKey = `ta:${voice}:${cleanText}`;

    // Return cached audio if available
    if (ttsCache.has(cacheKey)) {
      res.json({
        audioUrl: ttsCache.get(cacheKey),
        format: 'audio/mp3',
        cached: true,
      });
      return;
    }

    // Generate authentic native Tamil audio
    const audioBuffer = await fetchAuthenticTamilAudio(cleanText);
    const audioDataUrl = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;

    // Save in cache (cap cache at 500 items)
    if (ttsCache.size > 500) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, audioDataUrl);

    res.json({
      audioUrl: audioDataUrl,
      format: 'audio/mp3',
      cached: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown TTS error';
    console.error('Error generating authentic Tamil speech:', message);
    res.status(500).json({
      error: message,
      fallback: true,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tamil Quiz Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
