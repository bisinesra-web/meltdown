import React from 'react';
import './Landing.css';

type NavigateTarget = 'landing' | 'rules' | 'setup' | 'game';

type LandingProps = {
  onNavigate: (target: NavigateTarget) => void;
};

const Landing = ({ onNavigate }: LandingProps) => {
  return (
    <div className="landing">
      <div className="landing-container">
        <div className="reactor-art">
          <pre>{`
    ___
   /   \\
  |  O  |
  | --- |
  | --- |
   \\___/
          `}</pre>
        </div>

        <h1 className="title">REACTOR MELTDOWN</h1>
        <p className="subtitle">A Game of Control & Deception</p>

        <div className="status-bar">
          <span className="status-indicator pulse"></span>
          <span className="status-text">SYSTEM ONLINE</span>
        </div>

        <div className="main-menu">
          <button className="btn btn-primary" onClick={() => onNavigate('rules')}>
            READ RULES
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('setup')}>
            START GAME
          </button>
        </div>

        <div className="info-panel">
          <h3>GAME OVERVIEW</h3>
          <p>• 2 Rounds of intense competition</p>
          <p>• Teams swap roles between rounds</p>
          <p>• STABILIZERS keep reactor online</p>
          <p>• SABOTEURS create chaos</p>
          <p>• Best combined score wins</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
