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
    private settingsApiKeyInput: HTMLInputElement | null = null;
    private settingsModelSelect: HTMLSelectElement | null = null;
    private settingsVoiceSelect: HTMLSelectElement | null = null;
    private settingsModelContainer: HTMLElement | null = null;
    private settingsApiUrlContainer: HTMLElement | null = null;

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
        this.settingsApiTypeSelect = document.querySelector('#settings-api-type');
        this.settingsApiUrlInput = document.querySelector('#settings-api-url');
        this.settingsApiKeyInput = document.querySelector('#settings-api-key');
        this.settingsModelSelect = document.querySelector('#settings-model-select');
        this.settingsVoiceSelect = document.querySelector('#settings-voice-select');
        this.settingsModelContainer = document.querySelector('#settings-model-container');
        this.settingsApiUrlContainer = document.querySelector('#settings-api-url-container');

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
        this.settingsApiTypeSelect!.value = this.currentSettings.apiType;
        this.settingsApiUrlInput!.value = this.currentSettings.apiUrl;
        this.settingsApiKeyInput!.value = this.currentSettings.apiKey;

        // Load dynamic options
        await this.loadSpeakersToSettings();
        this.settingsVoiceSelect!.value = this.currentSettings.speakerId.toString();

        await this.loadGeminiModelsToSettings();
        this.settingsModelSelect!.value = this.currentSettings.model;

        this.updateSettingsUI();
        this.settingsModal.style.display = 'flex';
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
        const newSettings: GameSettings = {
            apiType: this.settingsApiTypeSelect!.value,
            apiKey: this.settingsApiKeyInput!.value,
            apiUrl: this.settingsApiUrlInput!.value,
            model: this.settingsModelSelect!.value,
            speakerId: parseInt(this.settingsVoiceSelect!.value, 10)
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

        this.closeSettingsModal();
    }

    private updateSettingsUI(): void {
        if (this.settingsApiTypeSelect?.value === 'gemini') {
            this.settingsApiUrlContainer!.style.display = 'none';
            this.settingsModelContainer!.style.display = 'block';
        } else {
            this.settingsApiUrlContainer!.style.display = 'block';
            this.settingsModelContainer!.style.display = 'none';
        }
    }

    private async loadSpeakersToSettings(): Promise<void> {
        try {
            const voiceClient = new VoicevoxClient();
            const isAvailable = await voiceClient.isServerAvailable();
            if (!isAvailable) return;

            const speakers = await voiceClient.getAvailableSpeakers();
            this.settingsVoiceSelect!.innerHTML = ''; // Clear existing options
            speakers.forEach((speaker) => {
                const option = document.createElement('option');
                option.value = speaker.id.toString();
                option.textContent = speaker.name;
                this.settingsVoiceSelect!.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading speakers for settings:', error);
        }
    }

    private async loadGeminiModelsToSettings(): Promise<void> {
        try {
            const apiKey = this.settingsApiKeyInput!.value;
            if (!apiKey) return;

            const tempClient = new GeminiClient(apiKey);
            const models = await tempClient.getAvailableModels();

            this.settingsModelSelect!.innerHTML = ''; // Clear existing options
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                this.settingsModelSelect!.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading Gemini models for settings:', error);
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
            console.log(sceneDescription);
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

    private async handleChoiceClick(choiceId: string): Promise<void> {
        if (this.isProcessing) return;
        this.setProcessingState(true);
        try {
            const result = await this.gameEngine.makeChoice(choiceId);
            if (result.error) {
                this.showErrorPopup(result.error, 'transient');
            } else {
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