const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const myPeer = new Peer(undefined, {
  host: "peer-testing.onrender.com",
  path: "/peerjs",
  secure: true,
  port: 443,
});

const myVideo = document.createElement("video");
myVideo.muted = true;
const peers = {};
let myVideoStream;

// Get user media
navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    myPeer.on("call", (call) => {
      call.answer(stream);
      const video = document.createElement("video");
      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
    });

    socket.on("user-connected", (userId) => {
      connectToNewUser(userId, stream);
    });
  });

myPeer.on("open", (id) => {
  socket.emit("join-room", ROOM_ID, id);
});

socket.on("user-disconnected", (userId) => {
  if (peers[userId]) peers[userId].close();
});

// Speech Recognition Setup
window.recognition = new (window.SpeechRecognition ||
  window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;

recognition.onstart = () => {
  document.querySelector(".status-indicator").textContent =
    "Speech recognition active";
};

recognition.onend = () => {
  document.querySelector(".status-indicator").textContent =
    "Speech recognition stopped";
};

recognition.onresult = (event) => {
  let interimTranscript = "";
  let finalTranscript = "";

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      finalTranscript += transcript + " ";
      // Emit the final transcript to other users
      socket.emit("speech", finalTranscript.trim());
    } else {
      interimTranscript += transcript;
    }
  }

  // Update local captions
  document.getElementById("output").textContent =
    finalTranscript || interimTranscript;

  // Translate own captions
  const targetLang = document.getElementById("your-translation-language").value;
  translateText(finalTranscript || interimTranscript, targetLang)
    .then((translatedText) => {
      document.getElementById("your-translated-captions").textContent =
        translatedText;
    })
    .catch((error) => {
      console.error("Error translating own captions:", error);
    });
};

// Handle remote speech events
socket.on("remote-speech", (transcript) => {
  const remoteCaptions = document.getElementById("remote-captions");
  if (remoteCaptions) {
    remoteCaptions.textContent = transcript;

    // Translate remote captions
    const remoteTargetLang = document.getElementById(
      "translation-language"
    ).value;
    translateText(transcript, remoteTargetLang)
      .then((translatedText) => {
        document.getElementById("translated-captions").textContent =
          translatedText;
      })
      .catch((error) => {
        console.error("Error translating remote captions:", error);
      });
  }
});

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream);
  const video = document.createElement("video");

  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });

  call.on("close", () => {
    video.remove();
  });

  peers[userId] = call;
}

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}

// Controls
const muteButton = document.getElementById("muteButton");
const videoButton = document.getElementById("videoButton");
const leaveButton = document.getElementById("leaveButton");

muteButton?.addEventListener("click", toggleAudio);
videoButton?.addEventListener("click", toggleVideo);
leaveButton?.addEventListener("click", leaveRoom);

function toggleAudio() {
  const audioTrack = myVideoStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  muteButton.innerHTML = audioTrack.enabled
    ? '<i data-lucide="mic" class="h-6 w-6"></i>'
    : '<i data-lucide="mic-off" class="h-6 w-6"></i>';
  lucide.createIcons();
}

function toggleVideo() {
  const videoTrack = myVideoStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  videoButton.innerHTML = videoTrack.enabled
    ? '<i data-lucide="video" class="h-6 w-6"></i>'
    : '<i data-lucide="video-off" class="h-6 w-6"></i>';
  lucide.createIcons();
}

function leaveRoom() {
  window.location.href = "/home";
}

// Translation function
async function translateText(text, targetLang) {
  if (!text) return "";

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

// Language change handlers
document
  .getElementById("translation-language")
  ?.addEventListener("change", async () => {
    const remoteCaptions =
      document.getElementById("remote-captions").textContent;
    if (remoteCaptions) {
      const targetLang = document.getElementById("translation-language").value;
      const translatedText = await translateText(remoteCaptions, targetLang);
      document.getElementById("translated-captions").textContent =
        translatedText;
    }
  });

document
  .getElementById("your-translation-language")
  ?.addEventListener("change", async () => {
    const ownCaptions = document.getElementById("output").textContent;
    if (ownCaptions) {
      const targetLang = document.getElementById(
        "your-translation-language"
      ).value;
      const translatedText = await translateText(ownCaptions, targetLang);
      document.getElementById("your-translated-captions").textContent =
        translatedText;
    }
  });

// Speech recognition language change handler
document.getElementById("language-select")?.addEventListener("change", (e) => {
  if (window.recognition) {
    window.recognition.lang = e.target.value;
  }
});

// Start/Stop Speech Recognition buttons
document.getElementById("start-button")?.addEventListener("click", () => {
  if (window.recognition) {
    window.recognition.start();
  }
});

document.getElementById("stop-button")?.addEventListener("click", () => {
  if (window.recognition) {
    window.recognition.stop();
  }
});

// Initialize icons
lucide.createIcons();
