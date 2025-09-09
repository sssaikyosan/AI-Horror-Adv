import { GameEngine, type Choice, type GameState } from './game-engine';
import { GeminiClient } from './gemini-client';
import { LMStudioClient } from './lmstudio-client';
import { VoicevoxClient } from './voicevox-client';

// Add a simple type for the settings
interface GameSettings {
    apiType: string;
    apiKey: string;
    apiUrl: string;
    model: string;
    speakerId: number;
    bgmVolume?: number;
}

export class GameUI {
    private gameEngine: GameEngine;
    private sceneElement: HTMLElement;
    private choicesContainer: HTMLElement;
    private titleScreen: HTMLElement;
    private setupScreen: HTMLElement;
    private gameScreen: HTMLElement;

    private loadingIndicator: HTMLElement | null = null;
    private logPanel: HTMLElement | null = null;
    private logContent: HTMLElement | null = null;

    // Error Modal
    private errorModal: HTMLElement | null = null;
    private errorModalMessage: HTMLElement | null = null;
    private backToTitleButton: HTMLElement | null = null;
    private errorModalCloseButton: HTMLElement | null = null;

    // Settings elements
    private settingsToggleButton: HTMLElement | null = null;
    private settingsApiTypeSelect: HTMLSelectElement | null = null;
    private settingsApiUrlInput: HTMLInputElement | null = null;
    private settingsGeminiApiKeyInput: HTMLInputElement | null = null;
    private settingsOpenaiApiKeyInput: HTMLInputElement | null = null;
    private settingsModelSelect: HTMLSelectElement | null = null;
    private settingsVoiceSelect: HTMLSelectElement | null = null;
    private settingsModelContainer: HTMLElement | null = null;
    private settingsApiUrlContainer: HTMLElement | null = null;
    private settingsGeminiApiKeyContainer: HTMLElement | null = null;
    private settingsOpenaiApiKeyContainer: HTMLElement | null = null;
    private modelLoadingIndicator: HTMLElement | null = null;
    private voiceLoadingIndicator: HTMLElement | null = null;

    private startButton: HTMLElement | null = null;
    private loadButton: HTMLElement | null = null;
    private saveAndQuitButton: HTMLElement | null = null;
    private confirmSettingsButton: HTMLElement | null = null;

    private apiSetupInfoModal: HTMLElement | null = null;
    private apiSetupInfoButton: HTMLElement | null = null;
    private apiSetupInfoCloseButton: HTMLElement | null = null;

    // Audio Setup Info Modal
    private audioSetupInfoModal: HTMLElement | null = null;
    private audioSetupInfoButton: HTMLElement | null = null;
    private audioSetupInfoCloseButton: HTMLElement | null = null;

    // BGM Volume elements
    private bgmVolumeSlider: HTMLInputElement | null = null;
    private bgmVolumeValue: HTMLElement | null = null;

    private isProcessing: boolean = false;

    private currentSettings: GameSettings;

