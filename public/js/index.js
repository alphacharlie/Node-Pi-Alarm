
// don't load this script before 'socket.io.js'

setInterval(function() {

  // Update temperature
  $.get("/rest/temperature", function(data) {
    $("#temp").html(data.temperature);
    if(data.temperature > 28)
    {
       $("#temp").attr("class", "warn");
    }
    else if(data.temperature > 32)
    {
       $("#temp").attr("class", "activated");
    }
    else $("#temp").attr("class", "relax");
  });

  // Update humidity
  $.get("/rest/humidity", function(data) {
    $("#humidity").html(data.humidity);
    if(data.humidity > 95)
    {
       $("#humidity").attr("class", "activated");
    }
    if((data.humidity > 80) || (data.humidity < 20))
    {
       $("#humidity").attr("class", "warn");
    }
    else $("#humidity").attr("class", "relax");
  });

  // Update smoke sensor data
  $.get("/rest/smoke", function(data) {
    $("#smoke").html(data.smoke);
  });
  // Update CO sensor data
  $.get("/rest/co", function(data) {
    $("#co").html(data.co);
  });
  // Update gas sensor data
  $.get("/rest/gas", function(data) {
    $("#gas").html(data.gas);
  });
  // Update fire css
  $.get("/rest/fire", function(data) {
    if(data.fire)
    {
      $("#fire").html("ACTIVATED!");
      $("#fire").attr("class", "activated");
    } else {
      $("#fire").html("CLEAR");
      $("#fire").attr("class", "relax");
    }
  });
  // Update smoke css
  $.get("/rest/smokeactive", function(data) {
    if(data.smokeactive)
    {
      $("#smoke").attr("class", "activated");
    } else {
      $("#smoke").attr("class", "relax");
    }
  });
  // Update CO sensor data
  $.get("/rest/coactive", function(data) {
    if(data.coactive)
    {
      $("#co").attr("class", "activated");
    } else {
      $("#co").attr("class", "relax");
    }
  });
  // Update gas sensor css
  $.get("/rest/gasactive", function(data) {
    if(data.gasactive)
    {
      $("#gas").attr("class", "activated");
    } else {
      $("#gas").attr("class", "relax");
    }
  });
  // Update gas sensor data
  $.get("/rest/fireactive", function(data) {
    if(data.fireactive)
    {
      $("#fire").attr("class", "activated");
      $("#fire").html('ALERT!');
    } else {
      $("#fire").attr("class", "relax");
      $("#fire").html('CLEAR');
    }
  });



}, 4000);


setInterval(function() {

  // Take picture
  $.get("/rest/camera/snapshot");

}, 20000);

setInterval(function() {
  // Reload picture
  d = new Date();
  $("#camera").attr("src","pictures/camera/image.jpg?" + d.getTime());
  $("#entry").attr("src","pictures/entry/image.jpg?" + d.getTime());
}, 10000);

