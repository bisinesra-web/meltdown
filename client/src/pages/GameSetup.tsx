import React, { useEffect, useState } from 'react';
import './GameSetup.css';

type NavigateTarget = 'landing' | 'rules' | 'setup' | 'game';

type GameConfig = {
  round: number;
  team1Name: string;
  team2Name: string;
  startingTeam: string;
  startingRole: 'STABILIZING' | 'SABOTAGING';
};

type GameSetupProps = {
  config?: GameConfig;
  onNavigate: (target: NavigateTarget) => void;
};

const GameSetup = ({ config, onNavigate }: GameSetupProps) => {
  const [timeLeft, setTimeLeft] = useState(600);
  const [gameStarted, setGameStarted] = useState(false);
  const [reactorHealth, setReactorHealth] = useState(100);

  useEffect(() => {
    if (!gameStarted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startingRole = config?.startingRole || 'STABILIZING';
  const opposingTeam =
    config?.startingTeam === config?.team1Name ? config?.team2Name : config?.team1Name;

  return (
    <div className="game-setup">
      <div className="game-container">
        {!gameStarted ? (
          <>
            <div className="pre-game-panel">
              <h1>{config?.round && `ROUND ${config.round}`}</h1>
              <div className="team-vs">
                <div className="team-card">
                  <h2>{config?.startingTeam}</h2>
                  <p className="role-label">{startingRole}</p>
                </div>
                <div className="vs">VS</div>
                <div className="team-card opponent">
                  <h2>{opposingTeam}</h2>
                  <p className="role-label">
                    {startingRole === 'STABILIZING' ? 'SABOTAGING' : 'STABILIZING'}
                  </p>
                </div>
              </div>

              <div className="instructions">
                <h3>GAME STARTING IN...</h3>
                <p className="countdown pulse">3... 2... 1...</p>
              </div>

              <button className="btn btn-primary" onClick={() => setGameStarted(true)}>
                BEGIN ROUND
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate('setup')}>
                BACK TO SETUP
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="game-header">
              <div className="timer">
                <span className={timeLeft < 120 ? 'warning' : ''}>{formatTime(timeLeft)}</span>
              </div>
              <h1 className="round-title">{config?.round && `ROUND ${config.round}`}</h1>
              <div className="health-display">
                <span>REACTOR: {reactorHealth}%</span>
              </div>
            </div>

            <div className="game-area">
              <div className="role-panel">
                <h2>YOUR ROLE</h2>
                <div className={`role-badge ${startingRole.toLowerCase()}`}>
                  {startingRole}
                </div>
                <p className="team-info">Team: {config?.startingTeam}</p>
              </div>

              <div className="reactor-display">
                <h2>REACTOR STATUS</h2>
                <div className="reactor-bar">
                  <div
                    className={`health-fill ${
                      reactorHealth < 30
                        ? 'critical'
                        : reactorHealth < 60
                          ? 'warning'
                          : 'stable'
                    }`}
                    style={{ width: `${reactorHealth}%` }}
                  ></div>
                </div>
                <p className="health-text">{reactorHealth}% OPERATIONAL</p>
              </div>

              <div className="opponent-panel">
                <h2>OPPONENT</h2>
                <p className="opponent-name">{opposingTeam}</p>
                <p className="opponent-role">
                  {startingRole === 'STABILIZING' ? 'SABOTAGING' : 'STABILIZING'}
                </p>
              </div>
            </div>

            {timeLeft === 0 && (
              <div className="round-end">
                <h2>ROUND COMPLETE</h2>
                <p>Final Health: {reactorHealth}%</p>
                <button className="btn btn-primary" onClick={() => onNavigate('setup')}>
                  NEXT ROUND
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GameSetup;
