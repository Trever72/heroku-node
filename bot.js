// Sensei Bot JavaScript source code
// Created By: Trever Daniels
// Version: 1.1
// Created June 2017
// Last Updated October 14th, 2017

const Discord = require("discord.js");      //the javascript libraries for running discord
const config = require("./config.json");    //local configuration file, set values that may change in the config file not here
//var activity = require("./activity.json");//keeps track of the the bots total uptime, if its currently active, primarily for minor lags in server activity so the bot wont restart
var fs = require("fs");                     //file reading dependencies
const client = new Discord.Client();        //creates a new discord client object
var startTime;                              //the time this bot was started in milliseconds since 1/1/1970
var inactiveTime;                           //the amount of time in milliseconds before a user is considered afk or inactive
var users = {};                             //all the users apart of this guild (a.k.a server)
var modchannel;                             //the admin only chat this bot will post in
var modChannelID;                           //the channel id for this chat
var memberAddDisplay = true;                //will display the new member message if true
var memberRemoveDisplay = false;            //will display the remove member message if true
var saveFile = "./" + config.saveFile;      //the full path name of the default save file
var activityFile = "./activity.json";
var saveOnExit = true;                      //saves the users states when the bot shutdowns
var online = false;

//all client.on functions run asynchronously, meaning that
//the function is run anytime an event or action happens
//on the server

//used to login the bot user
client.login(config.token);

//  Extra stuff for heroku
const express = require("express");
const app = express();

// set the port of our application
// process.env.PORT lets the port be set by Heroku
const port = process.env.PORT || 5000;

// set the view engine to ejs
app.set("view engine", "ejs");

// make express look in the `public` directory for assets (css/js/img)
app.use(express.static(__dirname + "/public"));

// set the home page route
app.get("/", (request, response) => {
    // ejs render automatically looks in the views folder
  response.render("index");
});

app.listen(port, () => {
    // will echo 'Our app is running on http://localhost:5000 when run locally'
  console.log("Our app is running on http://localhost:" + port);
});

var http = require("http");

//tells the bot to stay awake
setInterval(function() {
  http.get("http://senseibot.herokuapp.com/");
}, 300000); // every 5 minutes (300000)

//auto saves every hour
setInterval(function() {
  AutoSave(config.saveFile);
}, 3600000);

//runs once the bot has fully logged in
client.on("ready", () => {
  LoadActivity();

  if(online == false){
    console.log("Sensei Bot Started Successfully!");
    startTime = Date.now();
    //console.log(`Ready to serve in ${client.channels.size} channels on ${client.guilds.size} servers, for a total of ${client.users.size} users.`);
    //console.log(client.channels);
    SetModChannel();
    //var channel = client.channels.find("name", "general");
    modchannel.send("Class is in session!");

    //create initial data structures
    CollectUsers(modchannel.guild);
    SetInactiveTime(48,0,0);
    modchannel.send("Inactive Time Defaulted To: " + CalculatTimeMilliseconds(inactiveTime));
    online = true;
    SaveActivity();
  }
  else{
    modchannel.send("Running Restart Method.");
    SetModChannel();
    LoadUsers(saveFile);
  }
});

function SetModChannel(){
  modchannel = client.channels.find("name", config.modchat);
  modChannelID = modchannel.id;
}

//runs whenever someone joins the server, adds them to the list of users with a default time
client.on("guildMemberAdd", (member) => {
  console.log(`New User "${member.user.username}" has joined "${member.guild.name}"` );
  if(memberAddDisplay){
    modchannel.send(`"${member.user.username}" has joined this server`);
  }
  users[member.user.username] = Date.now();
  console.log(member.user.username + "'s log time has been added");
});

//runs whenever someone leaves or is kicked from the server, removes them to the list of users
client.on("guildMemberRemove", (member) => {
  console.log(`User "${member.user.username}" has been removed from "${member.guild.name}"` );
  delete users[member.user.username];
  if(memberRemoveDisplay){
    modchannel.send(`"${member.user.username}" has been removed from this server`);
  }
  console.log(member.user.username + "'s log time has been removed");
});

