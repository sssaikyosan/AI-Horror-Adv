import { GameEngine, type Choice, type GameState } from './game-engine';

export class GameUI {
    private gameEngine: GameEngine;
    private sceneElement: HTMLElement;
    private choicesContainer: HTMLElement;
    
    private loadingIndicator: HTMLElement | null = null;
    private errorMessage: HTMLElement | null = null;
    private logPanel: HTMLElement | null = null;
    private logContent: HTMLElement | null = null;
    
    private isProcessing: boolean = false;

    constructor(
        gameEngine: GameEngine,
        sceneSelector: string = '#scene-description',
        choicesSelector: string = '#choices-container',
        loadingSelector: string = '#loading-indicator',
        errorSelector: string = '#error-message'
    ) {
        this.gameEngine = gameEngine;

        const scene = document.querySelector(sceneSelector);
        if (!scene) throw new Error(`Scene element not found: ${sceneSelector}`);
        this.sceneElement = scene as HTMLElement;

        const choices = document.querySelector(choicesSelector);
        if (!choices) throw new Error(`Choices container not found: ${choicesSelector}`);
        this.choicesContainer = choices as HTMLElement;

        const loading = document.querySelector(loadingSelector);
        if (loading) this.loadingIndicator = loading as HTMLElement;

        const error = document.querySelector(errorSelector);
        if (error) this.errorMessage = error as HTMLElement;

        // Initialize log panel elements
        this.logPanel = document.querySelector('#log-panel');
        this.logContent = document.querySelector('#log-content');

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Setup log toggle button
        const logToggleBtn = document.querySelector('#log-toggle');
        if (logToggleBtn) {
            logToggleBtn.addEventListener('click', () => this.toggleLogPanel());
        }

        // Setup log close button
        const logCloseBtn = document.querySelector('#log-close');
        if (logCloseBtn) {
            logCloseBtn.addEventListener('click', () => this.hideLogPanel());
        }
    }

    private toggleLogPanel(): void {
        if (this.logPanel) {
            const isVisible = this.logPanel.style.display === 'flex';
            if (isVisible) {
                this.hideLogPanel();
            } else {
                this.showLogPanel();
            }
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
            const history = [...gameState.history]; // Create a copy of the history array
            
            // Clear existing content
            this.logContent.innerHTML = '';
            
            // Add each history entry to the log
            history.forEach((entry, index) => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                
                // Determine if this is a scene description or a choice
                if (index % 2 === 0) {
                    // Even indices are choices (0, 2, 4, ...)
                    logEntry.classList.add('choice');
                    logEntry.textContent = entry;
                } else {
                    // Odd indices are scene descriptions (1, 3, 5, ...)
                    logEntry.classList.add('scene');
                    logEntry.textContent = `▶ ${entry}`;
                }
                
                this.logContent!.appendChild(logEntry);
            });
            
            // Scroll to the bottom of the log
            this.logContent.scrollTop = this.logContent.scrollHeight;
        }
    }

    async initializeGame(): Promise<void> {
        this.setProcessingState(true);
        try {
            const { choices } = await this.gameEngine.startGame();
            this.updateDisplay(choices);
        } catch (error) {
            console.error('Error initializing game:', error);
            this.showError(error instanceof Error ? error.message : 'Failed to initialize game');
        } finally {
            this.setProcessingState(false);
        }
    }

    private updateDisplay(choices: Choice[]): void {
        const gameState = this.gameEngine.getGameState();

        this.sceneElement.textContent = gameState.sceneDescription;

        this.displayChoices(choices);
    }

    private displayChoices(choices: Choice[]): void {
        this.choicesContainer.innerHTML = '';

        choices.forEach((choice, index) => {
            const choiceButton = document.createElement('button');
            choiceButton.className = 'choice-button';
            choiceButton.dataset.choiceId = choice.id;

            choiceButton.innerHTML = `
        <div class="choice-title">${choice.text}</div>
        <div class="choice-description">${choice.description}</div>
      `;

            choiceButton.addEventListener('click', () => this.handleChoiceClick(choice.id));

            // アニメーションのための遅延追加
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

            await this.animateSceneUpdate(result.updatedScene);

            this.updateDisplay(result.newChoices);

        } catch (error) {
            console.error('Error processing choice:', error);
            this.showError(error instanceof Error ? error.message : '選択肢の処理に失敗しました');
        } finally {
            this.setProcessingState(false);
        }
    }

    private async animateSceneUpdate(newScene: string): Promise<void> {
        return new Promise((resolve) => {
            // フェードアウト
            this.sceneElement.style.transition = 'opacity 0.3s ease-out';
            this.sceneElement.style.opacity = '0';

            setTimeout(() => {
                // テキスト更新
                this.sceneElement.textContent = newScene;

                // フェードイン
                this.sceneElement.style.transition = 'opacity 0.5s ease-in';
                this.sceneElement.style.opacity = '1';

                // 少し待ってから解決
                setTimeout(resolve, 500);
            }, 300);
        });
    }

    private setProcessingState(isProcessing: boolean): void {
        this.isProcessing = isProcessing;

        // 選択肢ボタンの有効/無効化
        const choiceButtons = this.choicesContainer.querySelectorAll('.choice-button');
        choiceButtons.forEach(button => {
            (button as HTMLButtonElement).disabled = isProcessing;
        });

        // ローディングインジケータの表示/非表示
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = isProcessing ? 'flex' : 'none';
        }
    }

    private showError(message: string): void {
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
            this.errorMessage.style.display = 'block';

            setTimeout(() => {
                if (this.errorMessage) {
                    this.errorMessage.style.display = 'none';
                }
            }, 5000);
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