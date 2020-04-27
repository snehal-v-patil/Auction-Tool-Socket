var fs = require("fs");
var http = require("http");
var socketio = require("socket.io");
var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var request = require("request");
const moment = require("moment");
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

var io = socketio.listen(server);
var connectCounter = 0;
var initScore = "";

var clock = "";
var timeToSet = "";
var minutes = "";
var seconds = "";
var count = 0;

let prevData = {};
let next = true;
let SameRequest = [];
let CurrentRequest = "";

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
  console.log("Pushing Player bid to socket");
  var dataToUpdate = req.body;
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
    "post request resived ",
    moment().format("h:mm:ss a"),
    data.team_id
  );
  if (next) {
    CurrentRequest = data;
    next = false;
    getFinalResult(data)
      .then((result) => {
        if (result == false) {
          msg = `player already bid for this amount.`;
        } else {
          msg = `Bid Succesfull`;
        }
        next = true;
        res.send({
          msg: msg,
          time: moment().format("h:mm:ss a"),
        });
      })
      .catch((error) => console.error(error));
  } else {
    if (
      CurrentRequest.map_id == data.map_id &&
      CurrentRequest.player_id == data.player_id &&
      CurrentRequest.bid_amount == data.bid_amount
    ) {
      SameRequest.push(data);
      res.send({
        msg: `player already bid for this amount.`,
        time: moment().format("h:mm:ss a"),
      });
    }
  }
});

/*async function postBid(data) {
  let msg = "";
  let response = await new Promise(function (resolve, reject) {
    console.log(prevData, data);
    if (
      data.player_id === prevData.player_id &&
      data.bid_amount === prevData.bid_amount
    ) {
      msg = `player already bid for this amount by team ${prevData.team_id}`;
      resolve(msg);
    } else {
      let postData = {
        map_id: 20,
        player_id: data.player_id,
        round_id: data.round_id,
        team_id: data.team_id,
        current_price: data.bid_amount,
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
          if (res) {
            console.log("res: ", body);
            prevData = data;
            msg = `Bid Succesfull`;
            resolve(msg);
          }
        }
      );
    }
  });
  return response;
}*/

/**
 * Get final bid status
 * @param {*} data
 */
async function getFinalResult(data) {
  let response = await getCurrentBid(data);
  if (response == true) {
    console.log("Bid start");
    let bidResponse = await postBid(data);
    return bidResponse;
  } else {
    console.log("Bid Stop");
    return response;
  }
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
          console.log("current bid: ", body);
          let prevData = JSON.parse(body)[0] ? JSON.parse(body)[0] : {};
          if (
            data.player_id == prevData.player_id &&
            parseInt(data.bid_amount) <= parseInt(prevData.current_price)
          ) {
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
  return new Promise(function (resolve, reject) {
    let postData = {
      map_id: data.map_id,
      player_id: data.player_id,
      round_id: data.round_id,
      team_id: data.team_id,
      current_price: data.bid_amount,
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