//runs whenever someone types a message in any chat on the given server with this bot
client.on("message", (message) => {
  if(message.author.bot) return;
  //add time to user log
  //console.log(message);
  users[message.author.username] = Date.now();
  console.log("updated " + message.author.username + "'s user log time");

  //stop if there is no prefix or if not the admin chat
  if (!message.content.startsWith(config.prefix) || modChannelID != message.channel.id) return;

  //removes the string prefix and sets all sting comparisons to lower case
  message.content = message.content.substring(1).toLowerCase();

  //shows all users in the chat split up by normal and bot users
  if(message.content.startsWith("showusers")){
    var msg = "NON-BOT USERS:\n";
    var botmsg = "\nBOT USERS:\n";
    var members = message.guild.members;
    //console.log(members);
    members.forEach(function(u){
      //console.log("user " + u.user.id);
      //console.log(u.user.username);
      if(u.user.bot == false){
        //console.log("not a bot");
        msg += u.user.username +"\n";
      }
      else{
        botmsg += u.user.username +"\n";
      }
    });

    message.channel.send(msg + botmsg);
  }

  //the amount of time this bot has been active in days, hours, minutes, and seconds
  if (message.content.startsWith("uptime")) {
    var uptime = Date.now() - startTime;
    var ms = uptime;
    //message.channel.send("milliseconds: " + ms);
    var seconds = Math.floor(ms / 1000);
    var minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    var hours = Math.floor(minutes / 60);
    minutes = minutes % 60;
    var days = Math.floor(hours / 24);
    hours = hours % 24;

    message.channel.send(days + " days, " + hours + " hours, " + minutes + " minutes, " + seconds + " seconds");
  }

  //sets the amount of time a user can be inactive before being added to the audit log, displays appropriate warnings
  if (message.content.startsWith("setinactivetime")) {
    message.content = message.content.replace("setinactivetime", "");
    var time = message.content.split(":");
    //console.log(+time[0],+time[1],+time[2]);

    //error logging
    if(time.length != 3){
      message.channel.send("You did not input the appropriate number of time signatures, please try again!");
      return;
    }
    else if(isNaN(+time[0]) || isNaN(+time[1]) || isNaN(+time[2])){
      message.channel.send("one of these values is not a number, please try again!");
      return;
    }

    SetInactiveTime(+time[0],+time[1],+time[2]);

    message.channel.send("Inactive Time now set to " + CalculatTimeMilliseconds(inactiveTime));
  }

  //saves the user object to a local JSON file
  if (message.content.startsWith("saveusers")) {
    var fileToSave = saveFile;

    SaveUsers(fileToSave);

    DisplayUserTimes(message.channel);
  }

  //loads users into the bot from a local JSON file
  if (message.content.startsWith("loadusers")) {
    var fileToLoad = saveFile;

    LoadUsers(fileToLoad);

    DisplayUserTimes(message.channel);
  }

  //displays the current inactive time
  if (message.content.startsWith("showinactivetime")) {
    message.channel.send("Inactive Time: " + CalculatTimeMilliseconds(inactiveTime));
  }

  //displays the list of all users in the server and their current times
  if (message.content.startsWith("generateuserlog")) {
    DisplayUserTimes(message.channel);
  }

  //displays a list of users who have exceeded the inactive time minimum
  if (message.content.startsWith("generateauditlog")) {
    DisplayAuditTimes(message.channel);
  }

  //gathers the current state of users for data monitoring
  if (message.content.startsWith("collectusers")) {
    CollectUsers(modchannel.guild);
    message.channel.send("Internal User Registration properly calibrated");
    DisplayUserTimes(message.channel);
  }

  //empties the list of users
  if (message.content.startsWith("clearusers")) {
    ClearUsers();
    message.channel.send("Internal User Registration Cleared (run !CollectUsers to recalibrate)");
  }

  //shutsdown the bot and displays a status message, saves user state if set to true
  if (message.content.startsWith("shutdown")) {
    online = false;

    if(saveOnExit){
      SaveUsers(saveFile);
    }
    else{
      SaveActivity();
    }

    message.channel.send("class dismissed");
    setTimeout(function(){
      process.exit();
    }, 5000);
  }

  //turns the save on exit function on or off
  if (message.content.startsWith("togglesaveonexit")) {
    saveOnExit = !saveOnExit;
    message.channel.send("Save On Exit: " + memberAddDisplay);
  }

  //turns the new user message on or off, used for when a new user joins the server
  if (message.content.startsWith("toggleaddmessage")) {
    memberAddDisplay = !memberAddDisplay;
    message.channel.send("Display New Member Message: " + memberAddDisplay);
  }

  //turns the remove user message on or off, used for when a user is kicked or leaves
  if (message.content.startsWith("toggleremovemessage")) {
    memberRemoveDisplay = !memberRemoveDisplay;
    message.channel.send("Display Member Removed Message: " + memberAddDisplay);
  }

  //displays the contents of the help txt file
  if (message.content.startsWith("help")) {
    fs.readFile(config.help, "utf8", function(error, data) {
      message.channel.send(data);
    });
  }

  //displays contents of activity.json in a readable format
  if(message.content.startsWith("activity")){
    var fileContents = fs.readFileSync(activityFile, "utf8");
    try{
      var loadedJSON = JSON.parse(fileContents);
    } catch (err){
      console.error(err);
      modchannel.send("File Error: " + err);
      modchannel.send(fileContents);
      modchannel.send(loadedJSON);
      return;
    }
    if(loadedJSON.length <= 0){
      modchannel.send("Activity file is empty");
      return;
    }

    var act = loadedJSON;
    var txt = "";

    txt += "Online: " + act["online"] + "\n";
    txt += "Start Time: " + CalculatTimeMilliseconds(act["startTime"]) + "\n";
    txt += "Inactive Time: " + CalculatTimeMilliseconds(act["inactiveTime"]) + "\n";

    modchannel.send(txt);
  }

  //manualy loads the activity file into the bot's local memory
  if(message.content.startsWith("loadActivity")){
    LoadActivity();
    modchannel.send("Activity loaded into local memory");
  }

  /*
  vvv All Chat Commands vvv
  */

  //silly chat command
  if (message.content.startsWith("hello")) {
    modchannel.send(message.author + " sup");
  }

  //silly chat command
  if (message.content.startsWith("ping")) {
    message.channel.send("pong!");
  }

  //silly chat command
  if (message.content.startsWith("howareyou")) {
    message.channel.send("I'm feeling dandy! How are you?");
  }
});

