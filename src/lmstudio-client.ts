export interface LMStudioMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LMStudioCompletionRequest {
    model: string;
    messages: LMStudioMessage[];
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

    updateConfig(baseUrl: string, apiKey?: string): void {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        console.log('LMStudioClient config updated', { baseUrl, apiKey });
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
            max_tokens?: number;
        }
    ): Promise<string> {
        const request: LMStudioCompletionRequest = {
            model: options?.model || this.defaultModel,
            messages,
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
}