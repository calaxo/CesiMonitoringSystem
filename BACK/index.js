const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const app = express();

// app.use(function (req, res, next) {
//   res.setHeader(
//     "Content-Security-Policy-Report-Only",
//     "default-src 'self'; font-src 'self' fonts.gstatic.com https://fonts.cdnfonts.com ; script-src 'self';style-src 'self' https://fonts.googleapis.com https://fonts.cdnfonts.com; frame-src 'self'",
//   );
//   next();
// });

app.use(bodyParser.json());

// Middleware to serve static files recursively
function serveStaticRecursive(rootDir) {
  return function (req, res, next) {
    const filePath = path.join(rootDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
  };
}

// Serve static files recursively from the 'assets' directory
app.use(serveStaticRecursive(path.join(__dirname, "assets")));

// Define your routes
app.get("/", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname, "/assets/index.html"));
  console.log("test", "requete", req);
});

app.get("/about", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname + "/assets/index.html"));
  console.log("testacceuil", "requete", req.headers);
});

app.get("/fleet", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname + "/assets/index.html"));
});

app.get("/favicon.ico", (req, res) => {
  res.header("Content-type", "image/x-icon");
  res.sendFile(path.join(__dirname + "/assets/favicon.ico"));
  console.log("testcss", "requete", req.headers);
}
);

app.get("/courses", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname + "/assets/index.html"));
});

app.get("/contact", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname + "/assets/index.html"));
});

app.get("/job", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname + "/assets/index.html"));
});


app.get("/legal", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname + "/assets/index.html"));
});

app.get("/privacy", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname + "/assets/index.html"));
});

app.get("/certif", (req, res) => {
  res.header("Content-type", "text/html");
  res.sendFile(path.join(__dirname + "/assets/index.html"));
});

app.get("/favicon.ico", (req, res) => {
  res.header("Content-type", "image/x-icon");
  res.sendFile(path.join(__dirname + "/assets/favicon.ico"));
  console.log("testcss", "requete", req.headers);
});

// Add more routes as needed...

// Catch 404 and serve the default index.html
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "/assets/index.html"));
});

const server = app.listen(process.env.PORT || 5500, () => {
  const { port } = server.address();
  console.log(`Le serveur tourne sur le PORT ${port}`);
});