setInterval(function() {
  //this is the main loop that polls/shows status on the page
  d = new Date();
  //set status
  var thumbsUp = true;
  // Update arming
  $.get("/rest/armed", function(data) {
    if(data.armed == 'Armed Home')   
    { 
      $("#armed").attr("class", "activated");
      $("#armed").html("ARMED (Home)");
    } 
    else if(data.armed == 'Armed Away')   
    { 
      $("#armed").attr("class", "activated");
      $("#armed").html("ARMED (Away)");
    } else{
      $("#armed").attr("class", "relax");
      $("#armed").html("DISARMED");
    }
  });
  $.get("/rest/secalert", function(data) {
    if(data.secalert)
    { 
      $("#secalert").attr("class", "activated");
      $("#secalert").html("ALERT!!!");
      $("#statusImg").attr("src", "/pictures/exclamation-mark-red-hi.png?" + d.getTime());
      thumbsUp = false;
    } else {
      $("#secalert").attr("class", "relax");
      $("#secalert").html("CLEAR");
    }
  });
  $.get("/rest/firealert", function(data) {
    if(data.firealert)
    { 
      $("#firealert").attr("class", "activated");
      $("#firealert").html("ALERT!!!");
      $("#statusImg").attr("src", "/pictures/exclamation-mark-red-hi.png?" + d.getTime());
      thumbsUp = false;
    } else {
      $("#firealert").attr("class", "relax");
      $("#firealert").html("CLEAR");    
    }
  });
  
  if(thumbsUp)
  {
    $("#statusImg").attr("src", "/pictures/thumbs-up-hi.png?" + d.getTime());
  }

  //now zones
  var drawingCanvas = document.getElementById("zones");
  var context = drawingCanvas.getContext('2d');

  var hot  = "#FF0000";
  var warm = "#FFFF00";
  var cool = "#00FF00";
  var cold = "#0000FF";

  //now draw zones
  context.strokeStyle = "#000000";


//you will need to edit the below 'fillrect' lines to create your own floorplan
//  schema is  - context.fillRect(x_pos,y_pos,width,height);
// edit then refresh page to see how it renders, then repeat!

//zone 1 - kitchen (in my house anyway)
  $.get("/rest/zone1", function(data) {
    if(data.zone1)
    {
      context.fillStyle = hot;
      $("#zone1").attr("class", "activated");
      $("#zone1").html("ALERT!")
    } else {
      context.fillStyle = cool;
      $("#zone1").attr("class", "relax");
      $("#zone1").html("SECURE")
    }
    context.stroke()
    context.fillRect(80,60,80,160);
  });
//zone 2 - Living Room
  $.get("/rest/zone2", function(data) {
      if(data.zone2)
      {
        context.fillStyle = hot;
        $("#zone2").attr("class", "activated");
        $("#zone2").html("ALERT!")
      } else {
        context.fillStyle = cool;
        $("#zone2").attr("class", "relax");
        $("#zone2").html("SECURE")
      }
      context.stroke()
      context.fillRect(245,60,120,160);
      context.fillRect(160,180,85,40);
  });
//zone 3 - Bathroom
 // $.get("/rest/zone3", function(data) {  //commented out as it's not monitored
    $("#zone3").attr("class", "unmonitored");
    context.fillStyle = cold;
    context.stroke()
    context.fillRect(160,60,85,120);
 // });
//zone 4 - Entryway
  $.get("/rest/zone4", function(data) { 
    if(data.zone4)
    {
      context.fillStyle = hot;
      $("#zone4").attr("class", "activated");
      $("#zone4").html("ALERT!")
    } else {
      context.fillStyle = cool;
      $("#zone4").attr("class", "relax");
      $("#zone4").html("SECURE")
    }
    context.stroke()
    context.fillRect(365,60,135,110);
  });

//zone 5 - Project Room
  $.get("/rest/zone5", function(data) { 
    if(data.zone5)
    {
      context.fillStyle = hot;
      $("#zone5").attr("class", "activated");
      $("#zone5").html("ALERT!")
    } else {
      context.fillStyle = cool;
      $("#zone5").attr("class", "relax");
      $("#zone5").html("SECURE")
    }
    context.stroke()
    context.fillRect(500,60,120,160);
  });
//zone 6 - Sun Room
  $.get("/rest/zone6", function(data) { 
    if(data.zone6)
    {
      context.fillStyle = hot;
      $("#zone6").attr("class", "activated");
      $("#zone6").html("ALERT!")
    } else {
      context.fillStyle = cool;
      $("#zone6").attr("class", "relax");
      $("#zone6").html("SECURE")
    }
    context.stroke()
    context.fillRect(620,60,100,160);
  });
//entry 1 - Kitchen Window
  $.get("/rest/entry1", function(data) {
  if(data.entry1)
  {
      context.fillStyle = hot;
      $("#entry1").attr("class", "activated");
      $("#entry1").html("ALERT!")
    } else {
      context.fillStyle = cool;
      $("#entry1").attr("class", "relax");
      $("#entry1").html("SECURE")
    }
    context.stroke()
    context.fillRect(40,75,20,90);
  });
//entry 2 - Front Door
  $.get("/rest/entry2", function(data) {
    if(data.entry2)
    {
      context.fillStyle = hot;
      $("#entry2").attr("class", "activated");
      $("#entry2").html("ALERT!")
    } else {
      context.fillStyle = cool;
      $("#entry2").attr("class", "relax");
      $("#entry2").html("SECURE")
    }
    context.stroke()
    context.fillRect(390,30,80,20);
  });
//entry 3 - Sun Room Window
  $.get("/rest/entry3", function(data) {
    if(data.entry3)
    {
      context.fillStyle = hot;
      $("#entry3").attr("class", "activated");
      $("#entry3").html("ALERT!")
    } else {
      context.fillStyle = cool;
      $("#entry3").attr("class", "relax");
      $("#entry3").html("SECURE")
    }
    context.stroke()
    context.fillRect(740,75,20,90);
  });

}, 4000);

