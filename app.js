
// dependencies

var path = require('path');
//var http = require('http');
//var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var exec = require("child_process").exec;
var express = require('express.io');
var mongoose = require('mongoose');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var sensorLib = require('node-dht-sensor');
var moment = require('moment');
var nodemailer = require('nodemailer');
var cookieParser = require('cookie-parser');
var serveIndex = require('serve-index');
var ads1x15 = require('node-ads1x15');

// main config
 
var options = { 
      key : fs.readFileSync('./cert/private.key'),
      cert : fs.readFileSync('./cert/certificate.pem'),
      requestCert: true
    };

var app=express().https(options).io();
 
app.set('port', process.env.PORT || 443);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', { layout: false });

app.use(express.logger());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(cookieParser(require('./config/secret')()));
app.use(express.session({secret: require('./config/secret')()}));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

//directory index for logs...
app.use(express.static(path.join(__dirname, 'public')));
app.use('/logs', serveIndex('public/logs', {'icons': true}));

//alarm variables

//Zone 1

var pinZone1 = 23;
var pinZone2 = 24;
var pinZone3 = 10;
var pinZone4 = 16;
var pinZone5 = 20;
var pinZone6 = 21;

var pinEntryZone1 = 5;
var pinEntryZone2 = 6;
var pinEntryZone3 = 13;

var pinFireZone1 = 9;

var pinDoorStriker = 17; //pin for door striker
var pinRelay = 22;       //alt relay (UI/socket not yet implemented. just add the button and socket callback to use...)
var pinAlarm = 12;       //pin for Alarm (hook siren/light to this pin, via relay if necessary)

var zone1Active = false;
var zone2Active = false;
var zone3Active = false;
var zone4Active = false;
var zone5Active = false;
var zone6Active = false;

var entry1Active = false;
var entry2Active = false;
var entry3Active = false;

var entryCamActive = false;

var smoke1Active = false;
var co1Active = false;
var gas1Active = false;
var fire1Active = false;

//analog sensor channels - we have 4 on the ADS1015 so there's an extra one in there to play with.
var smokeADCChannel = -1;
var coADCChannel = -1;
var gasADCChannel = 3;

var smokePPM = 0;
var coPPM = 0;
var gasPPM = 0;

var sTemp = 0; //degrees C
var sHum = 0; //Percent %

var secAlert = false;
var fireAlert = (smoke1Active || co1Active);

var smokeThreshold = 100; //alert if over 100ppm
var coThreshold = 10; //alert if over 10PPM
var gasThreshold = 500; //alert if over 500ppm

var lastAlertTime = new Date() - 300000;

var secAlertSent = new Date() - 300000;
var fireAlertSent = new Date() - 300000;

var sendUser = 'sending@email.com';
var sendPassword = 'Sending-email-passowrd';
var recipients = 'recip1@domain.bogus, recip2@domain.bogus';

// create reusable transporter object using SMTP transport
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: sendUser,
        pass: sendPassword
    }
});

 
app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});
 
app.configure('production', function(){
    app.use(express.errorHandler());
});


// passport config
var Account = require('./models/account');
passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

// mongoose
mongoose.connect('mongodb://localhost/passport_local_mongoose');

// routes
require('./routes')(app);

var piREST = require('pi-arest-mod')(app);
piREST.set_id('74280829719');
piREST.set_name('pi_alarm_742b');

//status (Do this synchronously or we'll have issues...)
var armed = fs.readFileSync('./config/status.txt').toString(); //will try to create as buffer...

piREST.variable('armed', armed);
console.log('Status Loaded... Armed: ' + armed);
  

// if booting ARMED, then send off a warning email...
if(armed != 'Disarmed')
{
  var msg = 'WARNING: System Compromised. Node-Pi-Alarm Restarted ARMED! To avoid this notification, DISARM before bouncing system.';
  // setup e-mail data with unicode symbols
  var mailOptions = {
      from: 'Pi Security Alarm ✔ <' + sendUser +'>', // sender address
      to: recipients, // list of receivers
      subject: 'Security Alert! ✔', // Subject line
      text: msg, // plaintext body
      html: '<b>' + msg + '</b>' // html body
  };
  // send mail with defined transport object
  transporter.sendMail(mailOptions, function(error, info){
    if(error){
      console.log(error);
    }else{
      console.log('Message sent: ' + info.response);
    }
  });
}

