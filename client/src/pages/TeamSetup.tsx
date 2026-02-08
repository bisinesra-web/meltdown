import React, { useState } from "react";
import "./TeamSetup.css";

type NavigateTarget = "landing" | "rules" | "setup" | "game";

type GameConfig = {
  round: number;
  team1Name: string;
  team2Name: string;
  startingTeam: string;
  startingRole: "STABILIZING" | "SABOTAGING";
};

type TeamSetupProps = {
  onNavigate: (target: NavigateTarget) => void;
  onConfigSet: (config: GameConfig) => void;
};

const TeamSetup = ({ onNavigate, onConfigSet }: TeamSetupProps) => {
  const [team1Name, setTeam1Name] = useState("TEAM ALPHA");
  const [team2Name, setTeam2Name] = useState("TEAM BRAVO");
  const [round, setRound] = useState(1);

  const handleStart = () => {
    const config: GameConfig = {
      round,
      team1Name,
      team2Name,
      startingTeam: round === 1 ? "TEAM ALPHA" : "TEAM BRAVO",
      startingRole: "STABILIZING",
    };
    onConfigSet(config);
    onNavigate("game");
  };

  return (
    <div className="team-setup">
      <div className="setup-container">
        <button className="btn-back" onClick={() => onNavigate("landing")}>
          &lt; BACK
        </button>

        <h1>GAME SETUP</h1>

        <div className="setup-grid">
          <section className="setup-panel">
            <h2>TEAM CONFIGURATION</h2>
            <div className="input-group">
              <label>TEAM 1 NAME</label>
              <input
                type="text"
                value={team1Name}
                onChange={(e) => setTeam1Name(e.target.value.toUpperCase())}
                maxLength={20}
              />
            </div>

            <div className="input-group">
              <label>TEAM 2 NAME</label>
              <input
                type="text"
                value={team2Name}
                onChange={(e) => setTeam2Name(e.target.value.toUpperCase())}
                maxLength={20}
              />
            </div>

            <div className="input-group">
              <label>STARTING ROUND</label>
              <select
                value={round}
                onChange={(e) => setRound(Number(e.target.value))}
              >
                <option value={1}>ROUND 1</option>
                <option value={2}>ROUND 2</option>
              </select>
            </div>
          </section>

          <section className="setup-panel">
            <h2>ROUND 1 ROLES</h2>
            <div className="role-assignment">
              <div className="role-box stabilizing">
                <h3>STABILIZING</h3>
                <p className="team-name">{team1Name}</p>
                <p className="role-desc">Isolated</p>
                <p className="role-desc">Cannot Communicate</p>
                <p className="role-desc">Keep Reactor Safe</p>
              </div>

              <div className="vs-text">VS</div>

              <div className="role-box sabotaging">
                <h3>SABOTAGING</h3>
                <p className="team-name">{team2Name}</p>
                <p className="role-desc">War Room</p>
                <p className="role-desc">Full Visibility</p>
                <p className="role-desc">Cause Chaos</p>
              </div>
            </div>
          </section>

          <section className="setup-panel">
            <h2>ROUND 2 PREVIEW</h2>
            <div className="role-assignment">
              <div className="role-box sabotaging">
                <h3>SABOTAGING</h3>
                <p className="team-name">{team1Name}</p>
              </div>

              <div className="vs-text">VS</div>

              <div className="role-box stabilizing">
                <h3>STABILIZING</h3>
                <p className="team-name">{team2Name}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary" onClick={handleStart}>
            START GAME
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamSetup;
