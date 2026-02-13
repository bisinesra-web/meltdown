import React, { useState, useRef, useEffect } from "react";
import "@fontsource-variable/jetbrains-mono";
import "./Join.css";

export default function Join() {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Only allow alphanumeric characters, max 5
    const filtered = value.replace(/[^A-Z0-9]/g, "").slice(0, 5);
    setCode(filtered);
  };

  const handleSubmit = () => {
    if (code.length === 5) {
      // Placeholder function
      console.log("Joining game with code:", code);
      // TODO: Implement actual join logic
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && code.length === 5) {
      handleSubmit();
    }
  };

  return (
    <div className="join-container">
      <div className="grid-background-animated" />
      <div className="vignette" />
      
      <header className="join-header">
        <h1 className="join-title">MELTDOWN</h1>
      </header>

      <main className="join-main">
        <div className="join-form">
          <label className="code-label">ENTER CODE</label>
          <input
            ref={inputRef}
            type="text"
            className="code-input"
            value={code}
            onChange={handleCodeChange}
            onKeyPress={handleKeyPress}
            maxLength={5}
          />
          <button
            className="btn join-submit-btn"
            onClick={handleSubmit}
            disabled={code.length !== 5}
          >
            JOIN
          </button>
        </div>
      </main>
    </div>
  );
}
