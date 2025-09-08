import './style.css'
import { LMStudioClient } from './lmstudio-client'
import { GeminiClient } from './gemini-client'
import { GameEngine } from './game-engine'
import { GameUI } from './game-ui'
import { VoicevoxClient } from './voicevox-client'

const setupScreen = document.getElementById('setup-screen') as HTMLElement;
const gameScreen = document.getElementById('game-screen') as HTMLElement;
const startButton = document.getElementById('start-game-btn') as HTMLButtonElement;
const loadButton = document.getElementById('load-game-btn') as HTMLButtonElement;
const saveAndQuitButton = document.getElementById('save-and-quit-btn') as HTMLButtonElement;
const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
const geminiApiKeyInput = document.getElementById('gemini-api-key') as HTMLInputElement;
const openaiApiKeyInput = document.getElementById('openai-api-key') as HTMLInputElement;
const temperatureInput = document.getElementById('temperature') as HTMLInputElement;
const apiTypeSelect = document.getElementById('api-type') as HTMLSelectElement;
const modelContainer = document.getElementById('model-container') as HTMLElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const apiUrlContainer = document.getElementById('api-url-container') as HTMLElement;
const geminiApiKeyContainer = document.getElementById('gemini-api-key-container') as HTMLElement;
const openaiApiKeyContainer = document.getElementById('openai-api-key-container') as HTMLElement;
const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;

let gameEngine: GameEngine;
let gameUI: GameUI;

// Set initial state based on default selection
updateUIForAPIType('gemini');
loadGeminiModels();
loadSpeakers();
toggleLoadButton(); // ロードボタンの表示/非表示を切り替える

apiTypeSelect.addEventListener('change', () => {
  updateUIForAPIType(apiTypeSelect.value);
});

// Audio setup info button in setup screen
const audioSetupInfoButton = document.getElementById('audio-setup-info-btn');
const audioSetupInfoModal = document.getElementById('audio-setup-info-modal');
const audioSetupInfoCloseButton = document.getElementById('audio-setup-info-close-btn');

if (audioSetupInfoButton && audioSetupInfoModal && audioSetupInfoCloseButton) {
  audioSetupInfoButton.addEventListener('click', () => {
    audioSetupInfoModal.style.display = 'flex';
  });

  audioSetupInfoCloseButton.addEventListener('click', () => {
    audioSetupInfoModal.style.display = 'none';
  });

  audioSetupInfoModal.addEventListener('click', (event) => {
    if (event.target === audioSetupInfoModal) {
      audioSetupInfoModal.style.display = 'none';
    }
  });
}

// API setup info button in setup screen
const apiSetupInfoButton = document.getElementById('api-setup-info-btn');
const apiSetupInfoModal = document.getElementById('api-setup-info-modal');
const apiSetupInfoCloseButton = document.getElementById('api-setup-info-close-btn');

if (apiSetupInfoButton && apiSetupInfoModal && apiSetupInfoCloseButton) {
  apiSetupInfoButton.addEventListener('click', () => {
    apiSetupInfoModal.style.display = 'flex';
  });

  apiSetupInfoCloseButton.addEventListener('click', () => {
    apiSetupInfoModal.style.display = 'none';
  });

  apiSetupInfoModal.addEventListener('click', (event) => {
    if (event.target === apiSetupInfoModal) {
      apiSetupInfoModal.style.display = 'none';
    }
  });
}

// Reload models when API key changes
let debounceTimer: number | null = null;
geminiApiKeyInput.addEventListener('input', () => {
  // Debounce the API call to avoid too many requests
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(() => {
    if (apiTypeSelect.value === 'gemini') {
      loadGeminiModels();
    }
    debounceTimer = null;
  }, 500);
});

modelSelect.addEventListener('change', () => {
  // This will be used when we implement dynamic model selection
  console.log('Selected model:', modelSelect.value);
});

voiceSelect.addEventListener('change', () => {
  console.log('Selected speaker:', voiceSelect.value);
});

async function loadGeminiModels() {
  try {
    // Get API key from input field
    const apiKey = geminiApiKeyInput.value;

    // Create a client with the API key (or empty string if not provided)
    const tempClient = new GeminiClient(apiKey);
    const models = await tempClient.getAvailableModels();

    // Clear existing options
    modelSelect.innerHTML = '';

    // Add models to the dropdown
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;

      // Set gemini-2.5-pro as default if it exists
      if (model === 'gemini-2.5-pro') {
        option.textContent += ' (Default)';
        option.selected = true;
      }

      modelSelect.appendChild(option);
    });

    // If gemini-2.0-flash is not in the list, set the first model as default
    if (!models.includes('gemini-2.0-flash') && models.length > 0) {
      const firstOption = modelSelect.firstChild as HTMLOptionElement;
      if (firstOption) {
        firstOption.textContent += ' (Default)';
        firstOption.selected = true;
      }
    }
  } catch (error) {
    console.error('Error loading Gemini models:', error);
    // Keep the default options if loading fails
  }
}

