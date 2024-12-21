class ChatManager {
  constructor(peerId, socket, roomId, rtcConnection) {
    this.peerId = peerId;
    this.socket = socket;
    this.roomId = roomId;
    this.rtcConnection = rtcConnection; // WebRTC connection
    this.chatMessages = [];
    this.dataChannel = null;

    this.initializeUI();
    this.initializeSocketListeners();
    this.initializeWebRTC();
  }

  initializeWebRTC() {
    // Create data channel for chat
    this.dataChannel = this.rtcConnection.createDataChannel("chat");

    this.dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.receiveChatMessage(message);
    };

    this.rtcConnection.ondatachannel = (event) => {
      const receiveChannel = event.channel;
      receiveChannel.onmessage = (e) => {
        const message = JSON.parse(e.data);
        this.receiveChatMessage(message);
      };
    };
  }

  initializeUI() {
    this.chatInput = document.querySelector(".chat-input input");
    this.chatSendButton = document.querySelector(".chat-input button");
    this.chatMessagesContainer = document.querySelector(".chat-messages");

    this.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleChatSubmit();
      }
    });

    this.chatSendButton.addEventListener("click", () => {
      this.handleChatSubmit();
    });
  }

  initializeSocketListeners() {
    this.socket.on("chat-message", (message) => {
      this.receiveChatMessage(message);
    });
  }

  handleChatSubmit() {
    const text = this.chatInput.value.trim();
    if (text) {
      this.sendChatMessage(text);
      this.chatInput.value = "";
    }
  }

  sendChatMessage(text) {
    const message = {
      senderId: this.peerId,
      senderName: "You", // You can replace this with actual user name from session
      text: text,
      timestamp: Date.now(),
    };

    // Send through WebRTC if connection is established
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(JSON.stringify(message));
    } else {
      // Fallback to socket if WebRTC is not available
      this.socket.emit("chat-message", this.roomId, message);
    }

    // Add to local messages and display
    this.receiveChatMessage(message);
  }

  receiveChatMessage(message) {
    this.chatMessages.push(message);
    this.displayMessage(message);
    this.scrollToBottom();
  }

  displayMessage(message) {
    const messageElement = this.createMessageElement(message);
    this.chatMessagesContainer.appendChild(messageElement);
  }

  createMessageElement(message) {
    const div = document.createElement("div");
    div.className = `flex gap-2 mb-4 ${
      message.senderId === this.peerId ? "justify-end" : "justify-start"
    }`;

    div.innerHTML = `
      <div class="max-w-[70%] break-words">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-medium">${message.senderName}</span>
          <span class="text-xs text-gray-500">
            ${new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div class="bg-${
          message.senderId === this.peerId ? "blue-500 text-white" : "gray-200"
        } 
              rounded-lg p-3">
          <p class="text-sm">${message.text}</p>
        </div>
      </div>
    `;

    return div;
  }

  scrollToBottom() {
    this.chatMessagesContainer.scrollTop =
      this.chatMessagesContainer.scrollHeight;
  }
}
