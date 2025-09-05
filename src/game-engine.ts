import { LMStudioClient, type LMStudioMessage } from './lmstudio-client';
import { GeminiClient } from './gemini-client';

export interface GameState {
    sceneDescription: string;
    history: string[];
    currentStep: number;
}

export interface Choice {
    id: string;
    text: string;
    description: string;
}

export class GameEngine {
    private client: LMStudioClient | GeminiClient;
    private gameState: GameState;
    private systemPrompt: string;
    private choices: Choice[] = [];

    constructor(client: LMStudioClient | GeminiClient) {
        this.client = client;
        this.gameState = {
            sceneDescription: '',
            history: [],
            currentStep: 0
        };

        this.systemPrompt = `あなたはホラーゲームのゲームマスターです。
以下のルールに従って不気味で恐怖を煽るゲームを進行してください：

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
}`;
    }

    async startGame(): Promise<{ sceneDescription: string; choices: Choice[] }> {
        this.resetGame();
        try {
            const initialScenarioJson = await this.client.generateInitialScenario();
            const withoutResult = initialScenarioJson.replace(/<think>[\s\S]*?<\/think>/g, '');

            const jsonMatch = withoutResult.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Response does not contain valid JSON');
            }
            const initialScenario = JSON.parse(jsonMatch[0]);

            this.gameState = {
                sceneDescription: initialScenario.sceneDescription,
                history: [initialScenario.sceneDescription],
                currentStep: 0
            };

            this.choices = initialScenario.choices || [];
            return {
                sceneDescription: this.gameState.sceneDescription,
                choices: this.choices
            };

        } catch (error) {
            console.error('Error initializing game with LLM:', error);
            // LLMからの取得に失敗した場合のフォールバック
            this.gameState = {
                sceneDescription: 'あなたは森の入口に立っている。古い道が奥へと続いている。',
                history: ['あなたは森の入口に立っている。古い道が奥へと続いている。'],
                currentStep: 0
            };
            this.choices = [
                { id: 'explore', text: '周囲を探る', description: '不気味な音の正体を探る' },
                { id: 'flee', text: '逃げる', description: '危険から離れるために走り出す' }
            ];
            return {
                sceneDescription: this.gameState.sceneDescription,
                choices: this.choices
            };
        }
    }

    async makeChoice(choiceId: string): Promise<{ updatedScene: string; newChoices: Choice[] }> {
        // 選択されたアクションを履歴に追加
        const choiceAction = this.getChoiceActionText(choiceId);
        this.gameState.history.push(choiceAction);
        this.gameState.currentStep++;

        // 新しい情景描写と選択肢を生成
        const messages: LMStudioMessage[] = [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: this.createChoiceContextPrompt(choiceId) }
        ];

        try {
            let response = '';
            // Check which type of client we're using
            if (this.client instanceof GeminiClient) {
                response = await (this.client as GeminiClient).sendMessage(messages);
            } else {
                response = await (this.client as LMStudioClient).sendMessage(messages);
            }

            // 1. <result>タグ内の内容を除去
            const withoutResult = response.replace(/<think>[\s\S]*?<\/think>/g, '');

            // 2. JSONオブジェクトを抽出する正規表現
            const jsonMatch = withoutResult.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Response does not contain valid JSON');
            }

            const parsedResponse = JSON.parse(jsonMatch[0]);

            if (parsedResponse.sceneDescription) {
                this.gameState.sceneDescription = parsedResponse.sceneDescription;
            }

            this.choices = parsedResponse.choices || [];
            // 新しい情景描写を履歴に追加
            this.gameState.history.push(this.gameState.sceneDescription);
            return {
                updatedScene: this.gameState.sceneDescription,
                newChoices: this.choices
            };
        } catch (error) {
            console.error('Error processing choice:', error);
            this.choices = [
                { id: 'continue', text: '続ける', description: '何とかしてゲームを続ける。' }
            ];
            // エラー時の情景描写も履歴に追加
            const errorScene = this.gameState.sceneDescription + '\n\n[エラーが発生しました。ゲームを続行します。]';
            this.gameState.history.push(errorScene);
            return {
                updatedScene: errorScene,
                newChoices: this.choices
            };
        }
    }

    private createChoiceContextPrompt(choiceId: string): string {
        const choiceAction = this.getChoiceActionText(choiceId);
        return `プレイヤーが以下のアクションを選択しました：
"${choiceAction}"

現在のゲーム状況：
情景描写: ${this.gameState.sceneDescription}

この選択の結果として、新しい情景描写と次の選択肢を生成してください。`;
    }

    private getChoiceActionText(choiceId: string): string {
        const choice = this.choices.find(c => c.id === choiceId);
        if (choice) {
            return `${choice.text} - ${choice.description}`;
        }
        return `アクション ${choiceId} を実行`;
    }



    getGameState(): GameState {
        return { ...this.gameState };
    }

    setSystemPrompt(prompt: string): void {
        this.systemPrompt = prompt;
    }

    resetGame(): void {
        this.gameState = {
            sceneDescription: '',
            history: [],
            currentStep: 0
        };
    }
}