    constructor(
        gameEngine: GameEngine,
        initialSettings: GameSettings
    ) {
        this.gameEngine = gameEngine;
        this.currentSettings = initialSettings;

        // Load settings from localStorage if available, otherwise use initialSettings
        const savedSettings = localStorage.getItem('aiHorrorGameSettings');
        if (savedSettings) {
            try {
                const parsedSettings = JSON.parse(savedSettings);
                // Apply saved BGM volume if available
                if (parsedSettings.bgmVolume !== undefined) {
                    this.gameEngine.setBGMVolume(parsedSettings.bgmVolume);
                }
            } catch (error) {
                console.error('Failed to parse saved settings:', error);
            }
        }

        // Main UI elements
        this.sceneElement = document.querySelector('#scene-description')!;
        this.choicesContainer = document.querySelector('#choices-container')!;
        this.titleScreen = document.querySelector('#title-screen')!;
        this.setupScreen = document.querySelector('#setup-screen')!;
        this.gameScreen = document.querySelector('#game-screen')!;

        // Optional UI elements
        this.loadingIndicator = document.querySelector('#loading-indicator');
        this.logPanel = document.querySelector('#log-panel');
        this.logContent = document.querySelector('#log-content');

        // Error Modal elements
        this.errorModal = document.querySelector('#error-modal');
        this.errorModalMessage = document.querySelector('#error-modal-message');
        this.backToTitleButton = document.querySelector('#back-to-title-btn');
        this.errorModalCloseButton = document.querySelector('#error-modal-close-btn');

        this.startButton = document.querySelector('#start-game-btn');
        this.loadButton = document.querySelector('#load-game-btn');
        this.saveAndQuitButton = document.querySelector('#save-and-quit-btn');
        this.confirmSettingsButton = document.querySelector('#confirm-settings-btn');

        // Settings elements
        this.settingsToggleButton = document.querySelector('#settings-toggle-btn');
        this.settingsApiTypeSelect = document.querySelector('#api-type') as HTMLSelectElement | null;
        this.settingsApiUrlInput = document.querySelector('#api-url') as HTMLInputElement | null;
        this.settingsGeminiApiKeyInput = document.querySelector('#gemini-api-key') as HTMLInputElement | null;
        this.settingsOpenaiApiKeyInput = document.querySelector('#openai-api-key') as HTMLInputElement | null;
        this.settingsModelSelect = document.querySelector('#model-select') as HTMLSelectElement | null;
        this.settingsVoiceSelect = document.querySelector('#voice-select') as HTMLSelectElement | null;
        this.settingsModelContainer = document.querySelector('#model-container');
        this.settingsApiUrlContainer = document.querySelector('#api-url-container');
        this.settingsGeminiApiKeyContainer = document.querySelector('#gemini-api-key-container');
        this.settingsOpenaiApiKeyContainer = document.querySelector('#openai-api-key-container');
        this.modelLoadingIndicator = document.querySelector('#model-loading');
        this.voiceLoadingIndicator = document.querySelector('#voice-loading');

        this.apiSetupInfoModal = document.querySelector('#api-setup-info-modal');
        this.apiSetupInfoButton = document.querySelector('#api-setup-info-btn');
        this.apiSetupInfoCloseButton = document.querySelector('#api-setup-info-close-btn');

        // Audio Setup Info Modal elements
        this.audioSetupInfoModal = document.querySelector('#audio-setup-info-modal');
        this.audioSetupInfoButton = document.querySelector('#audio-setup-info-btn');
        this.audioSetupInfoCloseButton = document.querySelector('#audio-setup-info-close-btn');

        // BGM Volume elements
        this.bgmVolumeSlider = document.querySelector('#bgm-volume') as HTMLInputElement | null;
        this.bgmVolumeValue = document.querySelector('#bgm-volume-value');

        this.setupEventListeners();
        this.setupSpeechToggle();
    }

