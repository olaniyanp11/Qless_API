// Patches
const { inject, errorHandler } = require("express-custom-error");
inject(); // Patch express in order to use async / await syntax

// Require Dependencies
const morgan = require("morgan");
// require('./models/database');
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const path = require('path')
const createError = require("http-errors");
const mongoose = require("mongoose");

const logger = require("./util/logger");

// Load .env Enviroment Variables to process.env

require("mandatoryenv").load(["DB_URL", "PORT", "SECRET"]);

const { PORT, DB_URL } = process.env;

// Instantiate an Express Application
const app = express();

// Configure Express App Instance
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Configure custom logger middleware
app.use(logger.dev, logger.combined);

app.use(cookieParser());
app.use(cors());
app.use(helmet());
//Import routes
const userRoute = require("./routes/user");
const orgRoute = require("./routes/orgs");
const productRoute = require("./routes/products");

// Assign Routes
app.use(cors({
  origin: 'http://localhost:5173', // Your React app's URL
  credentials: true,
}));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use("/user", userRoute);
app.use("/org", orgRoute);
app.use("/products", productRoute);

// This middleware adds the json header to every response
app.use("*", (req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});
// app.get('/test-image', (req, res) => {
//   res.sendFile(path.join(__dirname, '../../uploads', 'image-1726130160101-613820963.png'));
// });
app.use((req, res, next) => {
  // Checks for errors and manages them properly
  next(createError.NotFound());
});

app.use((err, req, res, next) => {
  // Middleware for error management
  res.status(err.status || 500);
  res.send({
    status: err.status || 500,
    message: err.message,
  });
});

// Handle errors
app.use(errorHandler());

// Handle not valid route
app.use("*", (req, res) => {
  res.status(404).json({ status: false, message: "Endpoint Not Found" });
});

// Open Server on selected Port
app.listen(PORT, () => {
  console.info("Server listening on port ", PORT);
  mongoose.connect(DB_URL).then(() => {
    console.log("connected to db");
  });
});
