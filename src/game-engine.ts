import { LMStudioClient, type LMStudioMessage } from './lmstudio-client';
import { GeminiClient } from './gemini-client';
import { BGMManager } from './bgm-manager';
import { VoicevoxClient } from './voicevox-client';

export type GameStatus = 'continue' | 'gameover' | 'gameclear';

export interface GameState {
    story: string;
    history: string[];
    currentStep: number;
    gameStatus: GameStatus;
    gameResultDescription?: string; // ゲームオーバーやゲームクリア時の説明文
    choices?: Choice[]; // 選択肢を保持
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
    private bgmManager: BGMManager;
    private voicevoxClient: VoicevoxClient;
    private selectedSpeakerId: number;
    private isSpeechEnabled: boolean = true; // デフォルトで音声読み上げを有効にする

    constructor(client: LMStudioClient | GeminiClient, selectedSpeakerId: number = 0) {
        this.client = client;
        this.gameState = {
            story: '',
            history: [],
            currentStep: 0,
            gameStatus: 'continue',
            choices: [] // 初期化
        };
        this.bgmManager = new BGMManager();
        this.voicevoxClient = new VoicevoxClient();
        this.selectedSpeakerId = selectedSpeakerId;

        this.systemPrompt = `あなたはホラーゲームのゲームマスターです。
以下のルールに従ってゲームを進行してください：

1. ゲームステータスとして、ゲーム続行中(continue)、ゲームオーバー(gameover)、ゲームクリア(gameclear)、から適切なものを提示する。
2. ストーリーを詳細に提供する
3. ゲーム続行中の場合、プレイヤーの選択肢として3つのアクションか提示する
4. 各選択肢は短いタイトルと意図の説明から構成される
5. 選択肢は現在の状況に関連したものでなければならない
6. プレイヤーの選択に基づいてストーリーを更新し、物語を進行させ、適切なタイミングでゲームオーバーや、ゲームクリアの提示をする。
7. 一貫性のあるストーリーを維持する

レスポンスは必ず以下のJSON形式で返してください：
ゲーム続行中の場合:
{
  "gameStatus": "continue",
  "story": "現在のストーリー",
  "choices": [
    {
      "id": "choice1",
      "text": "選択肢の短いタイトル",
      "description": "選択肢の意図の説明"
    }
  ]
}

ゲームオーバーの場合:
{
  "gameStatus": "gameover",
  "story": "現在のストーリー",
  "description": "結果の詳細な説明"
}

ゲークリアの場合:
{
  "gameStatus": "gameclear",
  "story": "現在のストーリー",
  "description": "結果の詳細な説明"
}`;
    }

    async startGame(): Promise<{ story: string; choices: Choice[] }> {
        // BGMを再生
        this.bgmManager.play();
        try {
            let initialScenarioJson = await this.generateInitialScenario();
            const withoutResult = initialScenarioJson.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
            const jsonMatch = withoutResult.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Response does not contain valid JSON');
            }
            const initialScenario = JSON.parse(jsonMatch[0]);

            this.gameState = {
                story: initialScenario.story,
                history: [initialScenario.story],
                currentStep: 0,
                gameStatus: 'continue',
                choices: initialScenario.choices || []
            };

            this.choices = initialScenario.choices || [];

            // 初期情景を読み上げ (音声読み上げがオンの場合のみ)
            this.speakText(initialScenario.story);

            return {
                story: this.gameState.story,
                choices: this.choices
            };

        } catch (error) {
            console.error('Error initializing game with LLM:', error);
            console.error('Error initializing game with LLM details:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            });
            // エラーを呼び出し元に再スローする
            throw error;
        }
    }

