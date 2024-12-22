const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const connectDB = require("./config/database");
const User = require("./models/user");
const Meeting = require("./models/meeting");
const bcrypt = require("bcrypt");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

connectDB();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add session middleware
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

// Middleware to make user data available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// default page render
app.get("/", (req, res) => {
  res.render("login");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/home", (req, res) => {
  res.render("features");
});

// Create meeting room
app.get("/create-room", (req, res) => {
  res.render("create-room");
});

// Join meeting by link and password
app.get("/join-meeting", (req, res) => {
  const username = req.session.username; // Replace with your session handling code
  res.render('join-meeting', { username });
});


// Joining meeting room by entering name
app.get("/meeting-room", (req, res) => {
  res.render("meeting-room");
});

app.get("/aboutUs", (req, res) => {
  res.render("aboutUs");
});

app.get("/contactUs", (req, res) => {
  res.render("contactUs");
});

app.get("/features", (req, res) => {
  res.render("features");
});



app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.redirect("/login");
  } catch (err) {
    res.status(500).send("Error creating user");
  }
});

// User login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (user && (await bcrypt.compare(password, user.password))) {
    req.session.user = {
      name: user.username,
      avatar: user.avatar || "/images/user.png", // Provide a default avatar path
    };
    res.redirect("/home");
  } else {
    res.status(400).send("Invalid username or password");
  }
});

// User logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});


app.get("/room", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

app.get("/:room", async (req, res) => {
  const roomId = req.params.room;
  const username = req.query.username;

  if (username) {
    req.session.username = username;
  }

  try {
    // Find the meeting by URL
    const meeting = await Meeting.findOne({ link: roomId });


    // If the meeting exists, check if a password is set
    if (meeting) {
      res.render("room", { roomId: roomId, isPasswordSet: meeting.isPasswordSet }); // This will be a boolean
    } else {
      // If the meeting doesn't exist, indicate that the password should be set
      res.render("room", { roomId: roomId, isPasswordSet: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});



app.post("/verify-password", async (req, res) => {
  const { roomId, password } = req.body;

  try {
    const meeting = await Meeting.findOne({ link: roomId });

    if (meeting && await bcrypt.compare(password, meeting.password)) {
      console.log("correct");
      return res.status(200).send("Password is correct."); // Send success message
    } else {
      return res.status(401).send("Incorrect password."); // Send failure message
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});



app.post("/setpassword", async (req, res) => {
  const { roomId, password } = req.body;

  console.log(roomId);

  if (!roomId || roomId.trim() === "") {
    console.log("Room ID is missing or empty.");
    return res.status(400).send("Room ID is required.");
  }
  

  try {
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingMeeting = await Meeting.findOne({link: roomId });
    console.log()
    if (existingMeeting) {
      return res.status(400).send("Meeting already exists.");
    }


    // Create new meeting with the given URL and password
    const newMeeting = new Meeting({ link: roomId, password: hashedPassword, isPasswordSet: true });
    await newMeeting.save();
    
    res.status(200).send("Password set successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});



// Endpoint to handle password entry and meeting creation
app.post("/meeting", async (req, res) => {
  const { link, password } = req.body;

  // Check if the meeting URL already exists
  let meeting = await Meeting.findOne({ link });

  if (meeting) {
    // Meeting exists, check password
    const isMatch = await bcrypt.compare(password, meeting.password);

    if (isMatch) {
      // Correct password, proceed to the meeting
      res.redirect(`/room/${link}`);
    } else {
      // Incorrect password
      return res.status(401).send("Incorrect password.");
    }
  } else {
    // Meeting does not exist, create it
    const hashedPassword = await bcrypt.hash(password, 10);
    meeting = new Meeting({ link, password: hashedPassword, isPasswordSet: true });
    await meeting.save();
    res.redirect(`/room/${link}`);
  }
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("join-room", (roomId, userId) => {
    console.log(`User  ${userId} joining room ${roomId}`);
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId);

    // Chat message handling
    socket.on("chat-message", (roomId, message) => {
      socket.to(roomId).emit("chat-message", message);
    });

    // Speech result handling
    socket.on("speech-result", (roomId, data) => {
      socket.to(roomId).emit("remote-speech", data);
    });

    // Language change handling
    socket.on("language-change", (roomId, newLang) => {
      socket.to(roomId).emit("language-change", newLang);
    });

    // User disconnect handling
    socket.on("disconnect", () => {
      console.log(`User  ${userId} disconnected from room ${roomId}`);
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
});

// Server setup
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