var adc = new ads1x15();

setInterval(function() {
  //gas
  if(gasADCChannel >= 0)
  {
    adc.readADCSingleEnded(gasADCChannel, "4096", "250", function(err, data) {
      if(err)
      {
        throw err;
      }

      console.log('Combustible Sensor Raw Reading: ' + data);

      // MQ-2 or MQ-4 gas sensor (MQ-4 only detects Propane/Methane/Butane, MQ-2 sees H2, smoke, etc.)

      // MQ-2 is sensitive from 10-10000PPM. MQ-4 is 200-10000PPM. But the floor raw reading needs to be subtracted (and an additional couple to keep it from reading 
      //   2ppm all the time) then, we dump propane on the sensor and see it maxes out at just under 3900 (subtract our 580 from that too...)
      //   the below may not be perfect, but gives us a ballpark reading...

      // AFA calibration, what I suggest is-
      //    - look at the console and set the sensitivity of your sensor to read around 180 in clean air (after warming up for 15 min.)
      //    - test it using a butane lighter, (don't ignite the lighter, just blow butane on the sensor. Make sure when doused the raw reading (in the console) 
      //        gets to at least 3500
      //    - Make sure that the reading returns to the same 'floor' level. 
    
    
      var floor = 226;  
      if((data - floor) < 0)
      {
        gasPPM = 0;
      }
      else
      {
        gasPPM = parseInt((((data - floor) * 10000) / 3600) + 10); //detection starts at 10 PPM so start there
      }
      piREST.variable('gas', gasPPM);
      console.log("Gas sensor reading calculated at: " + gasPPM + " PPM"); 
    });
  }

  //smoke 
  if(smokeADCChannel >= 0)
  {
    adc.readADCSingleEnded(smokeADCChannel, "4096", "250", function(err, data) {
      if(err)
      {
        throw err;
      }

      console.log('Smoke Sensor Raw Reading: ' + data);

      // MQ-135 is sensitive from 10-200PPM. But the floor raw reading needs to be subtracted (and an additional couple to keep it from reading 2ppm all the time) then,
      // we dump propane on the sensor and see it maxes out at just under 3900 (subtract our 580 from that too...)
      //the below may not be perfect, but gives us a ballpark reading...
      //What I suggest is-
      //    - look at the console and set the sensitivity of your sensor to read around 180 in clean air (after warming up for 15 min.)
      //    - test it using a punk, cigarette or canned smoke. Make sure when doused the raw reading gets to at least 3500.
      
      
      var floor = 200;  
      if((data - floor) < 0)
      {
        smokePPM = 0;
      }
      else
      {
        smokePPM = parseInt((((data - floor) * 200) / 3600) + 10); //detection starts at 10 PPM so start there
      }
      piREST.variable('smoke', smokePPM);
      console.log("Smoke sensor reading calculated at: " + smokePPM + " PPM"); 
    });
  }
  if(coADCChannel >= 0)
  {
    adc.readADCSingleEnded(coADCChannel, "4096", "250", function(err, data) {
      if(err)
      {
        throw err;
      }

      console.log('CO Sensor Raw Reading: ' + data);
      // MQ-7 is sensitive from 10-10000PPM. But the floor raw reading needs to be subtracted (and an additional couple to keep it from reading 2ppm all the time) then,
      // we dump propane on the sensor and see it maxes out at just under 3900 (subtract our 580 from that too...)
      //the below may not be perfect, but gives us a ballpark reading...
      //What I suggest is-
      //    - look at the console and set the sensitivity of your sensor to read around 180 in clean air (after warming up for 15 min.)
      //    - test it using a can of 'CO test'. (Smoke also contains CO, but will be more difficult to calibrate.) Make sure when doused the raw reading gets to at least 3500
     
      // Note also the heater circuit for this sensor needs to run at 5V for 60 seconds, then 1.5V for 90 seconds, then repeat.
      //   So it needs a driver circuit or 1 PWM out + logic level mosfet at the very least to drive it properly.
      //   Also because of this it might be a good idea to only trip the environmental alarm if the average reading over several minutes trips the threshold?
      //   (but perhaps trip immediately if a certain ration of n * threshold is reached? So if the threshold is 10PPM, then maybe -
      //
      //       trip if average over 3 minutes exceeds 10PPM or instantaneous reading exceeds 30PPM?

      var floor = 200;  
      if((data - floor) < 0)
      {
        coPPM = 0;
      }
      else
      {
        coPPM = parseInt((((data - floor) * 10000) / 3600) + 10); //detection starts at 10 PPM so start there
      }
      piREST.variable('co', coPPM);
      console.log("CO sensor reading calculated at: " + coPM + " PPM"); 
    });
  }
}, 5000);

