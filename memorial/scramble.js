// Meltdown Text Unscrambling Effect
(function() {
  const HEX_CHARS = '0123456789ABCDEF';
  const CORRUPT_CHARS = '█▓▒░▪▫◆◇○●□■△▽';

  function randomHex(length) {
    return Array.from({ length }, () => 
      HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)]
    ).join('');
  }

  function randomCorrupt(length) {
    const pool = HEX_CHARS + CORRUPT_CHARS;
    return Array.from({ length }, () => 
      pool[Math.floor(Math.random() * pool.length)]
    ).join('');
  }

  class TextUnscrambler {
    constructor(element, finalText, mode = 'hex') {
      this.element = element;
      this.finalText = finalText;
      this.mode = mode;
      this.lockedChars = 0;
      this.isActive = true;
      this.interval = null;

      this.init();
    }

    init() {
      this.render();
      this.start();
    }

    render() {
      const displayed = this.finalText
        .split('')
        .map((char, index) => {
          if (index < this.lockedChars) {
            return char;
          }
          return this.mode === 'hex'
            ? HEX_CHARS[Math.floor(Math.random() * HEX_CHARS.length)]
            : (HEX_CHARS + CORRUPT_CHARS)[Math.floor(Math.random() * (HEX_CHARS.length + CORRUPT_CHARS.length))];
        })
        .join('');

      this.element.textContent = displayed;
    }

    start() {
      // Gradually lock in characters
      let lockedPerFrame = 0;
      this.interval = setInterval(() => {
        lockedPerFrame++;
        this.lockedChars = Math.floor((lockedPerFrame / 120) * this.finalText.length);

        if (this.lockedChars >= this.finalText.length) {
          this.lockedChars = this.finalText.length;
          this.element.textContent = this.finalText;
          clearInterval(this.interval);
        } else {
          this.render();
        }
      }, 30);
    }

    stop() {
      this.isActive = false;
      if (this.interval) {
        clearInterval(this.interval);
      }
      this.element.textContent = this.finalText;
    }
  }

  // Initialize all scramble text elements
  window.initializeScrambleTexts = function() {
    const elements = document.querySelectorAll('.scramble-text');
    elements.forEach(el => {
      const finalText = el.getAttribute('data-text') || el.textContent;
      const mode = el.getAttribute('data-mode') || 'hex';
      new TextUnscrambler(el, finalText, mode);
    });
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initializeScrambleTexts);
  } else {
    window.initializeScrambleTexts();
  }
})();
