import { useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { SentenceOrderBoard } from './components/SentenceOrderBoard';
import './App.css';

type GameMode = 'phrase' | 'sentence';

function App() {
  const [mode, setMode] = useState<GameMode>('phrase');

  return (
    <>
      <nav className="mode-tabs">
        <button
          className={`mode-tab ${mode === 'phrase' ? 'mode-tab--active' : ''}`}
          onClick={() => setMode('phrase')}
        >
          어구배열
        </button>
        <button
          className={`mode-tab ${mode === 'sentence' ? 'mode-tab--active' : ''}`}
          onClick={() => setMode('sentence')}
        >
          문장배열
        </button>
      </nav>
      {mode === 'phrase' ? <GameBoard /> : <SentenceOrderBoard />}
    </>
  );
}

export default App;