// Make measurements from sensors
var dht_sensor = {
    initialize: function () {
        return sensorLib.initialize(11, 4);
    },
    read: function () {
        var readout = sensorLib.read();
        
        piREST.variable('temperature',readout.temperature.toFixed(2));
        piREST.variable('humidity', readout.humidity.toFixed(2));
        
        console.log('Temperature: ' + readout.temperature.toFixed(2) + 'C, ' +
            'humidity: ' + readout.humidity.toFixed(2) + '%');
        setTimeout(function () {
            dht_sensor.read();
        }, 2000);
    }
};

if (dht_sensor.initialize()) {
    dht_sensor.read();
} else {
    console.warn('Failed to initialize sensor');
}

//push ALARM sensor data to pi-REST
setInterval(function() {
       
        if(armed == 'Armed Away')
        {
          if(zone1Active || zone2Active || zone3Active || zone4Active || zone5Active || zone6Active || 
            entry1Active || entry2Active || entry3Active)
          {
            secAlert = true;
          }
          else secalert = false;

        }
        else if(armed == 'Armed Home') //do not check Zones. Just entries
        {
          if(entry1Active || entry2Active || entry3Active)
          {
            secAlert = true;
          }
          else secAlert = false;

        }
        else secAlert = false;
      
        piREST.variable('armed', armed);
        piREST.variable('secalert', secAlert);

}, 8000);

//gas sensor stuff goes here
setInterval(function() {
        if(coPPM >= coThreshold)
        {
          co1Active = true;
          fireAlert = true;
          lastAlertTime = moment();
        }        
        if(smokePPM >= smokeThreshold)
        {
          smoke1Active = true;
          fireAlert = true;
          lastAlertTime = moment();
        }  
        if(gasPPM >= gasThreshold)
        {
          gas1Active = true;
          fireAlert = true;
          lastAlertTime = moment();
        }  
        if(fire1Active)
        {
          fireAlert = true;
          lastAlertTime = moment();
        }  
        piREST.variable('smoke',smokePPM);
        piREST.variable('co', coPPM);
        piREST.variable('gas', gasPPM);
        piREST.variable('smokeactive',smoke1Active);
        piREST.variable('coactive', co1Active);
        piREST.variable('gasactive', gas1Active);   
        piREST.variable('fireactive'. fire1Active);    
        piREST.variable('firealert', fireAlert);

}, 10000);

