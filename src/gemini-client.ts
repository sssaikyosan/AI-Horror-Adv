import type { LMStudioMessage } from './lmstudio-client';

// Gemini API request format

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

    constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
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

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private isPerDayQuotaError(errorBody: string): boolean {
        return errorBody.includes('PerDay') || errorBody.includes('per day') || errorBody.includes('daily');
    }

    async sendMessage(messages: LMStudioMessage[], maxRetries: number = 2, retryDelay: number = 30000): Promise<string> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const requestBody: any = {
            contents: this.transformMessagesToGemini(messages),
        };

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                if (response.status === 429) {
                    const errorBody = await response.text();
                    console.warn(`Gemini API 429 (attempt ${attempt + 1}/${maxRetries + 1}):`, errorBody);

                    if (this.isPerDayQuotaError(errorBody)) {
                        throw new Error('APIの1日の利用上限に達しました。明日再度お試しいただくか、Google AI Studioで有料プランにアップグレードしてください。');
                    }

                    if (attempt < maxRetries) {
                        console.log(`Rate limited. Retrying in ${retryDelay / 1000} seconds...`);
                        await this.delay(retryDelay);
                        continue;
                    }

                    throw new Error('APIリクエストが一時的に制限されています。しばらく待ってから再度お試しください。');
                }

                if (!response.ok) {
                    const errorBody = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
                }

                const data: GeminiResponse = await response.json();
                return data.candidates[0]?.content.parts[0]?.text || '';
            } catch (error) {
                if (error instanceof Error && (
                    error.message.includes('APIの1日の利用上限') ||
                    error.message.includes('APIリクエストが一時的に制限')
                )) {
                    throw error;
                }
                console.error('Gemini API error:', error);
                throw new Error(`Gemini API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        throw new Error('APIリクエストが一時的に制限されています。しばらく待ってから再度お試しください。');
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