    async generateInitialScenario(): Promise<string> {
        const messages: LMStudioMessage[] = [
            {
                role: 'system',
                content: `あなたはホラーゲームのゲームマスターです。
以下のルールに従って、開始シナリオを生成してください。：

1. ゲームステータスとして、ゲーム続行中(continue)、ゲームオーバー(gameover)、ゲームクリア(gameclear)、から適切なものを提示する。
2. ストーリーを詳細に提供する
3. ゲーム続行中の場合、プレイヤーの選択肢として3つのアクションか提示する
4. 各選択肢は短いタイトルと意図の説明から構成される
5. 選択肢は現在の状況に関連したものでなければならない
6. プレイヤーの選択に基づいてストーリーを更新し、物語を進行させ、適切なタイミングでゲームオーバーや、ゲームクリアの提示をする。
7. 一貫性のあるストーリーを維持する

レスポンスは必ず以下のJSON形式で返してください：
ゲーム続行中の場合:
{
  "gameStatus": "continue",
  "story": "現在のストーリー",
  "choices": [
    {
      "id": "choice1",
      "text": "選択肢の短いタイトル",
      "description": "選択肢の意図の説明"
    }
  ]
}

ゲームオーバーの場合:
{
  "gameStatus": "gameover",
  "story": "現在のストーリー",
  "description": "結果の詳細な説明"
}

ゲークリアの場合:
{
  "gameStatus": "gameclear",
  "story": "現在のストーリー",
  "description": "結果の詳細な説明"
}`
            },
            {
                role: 'user',
                content: `プレイヤーの最初の状況設定と、最初の選択肢をJSON形式で生成してください。`
            }
        ];
        let initialScenarioJson = '';
        if (this.client instanceof GeminiClient) {
            initialScenarioJson = await (this.client as GeminiClient).sendMessage(messages);
        } else {
            initialScenarioJson = await (this.client as LMStudioClient).sendMessage(messages);
        }
        return initialScenarioJson;
    }