//clean entry images dir as they come in
setInterval(function() {

  fs.readdir("./public/pictures/entry", function(err, files){
     if(err) {
      console.log("File Read Error: " + err);
      throw err;
     }
     for(var i in files) {
       if(files[i] != "image.jpg")
       {
          console.log("File: " + files[i] + " - scanned");
          var nm = path.join("./public/pictures/entry", files[i]);
          if(fs.existsSync("./public/pictures/entry/image.jpg"))
          {
            fs.unlinkSync("./public/pictures/entry/image.jpg");
            if(armed == 'Armed Away' || armed == 'Armed Home')
            {
              secAlert = true;
              entryCamActive = true;
            }
          }
          fs.renameSync(nm, "./public/pictures/entry/image.jpg");
          console.log("Moved file: " + files[i] + " to image.jpg");
       }
     }
     console.log("File cleanup Done: ");
  });

  if(secAlert || fireAlert)
  {
    var d = new Date();
    var ms = d - lastAlertTime;
    if(ms > 360000) //self-reset after 6 minutes.
    {
       fireAlert = false;
       secAlert = false;
       piREST.variable('secalert', false); 
       piREST.variable('firealert', false); 
     }

    if(ms > 10000) //reset sensors every 10 seconds
    {
       zone1Active = false;
       zone2Active = false;
       zone3Active = false;
       zone4Active = false;
       zone5Active = false;
       zone6Active = false;
       entry1Active = false;
       entry2Active = false;
       entry3Active = false;
       smoke1Active = false;
       co1Active = false;
       gas1Active = false;
       fire1Active = false;
     
       piREST.variable('zone1', false); 
       piREST.variable('zone2', false); 
       piREST.variable('zone3', false); 
       piREST.variable('zone4', false); 
       piREST.variable('zone5', false); 
       piREST.variable('zone6', false); 
       piREST.variable('entry1', false); 
       piREST.variable('entry2', false); 
       piREST.variable('entry3', false); 

       piREST.variable('smokeactive', false); 
       piREST.variable('coactive', false); 
       piREST.variable('gasactive', false); 
       piREST.variable('fireactive', false); 
     }
  }

}, 10000);


//initialize ALARM sensors

  //set pullups...


  var gpio = "gpio";

  function handleExecResponse(method, pinNumber, callback) {
	return function(err, stdout, stderr) {
		if(err) {
			console.error("Error when trying to", method, "pin", pinNumber);
			console.error(stderr);
			callback(err);
		} else {
			callback();
		}
	}
  }

  exec(gpio + " -g mode  " + pinEntryZone1 + " in", handleExecResponse("pullup", pinEntryZone1, function(err) {
			if(err)
                        {
                          console.log("Error: " + err);
                        } else console.log("Pin Entry Zone 1 exported");
		}));

  exec(gpio + " -g mode  " + pinEntryZone2 + " up", handleExecResponse("pullup", pinEntryZone2, function(err) {
			if(err)
                        {
                          console.log("Error: " + err);
                        } else console.log("Pin Entry Zone 2 exported");
		}));

  exec(gpio + " -g mode  " + pinEntryZone3 + " up", handleExecResponse("pullup", pinEntryZone3, function(err) {
			if(err)
                        {
                          console.log("Error: " + err);
                        } else console.log("Pin Entry Zone 3 exported");
		}));

  exec(gpio + " -g mode  " + pinFireZone1 + " up", handleExecResponse("pullup", pinFireZone1, function(err) {
			if(err)
                        {
                          console.log("Error: " + err);
                        } else console.log("Pin Fire Zone 1 exported");
		}));

  exec(gpio + " -g mode  " + pinEntryZone1 + " up", handleExecResponse("pullup", pinEntryZone1, function(err) {
			if(err)
                        {
                          console.log("Error: " + err);
                        } else console.log("Pin Entry Zone 1 pullup set");
		}));

  exec(gpio + " -g mode  " + pinEntryZone2 + " up", handleExecResponse("pullup", pinEntryZone2, function(err) {
			if(err)
                        {
                          console.log("Error: " + err);
                        } else console.log("Pin Entry Zone 2 pullup set");
		}));

   exec(gpio + " -g mode  " + pinEntryZone3 + " up", handleExecResponse("pullup", pinEntryZone3, function(err) {
			if(err)
                        {
                          console.log("Error: " + err);
                        } else console.log("Pin Entry Zone 3 pullup set");
		}));

  exec(gpio + " -g mode  " + pinFireZone1 + " up", handleExecResponse("pullup", pinFireZone1, function(err) {
			if(err)
                        {
                          console.log("Error: " + err);
                        } else console.log("Pin Fire Zone 1 pullup set");
		}));