    private setupEventListeners(): void {
        // Log panel
        document.querySelector('#log-toggle')?.addEventListener('click', () => this.toggleLogPanel());
        document.querySelector('#log-close')?.addEventListener('click', () => this.hideLogPanel());

        // Error modal
        this.backToTitleButton?.addEventListener('click', () => {
            this.hideErrorPopup();
            this.gameScreen.style.display = 'none';
            this.titleScreen.style.display = 'block';
            this.setupScreen.style.display = 'block';
            this.resetGame();
        });
        this.errorModalCloseButton?.addEventListener('click', () => this.hideErrorPopup());
        this.errorModal?.addEventListener('click', (event) => {
            if (event.target === this.errorModal) this.hideErrorPopup();
        });

        // Settings button
        this.settingsToggleButton?.addEventListener('click', () => this.openSettings());
        this.settingsApiTypeSelect?.addEventListener('change', () => this.updateSettingsUI());

        // API key inputs - automatically update models when API key is entered
        this.settingsGeminiApiKeyInput?.addEventListener('input', () => this.loadGeminiModelsToSettings());

        // Confirm settings button
        this.confirmSettingsButton?.addEventListener('click', () => this.saveSettingsAndReturnToGame());

        // Title screen buttons
        this.startButton?.addEventListener('click', () => this.startGameFromTitle());
        this.loadButton?.addEventListener('click', () => this.loadGameFromTitle());
        this.saveAndQuitButton?.addEventListener('click', () => this.saveAndBackToTitle());

        this.apiSetupInfoButton?.addEventListener('click', () => {
            this.openApiSetupInfoModal();
        });

        this.apiSetupInfoCloseButton?.addEventListener('click', () => {
            this.closeApiSetupInfoModal();
        });

        this.apiSetupInfoModal?.addEventListener('click', (event) => {
            if (event.target === this.apiSetupInfoModal) this.closeApiSetupInfoModal();
        });


        // Audio setup info modal
        this.audioSetupInfoButton?.addEventListener('click', () => this.openAudioSetupInfoModal());
        this.audioSetupInfoCloseButton?.addEventListener('click', () => this.closeAudioSetupInfoModal());
        this.audioSetupInfoModal?.addEventListener('click', (event) => {
            if (event.target === this.audioSetupInfoModal) this.closeAudioSetupInfoModal();
        });

        // BGM volume control
        this.bgmVolumeSlider?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const volume = parseFloat(target.value);
            console.log('Volume slider changed to:', volume);
            console.log('Slider value:', target.value);
            this.updateBGMVolumeDisplay(volume);
            this.gameEngine.setBGMVolume(volume);
        });
    }

    private openSettings(): void {
        // When opening settings from game, show only confirm button
        this.gameScreen.style.display = 'none';
        this.setupScreen.style.display = 'block';
        // Hide title screen specific buttons
        const titleButtons = document.querySelector('.main-actions');
        if (titleButtons) {
            (titleButtons as HTMLElement).style.display = 'none';
        }
        // Show confirm button
        const settingButtons = document.querySelector('.setting-actions');
        if (settingButtons) {
            (settingButtons as HTMLElement).style.display = 'flex';
        }
    }

    private saveSettingsAndReturnToGame(): void {
        this.saveSettings();
    }

    private startGameFromTitle(): void {
        if (this.saveSettings()) {
            this.startGame();
        }
    }

    private loadGameFromTitle(): void {
        if (this.saveSettings()) {
            this.loadGame();
        };
    }

    private saveAndBackToTitle() {
        this.gameEngine.saveGame();
        this.resetGame();
        this.gameScreen.style.display = 'none';
        this.titleScreen.style.display = 'block';
        this.setupScreen.style.display = 'block';
        const titleButtons = document.querySelector('.main-actions');
        if (titleButtons) {
            (titleButtons as HTMLElement).style.display = 'flex';
        }
        // Show confirm button
        const settingButtons = document.querySelector('.setting-actions');
        if (settingButtons) {
            (settingButtons as HTMLElement).style.display = 'none';
        }
        // Toggle load button to show it since we just saved
        this.toggleLoadButton();
    }

    private async startGame(): Promise<void> {
        console.log('GameUI: ゲームを開始します');
        this.setProcessingState(true);
        try {
            this.resetGame();
            const result = await this.gameEngine.startGame();
            this.updateDisplay(result.choices);
        } catch (error) {
            console.error('Error starting game:', error);
            this.showErrorPopup(error instanceof Error ? error.message : 'ゲームの開始に失敗しました。設定を確認してもう一度お試しください。', 'fatal');
        } finally {
            this.setProcessingState(false);
        }
    }

    private async loadGame(): Promise<void> {
        const loadedState = this.gameEngine.loadGame();
        if (loadedState) {
            this.gameEngine.startBGM();
            // ゲームUIを更新
            this.updateDisplayFromState(loadedState);

            // ストーリーを読み上げ
            // 読み上げ機能がオンの場合のみ、ロードしたストーリーを読み上げる
            this.gameEngine.speakText(loadedState.story);
        } else {
            alert('セーブデータが見つかりませんでした。');
        }
    }

    private openApiSetupInfoModal(): void {
        if (this.apiSetupInfoModal) {
            this.apiSetupInfoModal.style.display = 'flex';
        }
    }

    private closeApiSetupInfoModal(): void {
        if (this.apiSetupInfoModal) {
            this.apiSetupInfoModal.style.display = 'none';
        }
    }

    private openAudioSetupInfoModal(): void {
        if (this.audioSetupInfoModal) {
            this.audioSetupInfoModal.style.display = 'flex';
        }
    }

    private closeAudioSetupInfoModal(): void {
        if (this.audioSetupInfoModal) {
            this.audioSetupInfoModal.style.display = 'none';
        }
    }

    private saveSettings(): boolean {
        if (!this.settingsApiTypeSelect || !this.settingsGeminiApiKeyInput || !this.settingsOpenaiApiKeyInput || !this.settingsApiUrlInput ||
            !this.settingsModelSelect || !this.settingsVoiceSelect || !this.bgmVolumeSlider) return false;

        const newSettings: GameSettings = {
            apiType: this.settingsApiTypeSelect.value,
            apiKey: this.settingsApiTypeSelect.value === 'gemini' ? this.settingsGeminiApiKeyInput.value : this.settingsOpenaiApiKeyInput.value,
            apiUrl: this.settingsApiUrlInput.value,
            model: this.settingsModelSelect.value,
            speakerId: parseInt(this.settingsVoiceSelect.value, 10)
        };

        // Update current settings
        this.currentSettings = newSettings;

        // Create a new client based on the new settings
        let newClient: LMStudioClient | GeminiClient;
        if (newSettings.apiType === 'gemini') {
            if (!newSettings.apiKey) {
                this.showErrorPopup("API-Keyが必要です。<a href=\"https://aistudio.google.com/app/apikey\" target=\"_blank\" style=\"color: #4a90e2; text-decoration: underline; cursor: pointer;\">Google AI Studio</a>でAPIキーを取得してAPI-Keyの欄に入力してください。", 'transient');
                return false;
            }
            newClient = new GeminiClient(newSettings.apiKey, newSettings.model);
        } else {
            newClient = new LMStudioClient(newSettings.apiUrl, 'default', newSettings.apiKey);
        }

        // Get BGM volume and save to localStorage
        const bgmVolume = parseFloat(this.bgmVolumeSlider.value);

        // Update the game engine with the new client and speaker
        this.gameEngine.updateClient(newClient);
        this.gameEngine.updateSpeaker(newSettings.speakerId);
        this.gameEngine.setBGMVolume(bgmVolume);

        // Save settings to localStorage
        const settingsToSave = {
            bgmVolume: bgmVolume
        };
        localStorage.setItem('aiHorrorGameSettings', JSON.stringify(settingsToSave));

        // Switch back to game screen
        this.titleScreen.style.display = 'none';
        this.setupScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';

        return true
    }

    private updateSettingsUI(): void {
        if (!this.settingsApiTypeSelect || !this.settingsApiUrlContainer || !this.settingsModelContainer ||
            !this.settingsGeminiApiKeyContainer || !this.settingsOpenaiApiKeyContainer) return;

        if (this.settingsApiTypeSelect.value === 'gemini') {
            this.settingsApiUrlContainer.style.display = 'none';
            this.settingsModelContainer.style.display = 'flex';
            this.settingsGeminiApiKeyContainer.style.display = 'flex';
            this.settingsOpenaiApiKeyContainer.style.display = 'none';
        } else {
            this.settingsApiUrlContainer.style.display = 'flex';
            this.settingsModelContainer.style.display = 'none';
            this.settingsGeminiApiKeyContainer.style.display = 'none';
            this.settingsOpenaiApiKeyContainer.style.display = 'flex';
        }
    }

    public async initializeSettings(): Promise<void> {
        // Initialize settings UI
        if (this.settingsApiTypeSelect) this.settingsApiTypeSelect.value = this.currentSettings.apiType;
        if (this.settingsApiUrlInput) this.settingsApiUrlInput.value = this.currentSettings.apiUrl;
        if (this.settingsGeminiApiKeyInput) this.settingsGeminiApiKeyInput.value = this.currentSettings.apiType === 'gemini' ? this.currentSettings.apiKey : '';
        if (this.settingsOpenaiApiKeyInput) this.settingsOpenaiApiKeyInput.value = this.currentSettings.apiType === 'openai' ? this.currentSettings.apiKey : '';

        // Toggle load button visibility based on saved game data
        this.toggleLoadButton();

        // Update UI immediately to show/hide relevant fields
        this.updateSettingsUI();

        // Get BGM volume from saved settings or fallback to current volume
        const bgmVolume = this.gameEngine.getBGMVolume();

        // Set BGM volume
        if (this.bgmVolumeSlider) {
            this.bgmVolumeSlider.value = bgmVolume.toString();
            this.updateBGMVolumeDisplay(bgmVolume);
        }

        // Only load Gemini models if using Gemini API and API key is provided
        if (this.currentSettings.apiType === 'gemini' && this.currentSettings.apiKey) {
            await this.loadGeminiModelsToSettings();
            if (this.settingsModelSelect) {
                this.settingsModelSelect.value = this.currentSettings.model;
            }
        }

        // Load dynamic options
        await this.loadSpeakersToSettings();

        if (this.settingsVoiceSelect) {
            this.settingsVoiceSelect.value = this.currentSettings.speakerId.toString();
        }
    }

    private async loadSpeakersToSettings(): Promise<void> {
        if (!this.settingsVoiceSelect) return;

        // Show loading indicator
        if (this.voiceLoadingIndicator) {
            this.voiceLoadingIndicator.style.display = 'flex';
        }

        try {
            const voiceClient = new VoicevoxClient();
            const isAvailable = await voiceClient.isServerAvailable();
            if (!isAvailable) {
                // Hide loading indicator
                if (this.voiceLoadingIndicator) {
                    this.voiceLoadingIndicator.style.display = 'none';
                }
                return;
            }

            const speakers = await voiceClient.getAvailableSpeakers();
            this.settingsVoiceSelect.innerHTML = ''; // Clear existing options
            speakers.forEach((speaker) => {
                const option = document.createElement('option');
                option.value = speaker.id.toString();
                option.textContent = speaker.name;
                this.settingsVoiceSelect!.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading speakers for settings:', error);
        } finally {
            // Hide loading indicator
            if (this.voiceLoadingIndicator) {
                this.voiceLoadingIndicator.style.display = 'none';
            }
        }
    }

    private async loadGeminiModelsToSettings(): Promise<void> {
        if (!this.settingsGeminiApiKeyInput || !this.settingsModelSelect) return;

        // Show loading indicator
        if (this.modelLoadingIndicator) {
            this.modelLoadingIndicator.style.display = 'flex';
        }

        try {
            const apiKey = this.settingsGeminiApiKeyInput.value;
            if (!apiKey) {
                // Hide loading indicator
                if (this.modelLoadingIndicator) {
                    this.modelLoadingIndicator.style.display = 'none';
                }
                return;
            }

            const tempClient = new GeminiClient(apiKey);
            const models = await tempClient.getAvailableModels();

            this.settingsModelSelect.innerHTML = ''; // Clear existing options
            let hasDefaultModel = false;

            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;

                // Set gemini-2.5-pro as default if it exists
                if (model === 'gemini-2.5-pro') {
                    option.selected = true;
                    hasDefaultModel = true;
                }

                this.settingsModelSelect!.appendChild(option);
            });

            // If gemini-2.5-pro doesn't exist but we have models, select the first one
            if (!hasDefaultModel && models.length > 0) {
                const firstOption = this.settingsModelSelect!.firstChild as HTMLOptionElement;
                if (firstOption) {
                    firstOption.selected = true;
                }
            }
        } catch (error) {
            console.error('Error loading Gemini models for settings:', error);
        } finally {
            // Hide loading indicator
            if (this.modelLoadingIndicator) {
                this.modelLoadingIndicator.style.display = 'none';
            }
        }
    }

    private setupSpeechToggle(): void {
        const speechToggle = document.querySelector('#speech-toggle');
        if (speechToggle) {
            this.updateSpeechSwitchState(speechToggle);
            speechToggle.addEventListener('click', () => {
                this.gameEngine.toggleIsSpeechEnabled();
                this.updateSpeechSwitchState(speechToggle);
                console.log(`読み上げ機能が${this.gameEngine.getIsSpeechEnabled() ? '有効' : '無効'}になりました`);
            });
        }
    }

    private updateSpeechSwitchState(switchElement: Element): void {
        if (this.gameEngine.getIsSpeechEnabled()) {
            switchElement.classList.add('on');
        } else {
            switchElement.classList.remove('on');
        }
    }

    private toggleLogPanel(): void {
        if (this.logPanel) {
            const isVisible = this.logPanel.style.display === 'flex';
            if (isVisible) this.hideLogPanel();
            else this.showLogPanel();
        }
    }

    private showLogPanel(): void {
        if (this.logPanel && this.logContent) {
            this.updateLogContent();
            this.logPanel.style.display = 'flex';
        }
    }

    private hideLogPanel(): void {
        if (this.logPanel) {
            this.logPanel.style.display = 'none';
        }
    }

    private updateLogContent(): void {
        if (this.logContent) {
            const gameState = this.gameEngine.getGameState();
            this.logContent.innerHTML = '';
            gameState.history.forEach((entry, index) => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                if (index % 2 === 0) {
                    logEntry.classList.add('choice');
                    logEntry.textContent = entry;
                } else {
                    logEntry.classList.add('scene');
                    logEntry.textContent = `▶ ${entry}`;
                }
                this.logContent!.appendChild(logEntry);
            });
            this.logContent.scrollTop = this.logContent.scrollHeight;
        }
    }

    async initializeGame(): Promise<void> {
        console.log('GameUI: ゲームを初期化します');
        this.setProcessingState(true);
        try {
            const result = await this.gameEngine.startGame();
            this.updateDisplay(result.choices);
        } catch (error) {
            console.error('Error initializing game:', error);
            this.showErrorPopup(error instanceof Error ? error.message : 'ゲームの初期化に失敗しました。設定を確認してもう一度お試しください。', 'fatal');
        } finally {
            this.setProcessingState(false);
        }
    }

    private updateDisplay(choices: Choice[]): void {
        const gameState = this.gameEngine.getGameState();
        if (gameState.gameStatus === 'gameover' || gameState.gameStatus === 'gameclear') {
            const description = gameState.gameResultDescription || '';
            this.sceneElement.innerHTML = `<p>${gameState.story}</p><p><strong>${description}</strong></p>`;
            // ゲームオーバーまたはゲームクリア時の演出用クラスを追加
            this.gameScreen.classList.add(gameState.gameStatus);
        } else {
            this.sceneElement.textContent = gameState.story;
            // 通常時のクラスを適用
            this.gameScreen.classList.remove('gameover', 'gameclear');
        }
        this.displayChoices(choices);
    }

    public updateDisplayFromState(gameState: GameState): void {
        if (gameState.gameStatus === 'gameover' || gameState.gameStatus === 'gameclear') {
            const description = gameState.gameResultDescription || '';
            this.sceneElement.innerHTML = `<p>${gameState.story}</p><p><strong>${description}</strong></p>`;
        } else {
            this.sceneElement.textContent = gameState.story;
        }

        // 選択肢を表示
        this.displayChoicesFromState(gameState);
    }

    private displayChoices(choices: Choice[]): void {
        this.choicesContainer.innerHTML = '';
        choices.forEach((choice, index) => {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-button';
            choiceButton.dataset.choiceId = choice.id;
            choiceButton.innerHTML = `<div class="choice-title">${choice.text}</div><div class="choice-description">${choice.description}</div>`;
            choiceButton.addEventListener('click', () => this.handleChoiceClick(choice.id));
            setTimeout(() => {
                choiceButton.style.animationDelay = `${index * 0.1}s`;
                choiceButton.classList.add('animate-in');
            }, 10);
            this.choicesContainer.appendChild(choiceButton);
        });
    }

    private displayChoicesFromState(gameState: GameState): void {
        this.choicesContainer.innerHTML = '';

        // ゲームが終了している場合は再開の選択肢を表示
        if (gameState.gameStatus === 'gameover' || gameState.gameStatus === 'gameclear') {
            const restartChoice = { id: 'restart', text: '最初からやり直す', description: 'ゲームを最初からやり直します' };
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-button';
            choiceButton.dataset.choiceId = restartChoice.id;
            choiceButton.innerHTML = `<div class="choice-title">${restartChoice.text}</div><div class="choice-description">${restartChoice.description}</div>`;
            choiceButton.addEventListener('click', () => this.handleChoiceClick(restartChoice.id));
            this.choicesContainer.appendChild(choiceButton);
            return;
        }

        // gameStateから選択肢を取得
        const choices = gameState.choices || [];
        choices.forEach((choice, index) => {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-button';
            choiceButton.dataset.choiceId = choice.id;
            choiceButton.innerHTML = `<div class="choice-title">${choice.text}</div><div class="choice-description">${choice.description}</div>`;
            choiceButton.addEventListener('click', () => this.handleChoiceClick(choice.id));
            setTimeout(() => {
                choiceButton.style.animationDelay = `${index * 0.1}s`;
                choiceButton.classList.add('animate-in');
            }, 10);
            this.choicesContainer.appendChild(choiceButton);
        });
    }

    private async handleChoiceClick(choiceId: string): Promise<void> {
        if (this.isProcessing) return;
        this.setProcessingState(true);
        try {
            const result = await this.gameEngine.makeChoice(choiceId);
            if (result.error) {
                this.showErrorPopup(result.error, 'transient');
            } else {
                // If this is a restart, we need to clear the UI before updating
                if (choiceId === 'restart') {
                    this.sceneElement.textContent = '';
                    this.choicesContainer.innerHTML = '';
                }
                await this.animateSceneUpdate(result.updatedScene);
                this.updateDisplay(result.newChoices);
            }
        } catch (error) {
            console.error('Error processing choice:', error);
            this.showErrorPopup(error instanceof Error ? error.message : '選択肢の処理に失敗しました', 'transient');
        } finally {
            this.setProcessingState(false);
        }
    }

    private async animateSceneUpdate(newScene: string): Promise<void> {
        return new Promise((resolve) => {
            this.sceneElement.style.transition = 'opacity 0.3s ease-out';
            this.sceneElement.style.opacity = '0';
            setTimeout(() => {
                this.sceneElement.textContent = newScene;
                this.sceneElement.style.transition = 'opacity 0.5s ease-in';
                this.sceneElement.style.opacity = '1';
                setTimeout(resolve, 500);
            }, 300);
        });
    }

    private setProcessingState(isProcessing: boolean): void {
        this.isProcessing = isProcessing;
        const choiceButtons = this.choicesContainer.querySelectorAll('.choice-button');
        choiceButtons.forEach(button => {
            (button as HTMLButtonElement).disabled = isProcessing;
        });
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = isProcessing ? 'flex' : 'none';
        }
    }

    private showErrorPopup(message: string, type: 'fatal' | 'transient' = 'transient'): void {
        if (this.errorModal && this.errorModalMessage && this.backToTitleButton && this.errorModalCloseButton) {
            this.errorModalMessage.innerHTML = message;

            if (type === 'fatal') {
                this.backToTitleButton.style.display = 'inline-block';
                this.errorModalCloseButton.style.display = 'none';
            } else {
                this.backToTitleButton.style.display = 'none';
                this.errorModalCloseButton.style.display = 'inline-block';
            }

            this.errorModal.style.display = 'flex';
        }
    }

    private hideErrorPopup(): void {
        if (this.errorModal) {
            this.errorModal.style.display = 'none';
        }
    }

    private updateBGMVolumeDisplay(volume: number): void {
        if (this.bgmVolumeValue) {
            this.bgmVolumeValue.textContent = Math.round(volume * 100).toString();
        }
    }

    public resetGame(): void {
        this.gameEngine.resetGame();
        this.sceneElement.textContent = '';
        this.choicesContainer.innerHTML = '';
    }

    public getGameState(): GameState {
        return this.gameEngine.getGameState();
    }

    private toggleLoadButton(): void {
        if (this.loadButton) {
            // Check if save data exists in localStorage
            const savedGameState = localStorage.getItem('aiHorrorGameState');
            if (savedGameState) {
                this.loadButton.style.display = 'block';
            } else {
                this.loadButton.style.display = 'none';
            }
        }
    }
}