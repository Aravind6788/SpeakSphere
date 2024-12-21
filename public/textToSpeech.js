// textToSpeech.js

const languageMapping = {
  en: "en-US",
  ta: "ta-IN",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  hi: "hi-IN",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
};

document.addEventListener("DOMContentLoaded", function () {
  const speakButton = document.getElementById("speak-button");
  const translatedCaptions = document.getElementById("translated-captions");
  let isSpeaking = false;
  let isCurrentlySpeaking = false;
  let observer = null;
  const speechSynthesis = window.speechSynthesis;
  let lastSpokenText = "";

  async function textToSpeech(text, languageCode) {
    return new Promise((resolve, reject) => {
      // Stop any ongoing speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageMapping[languageCode] || "en-US";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        isCurrentlySpeaking = false;
        resolve();
      };

      utterance.onerror = (error) => {
        console.error("Speech synthesis error:", error);
        isCurrentlySpeaking = false;
        reject(error);
      };

      isCurrentlySpeaking = true;
      speechSynthesis.speak(utterance);
    });
  }

  function startSpeaking() {
    // Create and start the observer
    observer = new MutationObserver(async (mutations) => {
      if (!isSpeaking) return;

      for (const mutation of mutations) {
        if (
          mutation.type === "childList" ||
          mutation.type === "characterData"
        ) {
          const currentText = translatedCaptions.textContent.trim();

          // Only speak if there's new text and we're not currently speaking
          if (
            currentText &&
            currentText !== lastSpokenText &&
            !isCurrentlySpeaking
          ) {
            const selectedLanguage = document.getElementById(
              "translation-language"
            ).value;

            try {
              await textToSpeech(currentText, selectedLanguage);
              lastSpokenText = currentText;
            } catch (error) {
              console.error("Speech synthesis failed:", error);
            }
          }
        }
      }
    });

    // Configure and start the observer
    observer.observe(translatedCaptions, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function stopSpeaking() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    speechSynthesis.cancel(); // Stop any ongoing speech
    isCurrentlySpeaking = false;
  }

  // Update button state and icon
  function updateButtonState(isActive) {
    if (isActive) {
      speakButton.classList.add("bg-red-500");
      speakButton.classList.remove("bg-green-400");
      speakButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
            `;
    } else {
      speakButton.classList.add("bg-green-400");
      speakButton.classList.remove("bg-red-500");
      speakButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
            `;
    }
  }

  speakButton.addEventListener("click", () => {
    if (!isSpeaking) {
      isSpeaking = true;
      updateButtonState(isSpeaking);
      // Speak the current text immediately if it exists
      const currentText = translatedCaptions.textContent.trim();
      if (
        currentText &&
        !isCurrentlySpeaking &&
        currentText !== lastSpokenText
      ) {
        const selectedLanguage = document.getElementById(
          "translation-language"
        ).value;
        textToSpeech(currentText, selectedLanguage)
          .then(() => {
            lastSpokenText = currentText;
          })
          .catch((error) => {
            console.error("Initial speech synthesis failed:", error);
          });
      }
      startSpeaking();
    } else {
      isSpeaking = false;
      updateButtonState(isSpeaking);
      stopSpeaking();
    }
  });

  // Initial button state
  updateButtonState(false);
});