var Gpio = require('onoff').Gpio,
  ioZone1 = new Gpio(pinZone1, 'in', 'both'),
  ioZone2 = new Gpio(pinZone2, 'in', 'both'),
  ioZone3 = new Gpio(pinZone3, 'in', 'both'),
  ioZone4 = new Gpio(pinZone4, 'in', 'both'),
  ioZone5 = new Gpio(pinZone5, 'in', 'both'),
  ioZone6 = new Gpio(pinZone6, 'in', 'both'),
  ioEntryZone1 = new Gpio(pinEntryZone1, 'in', 'both'),
  ioEntryZone2 = new Gpio(pinEntryZone2, 'in', 'both'),
  ioEntryZone3 = new Gpio(pinEntryZone3, 'in', 'both'),
  ioFireZone1 = new Gpio(pinFireZone1, 'in', 'both'),
  ioRelayDoor = new Gpio(pinDoorStriker, 'out'),
  ioRelayAlt = new Gpio(pinRelay, 'out'),
  ioAlarm = new Gpio(pinAlarm, 'out');

  ioRelayDoor.writeSync(0);
  ioRelayAlt.writeSync(0);
  ioAlarm.writeSync(0);

function cleanUpandSave() {

  // release GPIOs
  ioZone1.unexport();
  ioZone2.unexport();
  ioZone3.unexport();
  ioZone4.unexport();
  ioZone5.unexport();
  ioZone6.unexport();

  ioEntryZone1.unexport();
  ioEntryZone2.unexport();
  ioEntryZone3.unexport();

  ioFireZone1.unexport();
  ioRelayDoor.unexport();
  ioRelayAlt.unexport();
  ioAlarm.unexport();

  process.exit();
}
//now IO zones...
ioZone1.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('zone1', value);  
  zone1Active = value;
  console.log("Value of Zone 1 Pin: " + value + ", ");
});

ioZone2.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('zone2', value);  
  zone2Active = value;
  console.log("VValue of Zone 2 Pin: " + value + ", ");
});

ioZone3.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('zone3', value);  
  zone3Active = value;
  console.log("Value of Zone 3 Pin: " + value + ", ");
});

ioZone4.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('zone4', value);  
  zone4Active = value;
  console.log("VValue of Zone 4 Pin: " + value + ", ");
});

ioZone5.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('zone5', value);  
  zone5Active = value;
  console.log("Value of Zone 5 Pin: " + value + ", ");
}); 

ioZone6.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('zone6', value);  
  zone6Active = value;
  console.log("Value of Zone 6 Pin: " + value + ", ");
});

ioEntryZone1.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('entry1', value);  
  entry1Active = value;
  console.log("Value of Entry Zone 1 Pin: " + value + ", ");
});

ioEntryZone2.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('entry2', value);  
  entry2Active = value;
  console.log("VValue of Entry Zone 2 Pin: " + value + ", ");
});

//ioEntryZone3.watch(function (err, value) {
//  if(err)
//  { 
//    console.log("Error: " + err);
//  }
//  piREST.variable('entry3', !(value));  
//  entry3Active = !(value);
//  console.log("Value of Entry Zone 3 Pin: " + value + ", ");
//});

ioFireZone1.watch(function (err, value) {
  if(err)
  { 
    console.log("Error: " + err);
  }
  piREST.variable('fireactive', !(value));  
  entry3Active = !(value);
  console.log("Value of Fire Zone 1 pin: " + value + ", ");
});


process.on('SIGINT', cleanUpandSave);

