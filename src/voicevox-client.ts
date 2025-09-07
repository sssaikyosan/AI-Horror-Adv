export class VoicevoxClient {
    private baseUrl: string;
    private currentAudio: HTMLAudioElement | null = null;

    constructor(baseUrl: string = 'http://localhost:50021') {
        this.baseUrl = baseUrl;
    }

    /**
     * テキストを音声に変換して再生する
     * @param text 読み上げるテキスト
     * @param speakerId 使用する話者ID（省略可）
     * @returns 音声再生が成功したかどうか
     */
    async speakText(text: string, speakerId?: number): Promise<boolean> {
        try {
            // テキストが空の場合は何もしない
            if (!text || text.trim() === '') {
                console.warn('空のテキストは読み上げません');
                return false;
            }

            console.log('Voicevoxクライアント: テキストを音声に変換します', { text, speakerId });

            // クエリ作成エンドポイントを呼び出す
            const queryUrl = new URL(`${this.baseUrl}/audio_query`);
            queryUrl.searchParams.append('text', text);
            queryUrl.searchParams.append('speaker', speakerId?.toString() || '0');

            console.log('Voicevoxクライアント: クエリ作成リクエスト', {
                url: queryUrl.toString()
            });

            const queryResponse = await fetch(queryUrl.toString(), {
                method: 'POST'
            });

            console.log('Voicevoxクライアント: クエリ作成レスポンス', {
                status: queryResponse.status,
                statusText: queryResponse.statusText,
                ok: queryResponse.ok,
                headers: {}
            });

            if (!queryResponse.ok) {
                const errorText = await queryResponse.text();
                console.error('Voicevoxクエリ作成エラー:', {
                    status: queryResponse.status,
                    statusText: queryResponse.statusText,
                    error: errorText,
                    headers: {}
                });
                throw new Error(`Voicevox query API error: ${queryResponse.status} ${queryResponse.statusText} - ${errorText}`);
            }

            const queryData = await queryResponse.json();
            console.log('Voicevoxクライアント: クエリデータを取得しました', queryData);

            // 音声合成エンドポイントを呼び出す
            const synthesisUrl = new URL(`${this.baseUrl}/synthesis`);
            synthesisUrl.searchParams.append('speaker', speakerId?.toString() || '0');

            console.log('Voicevoxクライアント: 音声合成リクエスト', {
                url: synthesisUrl.toString()
            });

            const synthesisResponse = await fetch(synthesisUrl.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(queryData)
            });

            console.log('Voicevoxクライアント: 音声合成レスポンス', {
                status: synthesisResponse.status,
                statusText: synthesisResponse.statusText,
                ok: synthesisResponse.ok,
                headers: {}
            });

            if (!synthesisResponse.ok) {
                const errorText = await synthesisResponse.text();
                console.error('Voicevox音声合成エラー:', {
                    status: synthesisResponse.status,
                    statusText: synthesisResponse.statusText,
                    error: errorText,
                    headers: {}
                });
                throw new Error(`Voicevox synthesis API error: ${synthesisResponse.status} ${synthesisResponse.statusText} - ${errorText}`);
            }

            // 音声データを取得
            const audioBlob = await synthesisResponse.blob();

            console.log('Voicevoxクライアント: 音声データを取得しました', {
                size: audioBlob.size,
                type: audioBlob.type
            });

            // 音声データが非常に小さい場合、エラーレスポンスの可能性があるため内容を確認
            if (audioBlob.size < 100) {
                const errorText = await audioBlob.text();
                console.warn('Voicevoxクライアント: 音声データが小さすぎます。エラーレスポンスの可能性があります。', {
                    size: audioBlob.size,
                    content: errorText
                });
            }

            // 音声データが空の場合
            if (audioBlob.size === 0) {
                console.warn('Voicevoxクライアント: 音声データが空です');
                return false;
            }

            // 既存の音声再生を停止
            if (this.currentAudio) {
                this.currentAudio.pause();
                if (this.currentAudio.src) {
                    URL.revokeObjectURL(this.currentAudio.src);
                }
                this.currentAudio = null;
            }

            // 音声を再生
            const audioUrl = URL.createObjectURL(audioBlob);
            console.log('Voicevoxクライアント: 音声URLを作成しました', { audioUrl });

            this.currentAudio = new Audio(audioUrl);

            // 音声再生完了後にURLを解放
            this.currentAudio.addEventListener('ended', () => {
                if (this.currentAudio && this.currentAudio.src) {
                    URL.revokeObjectURL(this.currentAudio.src);
                }
                this.currentAudio = null;
                console.log('Voicevoxクライアント: 音声再生完了');
            });

            // 音声再生エラー時の処理
            this.currentAudio.addEventListener('error', (e) => {
                console.error('Voicevoxクライアント: 音声再生エラー', e);
                if (this.currentAudio && this.currentAudio.src) {
                    URL.revokeObjectURL(this.currentAudio.src);
                }
                this.currentAudio = null; // エラー時もcurrentAudioをnullに設定
            });

            // 音声の読み込みエラーを処理
            this.currentAudio.addEventListener('loadstart', () => {
                console.log('Voicevoxクライアント: 音声読み込み開始');
            });

            this.currentAudio.addEventListener('loadedmetadata', () => {
                console.log('Voicevoxクライアント: 音声メタデータ読み込み完了');
            });

            this.currentAudio.addEventListener('loadeddata', () => {
                console.log('Voicevoxクライアント: 音声データ読み込み完了');
            });

            this.currentAudio.addEventListener('canplay', () => {
                console.log('Voicevoxクライアント: 音声再生準備完了');
            });

            this.currentAudio.addEventListener('canplaythrough', () => {
                console.log('Voicevoxクライアント: 音声全体の再生準備完了');
            });

            this.currentAudio.addEventListener('abort', () => {
                console.log('Voicevoxクライアント: 音声読み込み中止');
                if (this.currentAudio && this.currentAudio.src) {
                    URL.revokeObjectURL(this.currentAudio.src);
                }
                this.currentAudio = null;
            });

            this.currentAudio.addEventListener('stalled', () => {
                console.log('Voicevoxクライアント: 音声読み込み停滞');
            });

            this.currentAudio.addEventListener('suspend', () => {
                console.log('Voicevoxクライアント: 音声読み込み中断');
            });

            // 音声再生
            console.log('Voicevoxクライアント: 音声を再生します');
            await this.currentAudio.play();

            return true;
        } catch (error) {
            console.error('音声合成エラー:', error);
            console.error('音声合成エラーの詳細:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            });
            // エラーが発生した場合もcurrentAudioをnullに設定
            if (this.currentAudio) {
                if (this.currentAudio.src) {
                    URL.revokeObjectURL(this.currentAudio.src);
                }
                this.currentAudio = null;
            }
            return false;
        }
    }

    /**
     * 話者（キャラクター）の一覧を取得する
     * @returns 利用可能な話者情報の配列
     */
    async getAvailableSpeakers(): Promise<Array<{ name: string, id: number }>> {
        try {
            console.log('Voicevoxクライアント: 利用可能な話者を取得します');
            const response = await fetch(`${this.baseUrl}/speakers`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            console.log('Voicevoxクライアント: 話者取得レスポンス', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: {}
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Voicevox話者取得エラー:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText,
                    headers: {}
                });
                throw new Error(`Voicevox speakers API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const speakersData = await response.json();
            console.log('Voicevoxクライアント: 話者データ', speakersData);

            // 話者データから名前とIDのリストを抽出
            const speakerList: Array<{ name: string, id: number }> = [];
            speakersData.forEach((speaker: any) => {
                speaker.styles.forEach((style: any) => {
                    speakerList.push({
                        name: `${speaker.name} (${style.name})`,
                        id: style.id
                    });
                });
            });

            console.log('Voicevoxクライアント: 利用可能な話者', speakerList);
            return speakerList;
        } catch (error) {
            console.error('話者取得エラー:', error);
            console.error('話者取得エラーの詳細:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            });
            // エラーが発生した場合は空の配列を返す
            return [];
        }
    }

    /**
     * Voicevoxサーバーの状態を確認する
     * @returns サーバーが利用可能かどうか
     */
    async isServerAvailable(): Promise<boolean> {
        try {
            console.log('Voicevoxクライアント: サーバーの状態を確認します', { baseUrl: this.baseUrl });
            const response = await fetch(`${this.baseUrl}/version`, {
                method: 'GET'
            });

            console.log('Voicevoxクライアント: サーバー状態確認レスポンス', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                headers: {}
            });

            return response.ok;
        } catch (error) {
            console.error('Voicevoxサーバー接続エラー:', error);
            console.error('Voicevoxサーバー接続エラーの詳細:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            });
            return false;
        }
    }
}