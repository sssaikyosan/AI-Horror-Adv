import type { LMStudioMessage } from './lmstudio-client';

// Gemini API request format
interface GeminiRequest {
    contents: GeminiContent[];
}

interface GeminiContent {
    role: 'user' | 'model';
    parts: { text: string }[];
}

// Gemini API response format
interface GeminiResponse {
    candidates: {
        content: {
            role: 'model';
            parts: { text: string }[];
        };
    }[];
}

export class GeminiClient {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'gemini-2.5-pro') {
        this.apiKey = apiKey;
        this.model = model;
    }

    setModel(model: string): void {
        this.model = model;
    }

    getModel(): string {
        return this.model;
    }

    updateConfig(apiKey: string, model: string): void {
        this.apiKey = apiKey;
        this.model = model;
        console.log('GeminiClient config updated', { apiKey, model });
    }

    private transformMessagesToGemini(messages: LMStudioMessage[]): GeminiContent[] {
        // Gemini doesn't have a 'system' role. We'll prepend the system prompt to the first user message.
        let systemPrompt = '';
        const geminiContents: GeminiContent[] = [];

        messages.forEach(msg => {
            if (msg.role === 'system') {
                systemPrompt = msg.content + '\n\n';
            } else if (msg.role === 'user') {
                const content = geminiContents.length === 0 ? systemPrompt + msg.content : msg.content;
                geminiContents.push({ role: 'user', parts: [{ text: content }] });
            } else if (msg.role === 'assistant') {
                geminiContents.push({ role: 'model', parts: [{ text: msg.content }] });
            }
        });

        return geminiContents;
    }

    async sendMessage(messages: LMStudioMessage[]): Promise<string> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const requestBody: GeminiRequest = {
            contents: this.transformMessagesToGemini(messages),
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
            }

            const data: GeminiResponse = await response.json();
            return data.candidates[0]?.content.parts[0]?.text || '';
        } catch (error) {
            console.error('Gemini API error:', error);
            throw new Error(`Gemini API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async generateInitialScenario(): Promise<string> {
        const messages: LMStudioMessage[] = [
            {
                role: 'system',
                content: `あなたはホラーゲームのゲームマスターです。以下のルールに従って、プレイヤーが没入できるような開始シナリオを生成してください。：

1. 情景描写を詳細に提供する
2. プレイヤーの選択肢として3つのアクションを提示する
3. 各選択肢は短いタイトルと詳細な説明から構成される
4. 選択肢は現在の状況に関連したものでなければならない
5. プレイヤーの選択に基づいて情景描写を更新し、物語を進行させる
6. 一貫性のあるストーリーを維持する

レスポンスは必ず以下のJSON形式で返してください：
{
  "sceneDescription": "現在の情景描写",
  "choices": [
    {
      "id": "choice1",
      "text": "選択肢の短いタイトル",
      "description": "選択肢の詳細な説明"
    }
  ]
}`
            },
            {
                role: 'user',
                content: `プレイヤーの最初の状況設定と、最初の選択肢をJSON形式で生成してください。`
            }
        ];

        return await this.sendMessage(messages);
    }

    async getAvailableModels(): Promise<string[]> {
        // If no API key is provided, return a hardcoded list of common models
        if (!this.apiKey) {
            return [];
        }

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                // If API key is invalid, return hardcoded list
                if (response.status === 401 || response.status === 403) {
                    console.warn('Invalid API key for Gemini. Returning default model list.');
                    return [];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            // Extract model names from the response
            const models = data.models
                .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
                .map((model: any) => model.name.split('/').pop());

            return models.length > 0 ? models : [];
        } catch (error) {
            console.error('Error fetching Gemini models:', error);
            // Return a hardcoded list as fallback
            return [];
        }
    }
}