//this loop is for notifications/logging of alerts
setInterval(function() {
  d = new Date();
  if(armed == 'Armed Away')
  {
    //enable security alerts as well as smoke/CO
    if(secAlert)
    {
       var sDate = moment().format('MMDDYYYY')
       var logFile = "./public/logs/alarms-" + sDate + ".txt" ;
       //check if exists first and create if necessary
       fs.exists(logFile, function(exists) {
         if(!exists)
         {
          //create
           fs.writeFile(logFile, "LOG file for: " + sDate, function(err) {
             if(err)
             {
               throw err;
             }

           });
         }
       });
       //now create and append alert string
       var logMsg = "ALERT: " + moment().format('MM-DD-YYYY') + " SEC from sensors: "
       if(zone1Active)
       {
         logMsg += "Zone 1(Kitchen), ";
       }
       if(zone2Active)
       {
         logMsg += "Zone 2(Living Room), ";
       }
       if(zone3Active)
       {
         logMsg += "Zone 3(Bathroom), ";
       }
       if(zone4Active)
       {
         logMsg += "Zone 4(Entry Room), ";
       }
       if(zone5Active)
       {
         logMsg += "Zone 5(Project Room), ";
       }
       if(zone6Active)
       {
         logMsg += "Zone 6(Sun Room), ";
       }
       if(entry1Active)
       {
         logMsg += "Entry 1(Kitchen Window), ";
       }
       if(entry2Active)
       {
         logMsg += "Entry 2(Front Door), ";
       }
       if(entry3Active)
       {
         logMsg += "Entry 3(Sun Room Window) ";
       }
       if(entryCamActive)
       {
         logMsg += "Movement detected at entry camera! ";
         entryCamActive = false;
       }

       fs.appendFile(logFile, logMsg, function(err) {
         if(err)
         {
           throw err;
         }
       });
       // setup e-mail data with unicode symbols
       var mailOptions = {
           from: 'Pi Security Alarm ✔ <' + sendUser +'>', // sender address
           to: recipients, // list of receivers
           subject: 'Security Alert! ✔', // Subject line
           text: logMsg, // plaintext body
           html: '<b>'+ logMsg + '</b>' // html body
       };

       // check time since last Alert.
       var ms = d - secAlertSent;
       if(ms > 300000)
       {
         // send mail with defined transport object
         transporter.sendMail(mailOptions, function(error, info){
             if(error){
                 console.log(error);
             }else{
                 console.log('Message sent: ' + info.response);
                 secAlertSent = d;
             }
         });
         console.log(logMsg);
       }

    }

  }
  else if(armed == 'Armed Home')
  {
    //enable security alerts as well as smoke/CO
    if(secAlert)
    {
       var sDate = moment().format('MMDDYYYY')
       var logFile = "./public/logs/alarms-" + sDate + ".txt" ;
       //check if exists first and create if necessary
       fs.exists(logFile, function(exists) {
         if(!exists)
         {
          //create
           fs.writeFile(logFile, "LOG file for: " + sDate, function(err) {
             if(err)
             {
               throw err;
             }

           });
         }
       });
       //now create and append alert string
       var logMsg = "ALERT: " + moment().format('MM-DD-YYYY') + " SEC from sensors: "
       if(entry1Active)
       {
         logMsg += "Entry 1(Kitchen Window), ";
       }
       if(entry2Active)
       {
         logMsg += "Entry 2(Front Door), ";
       }
       if(entry3Active)
       {
         logMsg += "Entry 3(Sun Room Window) ";
       }

       if(entryCamActive)
       {
         logMsg += "Movement detected at entry camera! ";
         entryCamActive = false;
       }

       fs.appendFile(logFile, logMsg, function(err) {
         if(err)
         {
           throw err;
         }
       });
       // setup e-mail data with unicode symbols
       var mailOptions = {
           from: 'Pi Security Alarm ✔ <' + sendUser +'>', // sender address
           to: recipients, // list of receivers
           subject: 'Security Alert! ✔', // Subject line
           text: logMsg, // plaintext body
           html: '<b>'+ logMsg + '</b>' // html body
       };

       // check time since last Alert.
       var ms = d - secAlertSent;
       if(ms > 300000)
       {
         // send mail with defined transport object
         transporter.sendMail(mailOptions, function(error, info){
             if(error){
                 console.log(error);
             }else{
                 console.log('Message sent: ' + info.response);
                 secAlertSent = d;
             }
         });
         console.log(logMsg);
       }

    }

  }
    //alerts for smoke and CO
    if(fireAlert)
    {
       ioAlarm.writeSync(1);
       var sDate = moment().format('MMDDYYYY')
       var logFile = "./public/logs/alarms-" + sDate + ".txt" ;
       //check if exists first and create if necessary
       fs.exists(logFile, function(exists) {
         if(!exists)
         {
          //create
           fs.writeFile(logFile, "LOG file for: " + sDate, function(err) {
             if(err)
             {
               throw err;
             }
            });
         }
       });
       //now create and append alert string
       var logMsg = "ALERT: " + moment().format('MM-DD-YYYY') + " FIRE/CO from sensors: "
       if(fire1Active)
       {
         logMsg += "Rate of Rise(Fire Sensor) Tripped! ";
       }
       if(smoke1Active)
       {
         logMsg += "S1(smoke at: " + smokePPM + " PPM), ";
       }
       if(co1Active)
       {
         logMsg += "CO1(CO at: " + coPPM + " PPM), ";
       }
       if(gas1Active)
       {
         logMsg += "Combustible Gases (Propane/NG at: " + gasPPM + " PPM) ";
       }       
       fs.appendFile(logFile, logMsg, function(err) {
         if(err)
         {
           throw err;
         }
       });
       // setup e-mail data with unicode symbols
       var mailOptions = {
           from: 'Pi Security Alarm ✔ <' + sendUser +'>', // sender address
           to: recipients, // list of receivers
           subject: 'Smoke/CO Alert! ✔', // Subject line
           text: logMsg, // plaintext body
           html: '<b>'+ logMsg + '</b>' // html body
       };
       // check time since last Alert.
       var ms = d - fireAlertSent;
       if(ms > 300000)
       {
         // send mail with defined transport object
         transporter.sendMail(mailOptions, function(error, info){
             if(error){
                 console.log(error);
             }else{
                 console.log('Message sent: ' + info.response);
                 fireAlertSent = d;
             }
         });
         console.log(logMsg);
       }

    }
    else ioAlarm.writeSync(0);

}, 6000);