async function loadSpeakers() {
  try {
    console.log('Loading speakers from Voicevox');
    // Create a Voicevox client with default settings
    const voiceClient = new VoicevoxClient();

    // Check if Voicevox server is available
    const isAvailable = await voiceClient.isServerAvailable();
    console.log('Voicevox server availability:', isAvailable);
    if (!isAvailable) {
      console.warn('Voicevox server is not available');
      return;
    }

    // Get available speakers
    const speakers = await voiceClient.getAvailableSpeakers();
    console.log('Available speakers:', speakers);

    // Clear existing options
    voiceSelect.innerHTML = '';

    // Add speakers to the dropdown
    speakers.forEach((speaker, index) => {
      const option = document.createElement('option');
      option.value = speaker.id.toString();
      option.textContent = speaker.name;
      // Select speaker ID 3 as default if it exists, otherwise select the first speaker
      if (speaker.id === 3) {
        option.selected = true;
      } else if (index === 0 && !speakers.some(s => s.id === 3)) {
        option.selected = true;
      }
      voiceSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading speakers:', error);
    console.error('Error loading speakers details:', {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack
    });
  }
}

function updateUIForAPIType(apiType: string) {
  if (apiType === 'gemini') {
    // Hide URL input for Gemini as it uses a fixed URL
    apiUrlContainer.style.display = 'none';
    geminiApiKeyContainer.style.display = 'block';
    openaiApiKeyContainer.style.display = 'none';
    modelContainer.style.display = 'block';
    // Focus on the API key field since it's required
    geminiApiKeyInput.focus();

    // Load models for Gemini
    loadGeminiModels();
  } else {
    // Show URL input for other APIs
    apiUrlContainer.style.display = 'block';
    geminiApiKeyContainer.style.display = 'none';
    openaiApiKeyContainer.style.display = 'block';
    modelContainer.style.display = 'none';
  }
}

function toggleLoadButton() {
  if (localStorage.getItem('aiHorrorGameState')) {
    loadButton.style.display = 'block';
  } else {
    loadButton.style.display = 'none';
  }
}

startButton.addEventListener('click', async () => {
  const apiUrl = apiUrlInput.value;
  const geminiApiKey = geminiApiKeyInput.value;
  const openaiApiKey = openaiApiKeyInput.value;
  const apiType = apiTypeSelect.value;
  const selectedModel = modelSelect.value;
  const selectedSpeakerId = parseInt(voiceSelect.value, 10) || 0;

  let client: LMStudioClient | GeminiClient;

  if (apiType === 'gemini') {
    // For Gemini, the API key is required and the URL is fixed
    if (!geminiApiKey) {
      alert('Gemini API requires an API key');
      return;
    }
    client = new GeminiClient(geminiApiKey, selectedModel);
  } else {
    // Default to LM Studio client
    client = new LMStudioClient(apiUrl, 'default', openaiApiKey);
  }

  // Initialize game engine
  gameEngine = new GameEngine(client as any, selectedSpeakerId); // Type assertion to avoid TS errors

  const initialSettings = {
    apiType: apiType,
    apiKey: apiType === 'gemini' ? geminiApiKey : openaiApiKey,
    apiUrl: apiUrl,
    model: selectedModel,
    speakerId: selectedSpeakerId,
    temperature: parseFloat(temperatureInput.value)
  };

  // Initialize game UI
  gameUI = new GameUI(gameEngine, initialSettings);

  // Clear UI elements before starting new game
  const sceneElement = document.querySelector('#scene-description');
  const choicesContainer = document.querySelector('#choices-container');
  if (sceneElement) sceneElement.textContent = '';
  if (choicesContainer) choicesContainer.innerHTML = '';

  // Switch screens
  setupScreen.style.display = 'none';
  gameScreen.style.display = 'flex';

  // Start the game
  try {
    await gameUI.initializeGame();
    console.log('ゲームが正常に開始されました');
  } catch (error) {
    console.error('ゲームの初期化に失敗しました:', error);
    // You might want to show the error on the UI
    if (sceneElement) {
      sceneElement.textContent = 'ゲームの初期化に失敗しました。APIの設定を確認してください。';
    }
  }
});

loadButton.addEventListener('click', async () => {
  if (!gameEngine) {
    const apiUrl = apiUrlInput.value;
    const geminiApiKey = geminiApiKeyInput.value;
    const openaiApiKey = openaiApiKeyInput.value;
    const apiType = apiTypeSelect.value;
    const selectedModel = modelSelect.value;
    const selectedSpeakerId = parseInt(voiceSelect.value, 10) || 0;
    const temperature = parseFloat(temperatureInput.value);

    let client: LMStudioClient | GeminiClient;

    if (apiType === 'gemini') {
      if (!geminiApiKey) {
        alert('Gemini API requires an API key');
        return;
      }
      client = new GeminiClient(geminiApiKey, selectedModel);
    } else {
      client = new LMStudioClient(apiUrl, 'default', openaiApiKey);
    }

    gameEngine = new GameEngine(client as any, selectedSpeakerId);

    const initialSettings = {
      apiType: apiType,
      apiKey: apiType === 'gemini' ? geminiApiKey : openaiApiKey,
      apiUrl: apiUrl,
      model: selectedModel,
      speakerId: selectedSpeakerId,
      temperature: temperature
    };

    gameUI = new GameUI(gameEngine, initialSettings);
  }

  const loadedState = gameEngine.loadGame();
  if (loadedState) {
    setupScreen.style.display = 'none';
    gameScreen.style.display = 'flex';

    // ゲームUIを更新
    gameUI.updateDisplayFromState(loadedState);

    // 情景描写を読み上げ
    await gameEngine.speakText(loadedState.sceneDescription);
  } else {
    alert('セーブデータが見つかりませんでした。');
  }
});

saveAndQuitButton.addEventListener('click', () => {
  if (gameEngine) {
    gameEngine.saveGame();
    gameScreen.style.display = 'none';
    setupScreen.style.display = 'flex';
    // ロードボタンの表示を更新
    toggleLoadButton();
  }
});