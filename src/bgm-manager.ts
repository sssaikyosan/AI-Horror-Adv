export class BGMManager {
    private audio: HTMLAudioElement | null = null;
    private isPlaying: boolean = false;
    private bgmPath: string;

    constructor(bgmPath: string = './music.mp3') {
        this.bgmPath = bgmPath;
    }

    /**
     * BGMを再生する
     */
    play(): void {
        if (!this.audio) {
            this.audio = new Audio(this.bgmPath);
            this.audio.loop = true; // ループ再生
            this.audio.volume = 0.3; // 音量を少し小さめに設定
        }

        // 再生中にエラーが発生した場合の処理
        this.audio.addEventListener('error', (e) => {
            console.error('BGM再生エラー:', e);
        });

        // 音楽の再生
        this.audio.play()
            .then(() => {
                this.isPlaying = true;
                console.log('BGMを再生開始しました');
            })
            .catch((error) => {
                console.error('BGMの再生に失敗しました:', error);
            });
    }

    /**
     * BGMを停止する
     */
    stop(): void {
        if (this.audio && this.isPlaying) {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.isPlaying = false;
            console.log('BGMを停止しました');
        }
    }

    /**
     * BGMの音量を調整する
     * @param volume 音量 (0.0 ～ 1.0)
     */
    setVolume(volume: number): void {
        if (this.audio) {
            this.audio.volume = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * BGMが再生中かどうかを返す
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }
}