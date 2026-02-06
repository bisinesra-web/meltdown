import React from 'react';
import './Rules.css';

type NavigateTarget = 'landing' | 'rules' | 'setup' | 'game';

type RulesProps = {
  onNavigate: (target: NavigateTarget) => void;
};

const Rules = ({ onNavigate }: RulesProps) => {
  return (
    <div className="rules-page">
      <div className="rules-container">
        <button className="btn-back" onClick={() => onNavigate('landing')}>
          &lt; BACK
        </button>

        <h1>GAME RULES & STRUCTURE</h1>

        <div className="rules-grid">
          <section className="rule-section">
            <h2>ROUND FORMAT</h2>
            <div className="rule-content">
              <p>
                <strong>Duration:</strong> 10 minutes per round
              </p>
              <p>
                <strong>Total Game:</strong> 2 rounds (teams swap roles)
              </p>
              <p>
                <strong>Winner:</strong> Team with highest combined score
              </p>
            </div>
          </section>

          <section className="rule-section">
            <h2>ROUND A</h2>
            <div className="rule-content">
              <p>
                <strong>Team 1:</strong> STABILIZING
              </p>
              <p style={{ marginLeft: '1rem', color: 'var(--dark-green)' }}>
                • Operator + Monitor isolated
                <br />
                • Cannot communicate except via public channel
                <br />
                • Must keep reactor stable
              </p>
              <p>
                <strong>Team 2:</strong> SABOTAGING
              </p>
              <p style={{ marginLeft: '1rem', color: 'var(--dark-green)' }}>
                • Both in war room together
                <br />
                • Can see opponent communications
                <br />
                • Goal: Cause meltdown
              </p>
            </div>
          </section>

          <section className="rule-section">
            <h2>ROUND B</h2>
            <div className="rule-content">
              <p>ROLES SWAP</p>
              <p
                style={{
                  marginLeft: '1rem',
                  color: 'var(--dark-green)',
                  marginTop: '1rem',
                }}
              >
                Team 1 becomes SABOTAGING
                <br />
                Team 2 becomes STABILIZING
              </p>
            </div>
          </section>

          <section className="rule-section">
            <h2>STABILIZING TEAM</h2>
            <div className="rule-content">
              <p>
                <strong>Setup:</strong> Separate isolated rooms
              </p>
              <p>
                <strong>Operator:</strong> Controls reactor systems
              </p>
              <p>
                <strong>Monitor:</strong> Analyzes reactor status
              </p>
              <p>
                <strong>Communication:</strong> Only via public message channel
              </p>
              <p>
                <strong>Goal:</strong> Survive 10 minutes with minimal damage
              </p>
              <p>
                <strong>Challenge:</strong> Cannot communicate directly - must use code/cipher
              </p>
            </div>
          </section>

          <section className="rule-section">
            <h2>SABOTAGING TEAM</h2>
            <div className="rule-content">
              <p>
                <strong>Setup:</strong> War room (same space)
              </p>
              <p>
                <strong>Access:</strong> Can see all opponent communications
              </p>
              <p>
                <strong>Tools:</strong> Whiteboard for cryptanalysis
              </p>
              <p>
                <strong>Control:</strong> Sabotage panel to trigger attacks
              </p>
              <p>
                <strong>Goal:</strong> Crack their code & cause maximum damage
              </p>
              <p>
                <strong>Advantage:</strong> Direct collaboration & message visibility
              </p>
            </div>
          </section>

          <section className="rule-section">
            <h2>SCORING</h2>
            <div className="rule-content">
              <p>
                <strong>Stability Points:</strong> Awarded for maintaining reactor health
              </p>
              <p>
                <strong>Damage Taken:</strong> Subtracted from final score
              </p>
              <p>
                <strong>Win Condition:</strong> Highest combined score across both rounds
              </p>
            </div>
          </section>
        </div>

        <div className="action-buttons">
          <button className="btn btn-primary" onClick={() => onNavigate('setup')}>
            START GAME
          </button>
        </div>
      </div>
    </div>
  );
};

export default Rules;
