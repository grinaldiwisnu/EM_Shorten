const express = require("express");
const body = require("body-parser");
const cors = require("cors");
const app = express();
const router = require("./routes/index");

app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(body.urlencoded({extended: true}));
app.use(express.urlencoded());
app.use(express.json());
app.use(cors());
app.listen(3500);
console.log("Started listening at port 3500");
app.use(router);
