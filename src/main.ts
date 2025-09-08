import './style.css'
import { LMStudioClient } from './lmstudio-client'
import { GameEngine } from './game-engine'
import { GameUI } from './game-ui'
import { GeminiClient } from './gemini-client';

// Initialize game engine and UI when the page loads
window.addEventListener('DOMContentLoaded', () => {
  // Set up initial game engine and UI
  const initialSettings = {
    apiType: 'gemini',
    apiKey: '',
    apiUrl: 'http://localhost:1234/v1',
    model: 'gemini-2.5-pro',
    speakerId: 3
  };

  const client = new GeminiClient('');
  const gameEngine = new GameEngine(client, 3)
  const gameUI = new GameUI(gameEngine, initialSettings);

  gameUI.initializeSettings();
});