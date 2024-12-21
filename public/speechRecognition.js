const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  const output = document.getElementById("output");
  const languageSelect = document.getElementById("language-select");
  const statusIndicator = document.querySelector(".status-indicator");

  // Configuration
  recognition.lang = languageSelect.value;
  recognition.interimResults = true;
  recognition.continuous = true;

  let isRecognitionActive = false;
  let lastRecognitionTimestamp = Date.now();
  let recognitionAttempts = 0;
  const MAX_ATTEMPTS = 5;
  const RESET_ATTEMPT_DELAY = 10000;

  // New variables for speech collection
  let speechBuffer = [];
  let silenceTimer = null;
  const SILENCE_THRESHOLD = 1000; // 1 second of silence to consider it a gap

  function updateStatus(message) {
    if (statusIndicator) {
      statusIndicator.textContent = message;
    }
  }

  function startRecognition() {
    try {
      if (!isRecognitionActive) {
        recognition.start();
        isRecognitionActive = true;
        lastRecognitionTimestamp = Date.now();
        recognitionAttempts++;
        updateStatus(
          `Speech recognition active (Attempt ${recognitionAttempts})`
        );

        setTimeout(() => {
          recognitionAttempts = 0;
        }, RESET_ATTEMPT_DELAY);
      }
    } catch (error) {
      handleRecognitionError(error);
    }
  }

  function restartRecognition(delay = 1000) {
    if (recognitionAttempts >= MAX_ATTEMPTS) {
      delay = RESET_ATTEMPT_DELAY;
      recognitionAttempts = 0;
    }

    try {
      if (isRecognitionActive) {
        recognition.stop();
      }
    } catch (error) {
      console.error(`Stop error during restart: ${error.message}`);
    }

    isRecognitionActive = false;
    updateStatus("Restarting speech recognition...");

    setTimeout(() => {
      startRecognition();
    }, delay);
  }

  function handleRecognitionError(error) {
    isRecognitionActive = false;
    restartRecognition();
  }

  function checkRecognitionHealth() {
    const currentTime = Date.now();
    const timeSinceLastRecognition = currentTime - lastRecognitionTimestamp;

    if (timeSinceLastRecognition > 10000) {
      restartRecognition();
    }
  }

  languageSelect.addEventListener("change", () => {
    const newLang = languageSelect.value;
    recognition.lang = newLang;
    restartRecognition();
  });

  recognition.onstart = () => {
    updateStatus("Speech recognition active");
  };

  recognition.onend = () => {
    updateStatus("Speech recognition inactive");
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
    if (isRecognitionActive) {
      restartRecognition();
    }
  };

  recognition.onresult = async (event) => {
    lastRecognitionTimestamp = Date.now();
    const current = event.resultIndex;
    const transcript = event.results[current][0].transcript;

    // Clear any existing silence timer
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }

    // Add the current transcript to the buffer
    if (event.results[current].isFinal) {
      speechBuffer.push(transcript.trim());
    } else {
      // Update live feedback with current transcript
      output.textContent = transcript;
    }

    // Set a new silence timer
    silenceTimer = setTimeout(async () => {
      if (speechBuffer.length > 0) {
        // Combine all collected speech
        const completeText = speechBuffer.join(" ");

        // Update live captions with the complete text
        output.textContent = completeText;

        // Send transcript to other users
        if (typeof socket !== "undefined") {
          socket.emit("speech-result", ROOM_ID, completeText);
        }

        // Translate the complete text
        const targetLang = document.getElementById(
          "your-translation-language"
        ).value;
        const translatedText = await translateText(completeText, targetLang);
        document.getElementById("your-translated-captions").textContent =
          translatedText;

        // Clear the buffer for the next speech segment
        speechBuffer = [];
      }
    }, SILENCE_THRESHOLD);
  };

  recognition.onerror = (event) => {
    handleRecognitionError(event.error);
  };

  // Start recognition on page load
  startRecognition();

  // Health check interval
  setInterval(checkRecognitionHealth, 5000);

  // Export recognition object for use in other scripts
  window.recognition = recognition;
} else {
  console.error("Speech recognition not supported in this browser.");
}

async function translateText(text, targetLang) {
  try {
    const response = await fetch(
      "https://python-speech-reco-server.onrender.com/translate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          target_lang: targetLang,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.translation || "";
  } catch (error) {
    console.error("Translation Error:", error);
    return "";
  }
}
