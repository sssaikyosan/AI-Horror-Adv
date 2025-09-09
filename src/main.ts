import './style.css'
import { GameEngine } from './game-engine'
import { GameUI } from './game-ui'
import { GeminiClient } from './gemini-client';

const copyUrlElement = document.querySelector('#copy-origin-url');
if (copyUrlElement) {
  copyUrlElement.addEventListener('click', () => {
    const url = 'https://main.ssdojo.net';
    navigator.clipboard.writeText(url).then(() => {
      // Show feedback to user
      copyUrlElement.textContent = 'コピーしました！';
      setTimeout(() => {
        copyUrlElement.textContent = url;
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy URL: ', err);
    });
  });
}

// Initialize game engine and UI when the page loads
window.addEventListener('DOMContentLoaded', () => {
  // Set up initial game engine and UI
  const initialSettings = {
    apiType: 'gemini',
    apiKey: '',
    apiUrl: 'http://localhost:1234/v1',
    model: 'gemini-2.5-pro',
    speakerId: 3,
    bgmVolume: 0.2
  };

  const client = new GeminiClient('');
  const gameEngine = new GameEngine(client, 3)
  const gameUI = new GameUI(gameEngine, initialSettings);

  gameUI.initializeSettings();
});