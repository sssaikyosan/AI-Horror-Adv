export interface LMStudioMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LMStudioCompletionRequest {
    model: string;
    messages: LMStudioMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface LMStudioCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
}

export interface LMStudioStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: string;
            content?: string;
        };
        finish_reason: string | null;
    }>;
}

export class LMStudioClient {
    private baseUrl: string;
    private apiKey: string | undefined;
    private defaultModel: string;

    constructor(baseUrl: string = 'http://localhost:1234/v1', defaultModel: string = 'default', apiKey?: string) {
        this.baseUrl = baseUrl;
        this.defaultModel = defaultModel;
        this.apiKey = apiKey;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        return headers;
    }

    async sendMessage(
        messages: LMStudioMessage[],
        onToken?: (token: string) => void,
        options?: {
            model?: string;
            temperature?: number;
            max_tokens?: number;
        }
    ): Promise<string> {
        const request: LMStudioCompletionRequest = {
            model: options?.model || this.defaultModel,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.max_tokens,
            stream: !!onToken
        };

        try {
            if (onToken) {
                return await this.streamResponse(request, onToken);
            } else {
                return await this.getCompletion(request);
            }
        } catch (error) {
            console.error('LM Studio API error:', error);
            throw new Error(`LM Studio API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async getCompletion(request: LMStudioCompletionRequest): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data: LMStudioCompletionResponse = await response.json();
            return data.choices[0]?.message.content || '';
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error(`ネットワークエラー: LM Studioサーバーに接続できません。URLが正しいか、サーバーが起動しているか確認してください。(${this.baseUrl})`);
            }
            throw error;
        }
    }

    private async streamResponse(
        request: LMStudioCompletionRequest,
        onToken: (token: string) => void
    ): Promise<string> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;

                        try {
                            const chunk: LMStudioStreamChunk = JSON.parse(dataStr);
                            const content = chunk.choices[0]?.delta.content || '';

                            if (content) {
                                fullContent += content;
                                onToken(content);
                            }
                        } catch (e) {
                            console.warn('Failed to parse stream chunk:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return fullContent;
    }

    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: this.getHeaders(),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.data?.map((model: any) => model.id) || [];
        } catch (error) {
            console.error('Failed to get models:', error);
            return [this.defaultModel];
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
}