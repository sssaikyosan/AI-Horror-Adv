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
    temperature: number;
}

export class GameUI {
    private gameEngine: GameEngine;
    private sceneElement: HTMLElement;
    private choicesContainer: HTMLElement;
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

    // Settings Modal
    private settingsModal: HTMLElement | null = null;
    private settingsToggleButton: HTMLElement | null = null;
    private settingsSaveButton: HTMLElement | null = null;
    private settingsCancelButton: HTMLElement | null = null;
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
    private settingsTemperatureInput: HTMLInputElement | null = null;
    private modelLoadingIndicator: HTMLElement | null = null;
    private voiceLoadingIndicator: HTMLElement | null = null;

    // Audio Setup Info Modal
    private audioSetupInfoModal: HTMLElement | null = null;
    private audioSetupInfoButton: HTMLElement | null = null;
    private audioSetupInfoCloseButton: HTMLElement | null = null;

    private isProcessing: boolean = false;
    private isSpeechEnabled: boolean = true;

    private currentSettings: GameSettings;

    constructor(
        gameEngine: GameEngine,
        initialSettings: GameSettings
    ) {
        this.gameEngine = gameEngine;
        this.currentSettings = initialSettings;

        // Main UI elements
        this.sceneElement = document.querySelector('#scene-description')!;
        this.choicesContainer = document.querySelector('#choices-container')!;
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

        // Settings elements
        this.settingsToggleButton = document.querySelector('#settings-toggle-btn');
        this.settingsModal = document.querySelector('#settings-modal');
        this.settingsSaveButton = document.querySelector('#settings-save-btn');
        this.settingsCancelButton = document.querySelector('#settings-cancel-btn');
        this.settingsApiTypeSelect = document.querySelector('#settings-api-type') as HTMLSelectElement | null;
        this.settingsApiUrlInput = document.querySelector('#settings-api-url') as HTMLInputElement | null;
        this.settingsGeminiApiKeyInput = document.querySelector('#settings-gemini-api-key') as HTMLInputElement | null;
        this.settingsOpenaiApiKeyInput = document.querySelector('#settings-openai-api-key') as HTMLInputElement | null;
        this.settingsModelSelect = document.querySelector('#settings-model-select') as HTMLSelectElement | null;
        this.settingsVoiceSelect = document.querySelector('#settings-voice-select') as HTMLSelectElement | null;
        this.settingsModelContainer = document.querySelector('#settings-model-container');
        this.settingsApiUrlContainer = document.querySelector('#settings-api-url-container');
        this.settingsGeminiApiKeyContainer = document.querySelector('#settings-gemini-api-key-container');
        this.settingsOpenaiApiKeyContainer = document.querySelector('#settings-openai-api-key-container');
        this.settingsTemperatureInput = document.querySelector('#settings-temperature') as HTMLInputElement | null;
        this.modelLoadingIndicator = document.querySelector('#model-loading');
        this.voiceLoadingIndicator = document.querySelector('#voice-loading');

        // Audio Setup Info Modal elements
        this.audioSetupInfoModal = document.querySelector('#audio-setup-info-modal');
        this.audioSetupInfoButton = document.querySelector('#audio-setup-info-btn');
        this.audioSetupInfoCloseButton = document.querySelector('#audio-setup-info-close-btn');

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
            this.setupScreen.style.display = 'flex';
            this.resetGame();
        });
        this.errorModalCloseButton?.addEventListener('click', () => this.hideErrorPopup());
        this.errorModal?.addEventListener('click', (event) => {
            if (event.target === this.errorModal) this.hideErrorPopup();
        });

        // Settings modal
        this.settingsToggleButton?.addEventListener('click', () => this.openSettingsModal());
        this.settingsCancelButton?.addEventListener('click', () => this.closeSettingsModal());
        this.settingsSaveButton?.addEventListener('click', () => this.saveSettings());
        this.settingsApiTypeSelect?.addEventListener('change', () => this.updateSettingsUI());

        // Audio setup info modal
        this.audioSetupInfoButton?.addEventListener('click', () => this.openAudioSetupInfoModal());
        this.audioSetupInfoCloseButton?.addEventListener('click', () => this.closeAudioSetupInfoModal());
        this.audioSetupInfoModal?.addEventListener('click', (event) => {
            if (event.target === this.audioSetupInfoModal) this.closeAudioSetupInfoModal();
        });
    }

    private async openSettingsModal(): Promise<void> {
        if (!this.settingsModal) return;

        // Load current settings into the modal
        if (this.settingsApiTypeSelect) this.settingsApiTypeSelect.value = this.currentSettings.apiType;
        if (this.settingsApiUrlInput) this.settingsApiUrlInput.value = this.currentSettings.apiUrl;
        if (this.settingsGeminiApiKeyInput) this.settingsGeminiApiKeyInput.value = this.currentSettings.apiType === 'gemini' ? this.currentSettings.apiKey : '';
        if (this.settingsOpenaiApiKeyInput) this.settingsOpenaiApiKeyInput.value = this.currentSettings.apiType === 'openai' ? this.currentSettings.apiKey : '';
        if (this.settingsTemperatureInput) this.settingsTemperatureInput.value = this.currentSettings.temperature.toString();

        // Show the modal immediately
        this.settingsModal.style.display = 'flex';

        // Update UI immediately to show/hide relevant fields
        this.updateSettingsUI();

        // Load dynamic options in the background
        this.loadSpeakersToSettings().then(() => {
            if (this.settingsVoiceSelect) {
                this.settingsVoiceSelect.value = this.currentSettings.speakerId.toString();
            }
        });

        // Only load Gemini models if using Gemini API and API key is provided
        if (this.currentSettings.apiType === 'gemini' && this.currentSettings.apiKey) {
            this.loadGeminiModelsToSettings().then(() => {
                if (this.settingsModelSelect) {
                    this.settingsModelSelect.value = this.currentSettings.model;
                }
            });
        }
    }

    private closeSettingsModal(): void {
        if (this.settingsModal) {
            this.settingsModal.style.display = 'none';
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

    private saveSettings(): void {
        if (!this.settingsApiTypeSelect || !this.settingsGeminiApiKeyInput || !this.settingsOpenaiApiKeyInput || !this.settingsApiUrlInput ||
            !this.settingsModelSelect || !this.settingsVoiceSelect || !this.settingsTemperatureInput) return;

        const newSettings: GameSettings = {
            apiType: this.settingsApiTypeSelect.value,
            apiKey: this.settingsApiTypeSelect.value === 'gemini' ? this.settingsGeminiApiKeyInput.value : this.settingsOpenaiApiKeyInput.value,
            apiUrl: this.settingsApiUrlInput.value,
            model: this.settingsModelSelect.value,
            speakerId: parseInt(this.settingsVoiceSelect.value, 10),
            temperature: parseFloat(this.settingsTemperatureInput.value)
        };

        // Update current settings
        this.currentSettings = newSettings;

        // Create a new client based on the new settings
        let newClient: LMStudioClient | GeminiClient;
        if (newSettings.apiType === 'gemini') {
            if (!newSettings.apiKey) {
                this.showErrorPopup("Gemini APIキーが必要です。", 'transient');
                return;
            }
            newClient = new GeminiClient(newSettings.apiKey, newSettings.model);
        } else {
            newClient = new LMStudioClient(newSettings.apiUrl, 'default', newSettings.apiKey);
        }

        // Update the game engine with the new client and speaker
        this.gameEngine.updateClient(newClient);
        this.gameEngine.updateSpeaker(newSettings.speakerId);
        this.gameEngine.updateTemperature(newSettings.temperature);

        this.closeSettingsModal();
    }

    private updateSettingsUI(): void {
        if (!this.settingsApiTypeSelect || !this.settingsApiUrlContainer || !this.settingsModelContainer ||
            !this.settingsGeminiApiKeyContainer || !this.settingsOpenaiApiKeyContainer) return;

        if (this.settingsApiTypeSelect.value === 'gemini') {
            this.settingsApiUrlContainer.style.display = 'none';
            this.settingsModelContainer.style.display = 'block';
            this.settingsGeminiApiKeyContainer.style.display = 'block';
            this.settingsOpenaiApiKeyContainer.style.display = 'none';
        } else {
            this.settingsApiUrlContainer.style.display = 'block';
            this.settingsModelContainer.style.display = 'none';
            this.settingsGeminiApiKeyContainer.style.display = 'none';
            this.settingsOpenaiApiKeyContainer.style.display = 'block';
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
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                this.settingsModelSelect!.appendChild(option);
            });
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
                this.isSpeechEnabled = !this.isSpeechEnabled;
                this.updateSpeechSwitchState(speechToggle);
                console.log(`読み上げ機能が${this.isSpeechEnabled ? '有効' : '無効'}になりました`);
            });
        }
    }

    private updateSpeechSwitchState(switchElement: Element): void {
        if (this.isSpeechEnabled) {
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
            const { sceneDescription, choices } = await this.gameEngine.startGame();
            this.updateDisplay(choices);
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
            this.sceneElement.innerHTML = `<p>${gameState.sceneDescription}</p><p><strong>${description}</strong></p>`;
        } else {
            this.sceneElement.textContent = gameState.sceneDescription;
        }
        this.displayChoices(choices);
    }

    public updateDisplayFromState(gameState: GameState): void {
        if (gameState.gameStatus === 'gameover' || gameState.gameStatus === 'gameclear') {
            const description = gameState.gameResultDescription || '';
            this.sceneElement.innerHTML = `<p>${gameState.sceneDescription}</p><p><strong>${description}</strong></p>`;
        } else {
            this.sceneElement.textContent = gameState.sceneDescription;
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
            this.errorModalMessage.textContent = message;

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

    public resetGame(): void {
        this.gameEngine.resetGame();
        this.sceneElement.textContent = '';
        this.choicesContainer.innerHTML = '';
    }

    public getGameState(): GameState {
        return this.gameEngine.getGameState();
    }
}