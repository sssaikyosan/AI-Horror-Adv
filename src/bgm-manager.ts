export class BGMManager {
    private audio: HTMLAudioElement | null = null;
    private isPlaying: boolean = false;
    private bgmPath: string;
    private volume: number;

    constructor(bgmPath: string = './music.mp3', initialVolume: number = 0.3) {
        this.bgmPath = bgmPath;
        this.volume = initialVolume;
        this.audio = new Audio(this.bgmPath);
        this.audio.loop = true;
        this.audio.volume = initialVolume;
        console.log('BGMManager initialized with volume:', initialVolume);
    }

    /**
     * BGMを再生する
     */
    play(): void {
        if (!this.audio) {
            this.audio = new Audio(this.bgmPath);
            this.audio.loop = true;
            this.audio.volume = this.volume;
            console.log('Created new audio element with volume:', this.volume);
        }

        // Ensure the volume is set correctly
        if (this.audio) {
            this.audio.volume = this.volume;
            console.log('Setting audio volume to:', this.volume);
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
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audio) {
            this.audio.volume = this.volume;
        }
        console.log('BGM volume set to:', this.volume);
    }

    /**
     * 現在のBGMの音量を取得する
     * @returns number 音量 (0.0 ～ 1.0)
     */
    getVolume(): number {
        return this.volume;
    }

    /**
     * BGMが再生中かどうかを返す
     */
    getIsPlaying(): boolean {
        return this.isPlaying;
    }
}