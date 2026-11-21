import type { Express, Request, Response } from 'express';
import { GoogleGenAI, type Content, type Part } from '@google/genai';

function stripDataUrlPrefix(raw: string): { base64: string; detectedMime?: string } {
  const match = raw.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return { detectedMime: match[1], base64: match[2] };
  }
  return { base64: raw.trim() };
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

const ALLOWED_CHAT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-4-argon',
  'gemini-4-carbon',
  'gemini-3.1-flash-lite',
]);

export function registerGeminiRoutes(app: Express) {
  // 1. Multi-turn Gemini Chatbot + Google Search Grounding + Google Maps Grounding
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    }

    try {
      const {
        message,
        history = [],
        mode = 'chat',
        model = 'gemini-4-hydrogen',
        systemInstruction,
        latLng,
      } = (req.body || {}) as {
        message?: string;
        history?: Array<{ role: 'user' | 'model'; text: string }>;
        mode?: 'chat' | 'search' | 'maps';
        model?: string;
        systemInstruction?: string;
        latLng?: { latitude?: number; longitude?: number };
      };

      const trimmedMessage = String(message || '').trim();
      if (!trimmedMessage) {
        return res.status(400).json({ error: 'Message is required.' });
      }

      const selectedModel = ALLOWED_CHAT_MODELS.has(model) ? model : 'gemini-4-hydrogen';
      // Search & Maps grounding run on gemini-4-hydrogen
      const effectiveModel = mode === 'maps' || mode === 'search' ? 'gemini-4-hydrogen' : selectedModel;

      const contents: Content[] = [];
      if (Array.isArray(history)) {
        for (const turn of history.slice(-16)) {
          const text = String(turn?.text || '').trim();
          if (!text) continue;
          contents.push({
            role: turn.role === 'model' ? 'model' : 'user',
            parts: [{ text }],
          });
        }
      }
      contents.push({
        role: 'user',
        parts: [{ text: trimmedMessage }],
      });

      const defaultSystem =
        'You are the Soundmark Studio Assistant — concise, knowledgeable in global music, hi-fi audio engineering, live sports fixtures, and concert venues.';

      const config: {
        systemInstruction: string;
        tools?: Array<{ googleSearch: Record<string, never> } | { googleMaps: Record<string, never> }>;
        toolConfig?: {
          retrievalConfig?: {
            latLng?: { latitude: number; longitude: number };
          };
        };
      } = {
        systemInstruction:
          typeof systemInstruction === 'string' && systemInstruction.trim()
            ? systemInstruction.trim().slice(0, 2000)
            : defaultSystem,
      };

      if (mode === 'search') {
        config.tools = [{ googleSearch: {} }];
      } else if (mode === 'maps') {
        // Note: googleMaps must never be combined with googleSearch or structured JSON output
        config.tools = [{ googleMaps: {} }];
        if (
          latLng &&
          typeof latLng.latitude === 'number' &&
          typeof latLng.longitude === 'number' &&
          Number.isFinite(latLng.latitude) &&
          Number.isFinite(latLng.longitude)
        ) {
          config.toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: latLng.latitude,
                longitude: latLng.longitude,
              },
            },
          };
        }
      }

      const response = await ai.models.generateContent({
        model: effectiveModel,
        contents,
        config,
      });

      const candidate = response.candidates?.[0];
      const groundingMeta = candidate?.groundingMetadata as
        | {
            webSearchQueries?: string[];
            groundingChunks?: Array<{
              web?: { uri?: string; title?: string };
              maps?: {
                uri?: string;
                title?: string;
                placeId?: string;
                placeAnswerSources?: {
                  reviewSnippets?: Array<{
                    text?: string;
                    snippet?: string;
                    authorAttribution?: { displayName?: string };
                  }>;
                };
              };
            }>;
          }
        | undefined;

      const searchSources: Array<{ title: string; uri: string }> = [];
      const mapPlaces: Array<{
        title: string;
        uri: string;
        placeId?: string;
        reviewSnippets: string[];
      }> = [];

      if (Array.isArray(groundingMeta?.groundingChunks)) {
        for (const chunk of groundingMeta.groundingChunks) {
          if (chunk.web?.uri) {
            searchSources.push({
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri,
            });
          }
          if (chunk.maps?.uri) {
            const snippets =
              chunk.maps.placeAnswerSources?.reviewSnippets
                ?.map((s) => s.text || s.snippet || '')
                .filter(Boolean) || [];
            mapPlaces.push({
              title: chunk.maps.title || 'View on Google Maps',
              uri: chunk.maps.uri,
              placeId: chunk.maps.placeId,
              reviewSnippets: snippets,
            });
          }
        }
      }

      return res.json({
        text: response.text || '',
        model: effectiveModel,
        mode,
        searchSources,
        mapPlaces,
      });
    } catch (error) {
      console.error('Gemini chat error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Assistant generation failed.',
      });
    }
  });

  // 2. Music Generation via Lyria 3 (Clip 30s or Pro Full Track)
  app.post('/api/ai/music', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    }

    try {
      const {
        prompt,
        model = 'lyria-3-clip-preview',
        referenceImageBase64,
        referenceMimeType,
      } = (req.body || {}) as {
        prompt?: string;
        model?: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
        referenceImageBase64?: string;
        referenceMimeType?: string;
      };

      const trimmedPrompt = String(prompt || '').trim();
      if (!trimmedPrompt) {
        return res.status(400).json({ error: 'Music prompt is required.' });
      }

      const selectedModel =
        model === 'lyria-3-pro-preview' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

      const parts: Part[] = [];
      if (referenceImageBase64) {
        const cleaned = stripDataUrlPrefix(referenceImageBase64);
        parts.push({
          inlineData: {
            mimeType: referenceMimeType || cleaned.detectedMime || 'image/jpeg',
            data: cleaned.base64,
          },
        });
      }
      parts.push({ text: trimmedPrompt });

      // Do not set responseModalities for Lyria 3 so both audio and lyrics stream cleanly
      const stream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: parts,
      });

      const audioChunks: Buffer[] = [];
      const lyricSegments: string[] = [];
      let audioMimeType = 'audio/mpeg';

      for await (const chunk of stream) {
        const chunkParts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of chunkParts) {
          if (part.text) {
            lyricSegments.push(part.text);
          }
          if (part.inlineData?.data) {
            if (part.inlineData.mimeType) {
              audioMimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
        }
      }

      if (audioChunks.length === 0) {
        return res.status(502).json({ error: 'No audio track was returned by Lyria.' });
      }

      const combined = Buffer.concat(audioChunks);
      return res.json({
        audioDataUrl: `data:${audioMimeType};base64,${combined.toString('base64')}`,
        mimeType: audioMimeType,
        lyrics: lyricSegments.join('').trim(),
        model: selectedModel,
      });
    } catch (error) {
      console.error('Lyria music generation error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Music generation failed.',
      });
    }
  });

  // 3. Image Generation & Image Editing via Gemini Nano Banana 2.1
  app.post('/api/ai/image', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    }

    try {
      const {
        prompt,
        aspectRatio = '1:1',
        imageSize = '1K',
        referenceImageBase64,
        referenceMimeType,
      } = (req.body || {}) as {
        prompt?: string;
        aspectRatio?: string;
        imageSize?: '1K' | '2K';
        referenceImageBase64?: string;
        referenceMimeType?: string;
      };

      const trimmedPrompt = String(prompt || '').trim();
      if (!trimmedPrompt) {
        return res.status(400).json({ error: 'Image prompt is required.' });
      }

      const parts: Part[] = [{ text: trimmedPrompt }];
      if (referenceImageBase64) {
        const cleaned = stripDataUrlPrefix(referenceImageBase64);
        parts.push({
          inlineData: {
            mimeType: referenceMimeType || cleaned.detectedMime || 'image/png',
            data: cleaned.base64,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: parts,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: {
            aspectRatio,
            imageSize: imageSize === '2K' ? '2K' : '1K',
          },
        },
      });

      const outParts = response.candidates?.[0]?.content?.parts || [];
      let imageDataUrl = '';
      const notes: string[] = [];

      for (const part of outParts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          notes.push(part.text);
        }
      }

      if (!imageDataUrl) {
        return res.status(502).json({ error: 'No image output was returned.' });
      }

      return res.json({
        imageDataUrl,
        notes: notes.join('\n').trim(),
        model: 'gemini-nano-banana-2.1',
      });
    } catch (error) {
      console.error('Nano Banana image error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Image generation failed.',
      });
    }
  });

  // 4. Text-to-Video & Image-to-Video Animation via Gemini Omni 1.2 Flash (Interactions API)
  app.post('/api/ai/video', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    }

    try {
      const {
        prompt,
        aspectRatio = '16:9',
        startingImageBase64,
        startingMimeType,
      } = (req.body || {}) as {
        prompt?: string;
        aspectRatio?: '16:9' | '9:16';
        startingImageBase64?: string;
        startingMimeType?: string;
      };

      const trimmedPrompt = String(prompt || '').trim();
      if (!trimmedPrompt) {
        return res.status(400).json({ error: 'Video prompt is required.' });
      }

      const ratio = aspectRatio === '9:16' ? '9:16' : '16:9';

      let input:
        | string
        | Array<
            | { type: 'text'; text: string }
            | { type: 'image'; data: string; mime_type: 'image/png' | 'image/jpeg' | 'image/webp' }
          > = trimmedPrompt;

      if (startingImageBase64) {
        const cleaned = stripDataUrlPrefix(startingImageBase64);
        const rawMime = (startingMimeType || cleaned.detectedMime || 'image/png').toLowerCase();
        const safeMime: 'image/png' | 'image/jpeg' | 'image/webp' =
          rawMime === 'image/jpeg' || rawMime === 'image/jpg'
            ? 'image/jpeg'
            : rawMime === 'image/webp'
              ? 'image/webp'
              : 'image/png';

        input = [
          { type: 'image', data: cleaned.base64, mime_type: safeMime },
          { type: 'text', text: trimmedPrompt },
        ];
      }

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input,
          background: false,
          store: false,
          response_format: {
            type: 'video',
            aspect_ratio: ratio,
            duration: '10s',
            resolution: '720p',
          },
        },
        { timeout: 300000 },
      );

      const typedVideo = interaction.output_video;
      const legacyOutputs = (
        interaction as unknown as {
          outputs?: Array<{ type?: string; data?: string; mime_type?: string }>;
        }
      ).outputs;
      const fallbackOutput = legacyOutputs?.find(
        (o) =>
          o.type === 'video' ||
          (typeof o.mime_type === 'string' && o.mime_type.startsWith('video/')),
      );

      const videoData = typedVideo?.data || fallbackOutput?.data;
      const videoMime = typedVideo?.mime_type || fallbackOutput?.mime_type || 'video/mp4';

      if (!videoData) {
        return res.status(502).json({ error: 'Video generation returned no playable stream.' });
      }

      return res.json({
        videoDataUrl: `data:${videoMime};base64,${videoData}`,
        mimeType: videoMime,
        model: 'gemini-omni-1.2-flash',
      });
    } catch (error) {
      console.error('Omni video generation error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Video generation failed.',
      });
    }
  });

  // 5. Audio Transcription via gemini-3.5-transcribe
  app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    }

    try {
      const { audioBase64, mimeType, prompt } = (req.body || {}) as {
        audioBase64?: string;
        mimeType?: string;
        prompt?: string;
      };

      if (!audioBase64) {
        return res.status(400).json({ error: 'Audio recording or file is required.' });
      }

      const cleaned = stripDataUrlPrefix(audioBase64);
      const effectiveMime = mimeType || cleaned.detectedMime || 'audio/webm';
      const instruction =
        typeof prompt === 'string' && prompt.trim()
          ? prompt.trim()
          : 'Transcribe this audio accurately with punctuation and clean speaker/lyric phrasing.';

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: [
          {
            inlineData: {
              mimeType: effectiveMime,
              data: cleaned.base64,
            },
          },
          instruction,
        ],
      });

      return res.json({
        transcript: (response.text || '').trim(),
        model: 'gemini-3.5-transcribe',
      });
    } catch (error) {
      console.error('Gemini transcription error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Audio transcription failed.',
      });
    }
  });
}