//put our socket (i.e. -'do stuff') actions as routes into the main app here (so we can access server variables easily)

app.io.route('armhome', function(req) {
  req.io.respond({
    success: 'ARM HOME event received'
  })
  armed = 'Armed Home';

  //save alarm state
  fs.writeFile('./config/status.txt', armed, function(err) {
    if(err)
    {
      console.log('Error:' + err);
    }
    else console.log('Status Saved!');
  });

  console.log('ARM HOME event received');
});

app.io.route('armaway', function(req) {
  req.io.respond({
    success: 'ARM AWAY event received'
  })
  armed = 'Armed Away';

  //save alarm state
  fs.writeFile('./config/status.txt', armed, function(err) {
    if(err)
    {
      console.log('Error:' + err);
    }
    else console.log('Status Saved!');
  });

  console.log('ARM AWAY event received');
});
app.io.route('disarm', function(req) {
  req.io.respond({
    success: 'DISARM event received'
  })
  armed = 'Disarmed';

  //save alarm state
  fs.writeFile('./config/status.txt', armed, function(err) {
    if(err)
    {
      console.log('Error:' + err);
    }
    else console.log('Status Saved!');
  });


  console.log('DISARM event received');
});
app.io.route('clear', function(req) {
  req.io.respond({
    success: 'CLEAR event received'
  })
  //clear all flags and see if they re-trigger!

  fireAlert = false;
  secAlert = false;
  zone1Active = false;
  zone2Active = false;
  zone3Active = false;
  zone4Active = false;
  zone5Active = false;
  zone6Active = false;
  entry1Active = false;
  entry2Active = false;
  entry3Active = false;
  entryCamActive = false
  smoke1Active = false;
  co1Active = false;
  gas1Active = false;
  fire1Active = false;

  console.log('CLEAR event received');
});

app.io.route('open', function(req) {
  req.io.respond({
    success: 'OPEN event received'
  })

  //activate door striker here!!!
  relayDoor.writeSync(1);
  setTimeout(function() {
    relayDoor.writeSync(0);
}, 5000);
  
  console.log('OPEN event received');
});

app.listen(app.get('port'), function(){
  console.log(("Express server listening on port " + app.get('port')))
});

//httpServer.listen(app.get('port'), function(){
//  console.log(("Express server listening on port " + 9393))
//});
