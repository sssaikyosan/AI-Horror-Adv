import { LMStudioClient, type LMStudioMessage } from './lmstudio-client';
import { GeminiClient } from './gemini-client';

export type GameStatus = 'continue' | 'gameover' | 'gameclear';

export interface GameState {
    sceneDescription: string;
    history: string[];
    currentStep: number;
    gameStatus: GameStatus;
    gameResultDescription?: string; // ゲームオーバーやゲームクリア時の説明文
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
            currentStep: 0,
            gameStatus: 'continue'
        };

        this.systemPrompt = `あなたはホラーゲームのゲームマスターです。
以下のルールに従って不気味で恐怖を煽るゲームを進行してください：

1. ゲームステータスとして、ゲーム続行中(continue)、ゲームオーバー(gameover)、ゲームクリア(gameclear)、から適切なものを提示する。
2. 情景描写を詳細に提供する
3. ゲーム続行中の場合、プレイヤーの選択肢として3つのアクションか提示する
4. 各選択肢は短いタイトルと詳細な説明から構成される
5. 選択肢は現在の状況に関連したものでなければならない
6. プレイヤーの選択に基づいて情景描写を更新し、物語を進行させ、適切なタイミングでゲームオーバーや、ゲームクリアの提示ができるような構成にする。
7. 一貫性のあるストーリーを維持する

レスポンスは必ず以下のJSON形式で返してください：
ゲーム続行中の場合:
{
  "gameStatus": "continue",
  "sceneDescription": "現在の情景描写",
  "choices": [
    {
      "id": "choice1",
      "text": "選択肢の短いタイトル",
      "description": "選択肢の詳細な説明"
    }
  ]
}

ゲームオーバーの場合:
{
  "gameStatus": "gameover",
  "sceneDescription": "現在の情景描写",
  "description": "結果の詳細な説明"
}

ゲークリアの場合:
{
  "gameStatus": "gameclear",
  "sceneDescription": "現在の情景描写",
  "description": "結果の詳細な説明"
}`;
    }

    async startGame(): Promise<{ sceneDescription: string; choices: Choice[] }> {
        this.resetGame();
        try {
            const initialScenarioJson = await this.client.generateInitialScenario();
            console.log(initialScenarioJson);
            const withoutResult = initialScenarioJson.replace(/<think>[\s\S]*?<\/think>/g, '');
            console.log(withoutResult);
            const jsonMatch = withoutResult.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Response does not contain valid JSON');
            }
            const initialScenario = JSON.parse(jsonMatch[0]);

            this.gameState = {
                sceneDescription: initialScenario.sceneDescription,
                history: [initialScenario.sceneDescription],
                currentStep: 0,
                gameStatus: 'continue'
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
                currentStep: 0,
                gameStatus: 'continue'
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
        // 再プレイの場合は履歴をクリアして新しいゲームを開始
        if (choiceId === 'restart') {
            const { sceneDescription, choices } = await this.startGame();
            return {
                updatedScene: sceneDescription,
                newChoices: choices
            };
        }

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
            console.log(response);

            // 1. <result>タグ内の内容を除去
            const withoutResult = response.replace(/<think>[\s\S]*?<\/think>/g, '');
            console.log(withoutResult);
            // 2. JSONオブジェクトを抽出する正規表現
            const jsonMatch = withoutResult.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Response does not contain valid JSON');
            }

            const parsedResponse = JSON.parse(jsonMatch[0]);

            if (parsedResponse.sceneDescription) {
                this.gameState.sceneDescription = parsedResponse.sceneDescription;
            }

            if (parsedResponse.gameStatus) {
                this.gameState.gameStatus = parsedResponse.gameStatus;
            }

            // ゲームステータスに応じた選択肢の設定
            if (this.gameState.gameStatus === 'gameover') {
                this.gameState.gameResultDescription = parsedResponse.description || '';
                this.choices = [
                    { id: 'restart', text: '最初からやり直す', description: 'ゲームを最初からやり直します' }
                ];
            } else if (this.gameState.gameStatus === 'gameclear') {
                this.gameState.gameResultDescription = parsedResponse.description || '';
                this.choices = [
                    { id: 'restart', text: 'もう一度プレイする', description: 'ゲームをもう一度プレイします' }
                ];
            } else {
                this.choices = parsedResponse.choices || [];
            }

            // 新しい情景描写を履歴に追加
            this.gameState.history.push(this.gameState.sceneDescription);
            return {
                updatedScene: this.gameState.sceneDescription,
                newChoices: this.choices
            };
        } catch (error) {
            console.error('Error processing choice:', error);
            this.choices = [
                { id: 'reload', text: '続ける', description: '何とかしてゲームを続ける。' }
            ];
            // エラー時の情景描写も履歴に追加
            const errorScene = this.gameState.sceneDescription + '\\n\\n[エラーが発生しました。ゲームを続行します。]';
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
\\"${choiceAction}\\"

現在のゲーム状況：
情景描写: ${this.gameState.sceneDescription}

この選択の結果として、ゲーム続行、ゲームオーバー、ゲームクリアのいずれかを判断してください。その後新しい情景描写を生成し、ゲームステータス及び、ゲームオーバー、ゲームクリアの場合は結果の詳細、ゲーム続行の場合は新しい選択肢を提示してください。レスポンスは必ず以下のJSON形式で返してください：
ゲーム続行中の場合:
{
  "gameStatus": "continue",
  "sceneDescription": "現在の情景描写",
  "choices": [
    {
      "id": "choice1",
      "text": "選択肢の短いタイトル",
      "description": "選択肢の詳細な説明"
    }
  ]
}

ゲームオーバーの場合:
{
  "gameStatus": "gameover",
  "sceneDescription": "現在の情景描写",
  "description": "結果の詳細な説明"
}

ゲークリアの場合:
{
  "gameStatus": "gameclear",
  "sceneDescription": "現在の情景描写",
  "description": "結果の詳細な説明"
}`;
    }

    private getChoiceActionText(choiceId: string): string {
        const choice = this.choices.find(c => c.id === choiceId);
        if (choice) {
            return `${choice.text} - ${choice.description}`;
        }
        return `${choiceId} を実行`;
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
            currentStep: 0,
            gameStatus: 'continue'
        };
    }
}