    async makeChoice(choiceId: string): Promise<{ updatedScene: string; newChoices: Choice[]; error?: string }> {
        console.log('GameEngine: 選択肢を処理します', { choiceId });

        // 再プレイの場合は履歴をクリアして新しいゲームを開始
        if (choiceId === 'restart') {
            console.log('GameEngine: 再プレイ処理');
            const result = await this.startGame();
            return {
                updatedScene: result.story,
                newChoices: result.choices
            };
        }

        // 選択されたアクションを履歴に追加
        const choiceAction = this.getChoiceActionText(choiceId);
        console.log('GameEngine: 選択されたアクション', { choiceAction });
        this.gameState.history.push(choiceAction);
        this.gameState.currentStep++;

        const messages: LMStudioMessage[] = [];
        messages.push({ role: 'system', content: this.systemPrompt });
        for (let i = 0; i < this.gameState.history.length; i++) {
            if (i % 2 === 0) {
                messages.push({ role: 'assistant', content: this.gameState.history[i] });
            } else {
                messages.push({ role: 'user', content: this.gameState.history[i] });
            }
        }

        messages.push({
            role: 'user', content: `プレイヤーが以下のアクションを選択しました：
"${this.getChoiceActionText(choiceId)}"

現在のゲーム状況：
ストーリー: ${this.gameState.story}

この選択の結果として、ゲーム続行、ゲームオーバー、ゲームクリアのいずれかを判断してください。その後新しいストーリーを生成し、ゲームステータス及び、ゲームオーバー、ゲームクリアの場合は結果の詳細、ゲーム続行の場合は新しい選択肢を提示してください。レスポンスは必ず以下のJSON形式で返してください：
ゲーム続行中の場合:
{
  "gameStatus": "continue",
  "story": "現在のストーリー",
  "choices": [
    {
      "id": "choice1",
      "text": "選択肢の短いタイトル",
      "description": "選択肢の意図の説明"
    }
  ]
}

ゲームオーバーの場合:
{
  "gameStatus": "gameover",
  "story": "現在のストーリー",
  "description": "結果の詳細な説明"
}

ゲークリアの場合:
{
  "gameStatus": "gameclear",
  "story": "現在のストーリー",
  "description": "結果の詳細な説明"
}` });
        try {
            let response = '';
            // Check which type of client we're using
            if (this.client instanceof GeminiClient) {
                response = await (this.client as GeminiClient).sendMessage(messages);
            } else {
                response = await (this.client as LMStudioClient).sendMessage(messages, undefined);
            }
            console.log('GameEngine: LLMからのレスポンス', response);

            // 1. <think>タグ内の内容を除去
            const withoutResult = response.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
            // 2. JSONオブジェクトを抽出する正規表現
            const jsonMatch = withoutResult.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Response does not contain valid JSON');
            }

            const parsedResponse = JSON.parse(jsonMatch[0]);

            if (parsedResponse.story) {
                this.gameState.story = parsedResponse.story;
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
                // BGMを停止
                this.bgmManager.stop();
            } else if (this.gameState.gameStatus === 'gameclear') {
                this.gameState.gameResultDescription = parsedResponse.description || '';
                this.choices = [
                    { id: 'restart', text: 'もう一度プレイする', description: 'ゲームをもう一度プレイします' }
                ];
                // BGMを停止
                this.bgmManager.stop();
            } else {
                this.choices = parsedResponse.choices || [];
            }

            // 新しいストーリーを履歴に追加
            this.gameState.history.push(this.gameState.story);

            // gameStateに選択肢を保存
            this.gameState.choices = this.choices;

            // 新しい情景を読み上げ (音声読み上げがオンの場合のみ)
            this.speakText(this.gameState.story);

            return {
                updatedScene: this.gameState.story,
                newChoices: this.choices
            };
        } catch (error) {
            console.error('Error processing choice:', error);
            console.error('Error processing choice details:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            });

            // 選択を履歴から削除
            this.gameState.history.pop();
            this.gameState.currentStep--;

            const errorMessage = '通信に失敗しました。APIの設定を確認してもう一度選択してください。';

            return {
                updatedScene: this.gameState.story, // 直前のストーリーを返す
                newChoices: this.choices, // 直前の選択肢を返す
                error: errorMessage
            };
        }
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
            story: '',
            history: [],
            currentStep: 0,
            gameStatus: 'continue',
            choices: []
        };
        // BGMを停止
        this.bgmManager.stop();
    }

    updateClient(newClient: LMStudioClient | GeminiClient): void {
        this.client = newClient;
        console.log('GameEngine client updated');
    }

    updateSpeaker(speakerId: number): void {
        this.selectedSpeakerId = speakerId;
        console.log('GameEngine speaker updated to:', speakerId);
    }

    /**
     * テキストを音声で読み上げる
     * @param text 読み上げるテキスト
     */
    async speakText(text: string): Promise<void> {
        if (!this.isSpeechEnabled) return
        try {
            console.log('GameEngine: テキストを読み上げます', { text, selectedSpeakerId: this.selectedSpeakerId });

            // Voicevoxが利用可能な場合のみ読み上げを実行
            const isAvailable = await this.voicevoxClient.isServerAvailable();
            console.log('GameEngine: Voicevoxサーバーの状態', { isAvailable });

            if (isAvailable) {
                console.log('GameEngine: Voicevoxサーバーが利用可能です');
                const result = await this.voicevoxClient.speakText(text, this.selectedSpeakerId);
                console.log('GameEngine: 音声読み上げ結果', { result });
            } else {
                console.warn('Voicevoxサーバーが利用できません。読み上げをスキップします。');
            }
        } catch (error) {
            console.error('GameEngine: 音声読み上げエラー:', error);
            console.error('GameEngine: 音声読み上げエラーの詳細:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            });
        }
    }

    /**
     * 現在の選択肢を取得します
     */
    getChoices(): Choice[] {
        return this.choices;
    }

    /**
     * 現在のゲーム状態をローカルストレージに保存します
     */
    saveGame(): void {
        if (this.gameState.history.length === 0) {
            console.log('ゲームデータが存在しないため保存に失敗しました');
            return
        }
        try {
            const gameStateToSave = {
                ...this.gameState,
                // 必要に応じて追加の状態をここに保存
            };
            localStorage.setItem('aiHorrorGameState', JSON.stringify(gameStateToSave));
            console.log('ゲーム状態を保存しました');
        } catch (error) {
            console.error('ゲーム状態の保存に失敗しました:', error);
        }
    }

    /**
     * ローカルストレージからゲーム状態を読み込みます
     */
    loadGame(): GameState | null {
        try {
            const savedState = localStorage.getItem('aiHorrorGameState');
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                // 型チェックを行う（必要に応じて）
                if (this.isValidGameState(parsedState)) {
                    this.gameState = parsedState;
                    console.log('ゲーム状態を読み込みました');
                    return this.gameState;
                } else {
                    console.warn('保存されたゲーム状態の形式が無効です');
                    return null;
                }
            }
            console.log('保存されたゲーム状態が見つかりません');
            return null;
        } catch (error) {
            console.error('ゲーム状態の読み込みに失敗しました:', error);
            return null;
        }
    }

    /**
     * ロードされたゲーム状態が有効かどうかを確認します
     * @param state 検証するゲーム状態
     */
    private isValidGameState(state: any): state is GameState {
        return (
            typeof state === 'object' &&
            state !== null &&
            typeof state.story === 'string' &&
            Array.isArray(state.history) &&
            typeof state.currentStep === 'number' &&
            (state.gameStatus === 'continue' || state.gameStatus === 'gameover' || state.gameStatus === 'gameclear')
        );
    }

    getIsSpeechEnabled() {
        return this.isSpeechEnabled;
    }

    toggleIsSpeechEnabled() {
        this.isSpeechEnabled = !this.isSpeechEnabled;
    }
}