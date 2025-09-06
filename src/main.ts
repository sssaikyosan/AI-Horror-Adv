import './style.css'
import { LMStudioClient } from './lmstudio-client'
import { GeminiClient } from './gemini-client'
import { GameEngine } from './game-engine'
import { GameUI } from './game-ui'
import { VoicevoxClient } from './voicevox-client'

const setupScreen = document.getElementById('setup-screen') as HTMLElement;
const gameScreen = document.getElementById('game-screen') as HTMLElement;
const startButton = document.getElementById('start-game-btn') as HTMLButtonElement;
const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const apiTypeSelect = document.getElementById('api-type') as HTMLSelectElement;
const modelContainer = document.getElementById('model-container') as HTMLElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const apiUrlContainer = document.getElementById('api-url-container') as HTMLElement;
const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;

// Set initial state based on default selection
updateUIForAPIType('gemini');
loadGeminiModels();
loadSpeakers();

apiTypeSelect.addEventListener('change', () => {
  updateUIForAPIType(apiTypeSelect.value);
});

// Reload models when API key changes
let debounceTimer: number | null = null;
apiKeyInput.addEventListener('input', () => {
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
    const apiKey = apiKeyInput.value;

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
    modelContainer.style.display = 'block';
    apiKeyInput.placeholder = 'Required for Gemini';
    // Focus on the API key field since it's required
    apiKeyInput.focus();

    // Load models for Gemini
    loadGeminiModels();
  } else {
    // Show URL input for other APIs
    apiUrlContainer.style.display = 'block';
    modelContainer.style.display = 'none';
    apiKeyInput.placeholder = 'Optional';
  }
}

startButton.addEventListener('click', async () => {
  const apiUrl = apiUrlInput.value;
  const apiKey = apiKeyInput.value;
  const apiType = apiTypeSelect.value;
  const selectedModel = modelSelect.value;
  const selectedSpeakerId = parseInt(voiceSelect.value, 10) || 0;

  let client: LMStudioClient | GeminiClient;

  if (apiType === 'gemini') {
    // For Gemini, the API key is required and the URL is fixed
    if (!apiKey) {
      alert('Gemini API requires an API key');
      return;
    }
    client = new GeminiClient(apiKey, selectedModel);
  } else {
    // Default to LM Studio client
    client = new LMStudioClient(apiUrl, 'default', apiKey);
  }

  // Initialize game engine
  const gameEngine = new GameEngine(client as any, selectedSpeakerId); // Type assertion to avoid TS errors

  const initialSettings = {
    apiType: apiType,
    apiKey: apiKey,
    apiUrl: apiUrl,
    model: selectedModel,
    speakerId: selectedSpeakerId
  };

  // Initialize game UI
  const gameUI = new GameUI(gameEngine, initialSettings);

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
    const sceneElement = document.querySelector('#scene-description');
    if (sceneElement) {
      sceneElement.textContent = 'ゲームの初期化に失敗しました。APIの設定を確認してください。';
    }
  }
});