//sets the inactiveTime in milliseconds
function SetInactiveTime(hours, minutes, seconds){
  var sec = (hours * 60000 * 60) + (minutes * 60000) + (seconds * 1000);
  inactiveTime = sec;
  SaveActivity();
}

//calculates the hours, minutes, and seconds given a Date.now() time
function CalculateTime(time){
  var uptime = Date.now() - time;
  var ms = uptime;
  var seconds = Math.floor(ms / 1000);
  var minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  var hours = Math.floor(minutes / 60);
  minutes = minutes % 60;

  return hours + " hours, " + minutes + " minutes, " + seconds + " seconds";
}

//calculates the hours, minutes, and seconds, given a time in milliseconds
function CalculatTimeMilliseconds(time){
  var ms = time;
  var seconds = Math.floor(ms / 1000);
  var minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  var hours = Math.floor(minutes / 60);
  minutes = minutes % 60;

  return hours + " hours, " + minutes + " minutes, " + seconds + " seconds";
}

//removes all users from the users list
function ClearUsers(){
  users.clear();
}

//gathers all users currently in the server
function CollectUsers(guild){
  //console.log(guild.members);
  modchannel.send("Collecting users in " + guild.name);

  guild.members.forEach(function(u){
    if(u.user.bot == false && !(u.user.username in users)){
      users[u.user.username] = Date.now();
    }
  });
}

//Saves users to the designated JSON file
function SaveUsers(filename){
  if(!fs.existsSync(filename)){
    modchannel.send("Save file does not exist");
    return;
  }
  var displayName = filename.substring(2);
  modchannel.send("Saving file " + displayName + " ...");

  Save(filename);

  modchannel.send("Users Saved to " + displayName);
}

//auto saves all userfiles and activity variables
function AutoSave(filename){
  if(!fs.existsSync(filename)){
    modchannel.send("AutoSave file does not exist");
    return;
  }

  Save(filename);

  modchannel.send("Autosaved file");
}

function Save(filename){

  fs.writeFile(filename, JSON.stringify(users), (err) => {
    if(err) console.error(err);
  });

  SaveActivity();
}

function SaveActivity(){
  if(!fs.existsSync(activityFile)){
    modchannel.send("Activity file does not exist");
    return;
  }

  var act = {
    "online": online,
    "startTime": startTime,
    "inactiveTime": inactiveTime
  };

  fs.writeFile(activityFile, JSON.stringify(act), (err) => {
    if(err) console.error(err);
  });
}

//Loads users into the designated JSON file
function LoadUsers(filename){
  if(!fs.existsSync(filename)){
    modchannel.send("Load file does not exist");
    return;
  }
  var displayName = filename.substring(2);
  modchannel.send("Loading file " + displayName + " ...");
  var fileContents = fs.readFileSync(filename, "utf8");
  try{
    var loadedJSON = JSON.parse(fileContents);
  } catch (err){
    console.error(err);
    modchannel.send("File Error: " + err);
    return;
  }
  if(loadedJSON.length <= 0){
    modchannel.send("This file is empty");
    return;
  }

  users = loadedJSON;

  modchannel.send("Users Loaded from " + displayName);
}

function LoadActivity(){
  if(!fs.existsSync(activityFile)){
    modchannel.send("Activity file does not exist");
    return;
  }

  var fileContents = fs.readFileSync(activityFile, "utf8");
  try{
    var loadedJSON = JSON.parse(fileContents);
  } catch (err){
    console.error(err);
    modchannel.send("File Error: " + err);
    return;
  }
  if(loadedJSON.length <= 0){
    modchannel.send("Activity file is empty");
    return;
  }

  var act = loadedJSON;

  online = act["online"];
  startTime = act["startTime"];
  inactiveTime = act["inactiveTime"];
}

//displays all users in the user list, does not include bots
function DisplayUserTimes(channel){
    //console.log(users);
  var msg = "User Times:\n";
  var count = 0;
  Object.entries(users).forEach(([key, value])=>{
    msg += key + " - " + CalculateTime(value) + "\n";
    count += 1;
    if(count > 10){
      channel.send(msg);
      msg = "";
      count = 0;
    }
  });

  channel.send(msg);
}

//displays all users who have exceeded the inactivity time
function DisplayAuditTimes(channel){
  var msg = "Inactive Time: " + CalculatTimeMilliseconds(inactiveTime) + "\n";
  msg += "__**Audit Log:**__\n";

  var count = 0;
  Object.entries(users).forEach(([key, value])=>{
    var currTime = Date.now() - value;
    if(currTime > inactiveTime){
      msg += key + " - " + CalculateTime(value) + "\n";
      count += 1;
      if(count > 10){
        channel.send(msg);
        msg = "";
        count = 0;
      }
    }
  });

  channel.send(msg);
}
