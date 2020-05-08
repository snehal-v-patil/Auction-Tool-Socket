var fs = require("fs");
var http = require("http");
var socketio = require("socket.io");
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var request = require("request");
const moment = require("moment");
const session = require("express-session");
var apiUrl = "http://auctions.sportz.io/";
let isProd = false;
var port = isProd ? 9009 : 8082;

var server = http.Server(app);
server.listen(port, function () {
  console.log("Listening on http://localhost:" + port);
});

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});
app.use(
  bodyParser.urlencoded({
    parameterLimit: 100000,
    limit: "100mb",
    extended: true,
  })
);
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.static(__dirname + "/public"));

/** Set Express session as middleware */
app.set("trust proxy", 1); // trust first proxy
app.use(
  session({
    secret: "keyboard cat",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
  })
);

var io = socketio.listen(server);
var clock = "";
var timeToSet = "";
var minutes = "";
var seconds = "";
var count = 0;

app.get("/ping", function (req, res) {
  console.log("ping");
  //res.send("pong");
  res.send({
    msg: "Pong",
    time: moment().format("h:mm:ss a"),
  });
});
app.post("/startTimer", function (req, res) {
  if (clock && clock != "") {
    clearInterval(clock);
  }
  console.log(req.body);
  //timeToSet = req.body.timerValue;
  console.log("Starting timer...");
  minutes = req.body.minutes;
  seconds = req.body.seconds;
  clock = setInterval(function () {
    var currTime = processTimer(minutes, seconds);
    if (count == 0) {
      currTime["team_id"] = req.body.team_id;
      currTime["team_name"] = req.body.team_name;
    }

    io.sockets.emit("timerstart", currTime);
    console.log(currTime);
    count++;
  }, 1000);
  res.send({ timerstatus: 1 });
});

app.post("/pauseTimer", function (req, res) {
  console.log("Stopping timer...");
  clearInterval(clock);
  io.sockets.emit("timerpause", timeToSet);
  res.send({ timerstatus: 0 });
  count = 0;
});

app.post("/resetTimer", function (req, res) {
  if (clock && clock != "") {
    clearInterval(clock);
  }
  minutes = req.body.minutes;
  seconds = req.body.seconds;
  minutes = addLeadingZeros(minutes, 2);
  seconds = addLeadingZeros(seconds, 2);
  var currTime = { minutes: minutes, seconds: seconds };
  currTime["team_id"] = req.body.team_id;
  currTime["team_name"] = req.body.team_name;
  console.log("Reset timer...");
  io.sockets.emit("timerreset", currTime);
  res.send({ timerstatus: 0 });
  count = 0;
});

app.post("/playerBid", function (req, res) {
  var dataToUpdate = req.body;
  console.log("Pushing Player bid to socket", dataToUpdate);
  io.sockets.emit("playerBid", dataToUpdate);
  res.send({ status: 1 });
});

app.post("/playerDrafted", function (req, res) {
  console.log("Pushing to socket", req.body);
  var dataToUpdate = req.body;
  var playerId = dataToUpdate.player_id;
  var categoryId = dataToUpdate.category_id;
  var map_id = dataToUpdate.map_id;
  if (!dataToUpdate["drafted"]) {
    dataToUpdate["is_sold"] = false;
  }
  getPlayerData(playerId, categoryId, map_id).then(function (data) {
    var tempData = data;
    if (tempData && tempData != "") {
      /*try{
				tempData = JSON.parse(data);
			}
			catch(e){
				console.log(e);
				res.send({"status": "Error occurred in pushing to socket"});
				return;
			}*/
      var dataToSend = tempData;
      for (var x in dataToUpdate) {
        //console.log(x);
        var keyName = x;
        console.log("to change", dataToUpdate[keyName]);
        dataToSend[keyName] = dataToUpdate[keyName];
      }

      console.log("Data sent to client -->", dataToSend);
      io.sockets.emit("playerdrafted", dataToSend);
      res.send({ status: "Pushed to Socket successfully!" });
    } else {
      res.send({ status: "Error occurred in pushing to socket" });
    }
  });
});

app.post("/playerReset", function (req, res) {
  console.log("Player reset called");
  var dataToUpdate = req.body;
  io.sockets.emit("playerreset", dataToUpdate);
  res.send({ status: 1 });
});

app.post("/playerPicked", function (req, res) {
  console.log("Pushing Player picked to socket");
  var dataToUpdate = req.body;
  io.sockets.emit("playerpicked", dataToUpdate);
  res.send({ status: 1 });
});

function getPlayerData(player_id, category_id, map_id) {
  return new Promise(function (resolve, reject) {
    console.log("Calling API");
    var data = {
      player_id: player_id,
      map_id: map_id,
      category_id: category_id,
    };
    console.log("post data:", data);
    request.post(
      apiUrl + "api/player/GetPlayerDetailsById",
      {
        json: data,
      },
      (error, res, body) => {
        if (error) {
          console.error(error);
          reject(error);
        }
        if (body) {
          //console.log("res: ",body);
          resolve(body);
        }
      }
    );
  });
}

function processTimer(min, sec) {
  if (min == 00 && sec == 00) {
    /*do nothing*/
  } else if (sec == 00) {
    min = parseInt(min) - 1;
    sec = 59;
  } else {
    sec = parseInt(sec) - 1;
  }
  minutes = min;
  seconds = sec;
  min = addLeadingZeros(min, 2);
  sec = addLeadingZeros(sec, 2);
  if (min == "00" && sec == "00") {
    clearInterval(clock);
    count = 0;
  }
  timeToSet = { minutes: min, seconds: sec };
  return { minutes: min, seconds: sec };
}

function addLeadingZeros(str, max) {
  str = str.toString();
  return str.length < max ? addLeadingZeros("0" + str, max) : str;
}

app.post("/bidPlayer", (req, res) => {
  let data = req.body;
  let msg = "";
  console.log(
    "post request: ",
    moment().format("h:mm:ss a"),
    data.team_id,
    data.player_id
  );

  if (!req.session[`${data.player_id}`]) {
    req.session[`${data.player_id}`] = [data];
    console.log("session:", req.session[`${data.player_id}`]);
    const poppedData = req.session[`${data.player_id}`].shift();
    bidPlayer(req, res, poppedData);
  } else {
    req.session[`${data.player_id}`].push(data);
    console.log("session:", req.session[`${data.player_id}`]);
  }
});

function bidPlayer(req, res, data) {
  getFinalResult(data)
    .then((result) => {
      let status;
      if (result == false) {
        status = 0;
        msg = `Other team already bid for this amount.`;
      } else {
        status = 1;
        msg = `Bid Succesfully.`;
        io.sockets.emit("playerBid", req.body);
      }
      res.send({
        status: status,
        msg: msg,
      });

      if (req.session[`${data.player_id}`].length > 0) {
        const poppedData = req.session[`${data.player_id}`].shift();
        bidPlayer(req, res, poppedData);
      } else {
        //To Do - clear player_id session
      }
    })
    .catch((error) => console.error(error));
}

/**
 * Get final bid status
 * @param {*} data
 */
async function getFinalResult(data) {
  console.log("process for: ", data);
  let response = await getCurrentBid(data);
  let bidResponse = response ? await postBid(data) : response;
  return bidResponse;
}

/**
 * Get last Bid details
 * @param {*} data
 */
function getCurrentBid(data) {
  return new Promise(function (resolve, reject) {
    request.get(
      apiUrl + `api/Auction/GetBidDetails?map_id=${data.map_id}`,
      (error, res, body) => {
        if (error) {
          reject(error);
        }
        if (body && body.length > 0) {
          let prevData = JSON.parse(body)[0] ? JSON.parse(body)[0] : {};

          console.log(
            "current bid: ",
            body,
            data.player_id == prevData.player_id,
            parseInt(data.current_price) <= parseInt(prevData.current_price)
          );
          if (
            data.player_id == prevData.player_id &&
            parseInt(data.current_price) <= parseInt(prevData.current_price)
          ) {
            console.log("Bid Fail", data.team_id);
            resolve(false);
          } else {
            resolve(true);
          }
        } else {
          resolve(true);
        }
      }
    );
  });
}

/**
 * Post Current Bid
 * @param {*} data
 */
function postBid(data) {
  console.log("Bid start ", data.team_id);
  return new Promise(function (resolve, reject) {
    let postData = {
      map_id: data.map_id,
      player_id: data.player_id,
      round_id: data.round_id,
      team_id: data.team_id,
      current_price: data.current_price,
      optype: 1,
    };
    let url = apiUrl + `api/Auction/AddDeleteBid`;
    request.post(
      url,
      {
        json: postData,
      },
      (error, res, body) => {
        if (error) {
          console.error(error);
          reject(error);
        }
        if (body) {
          resolve(true);
        }
      }
    );
  });
}
