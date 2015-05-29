var fs = require('fs');

//setInterval(function() {
  var files = fs.readDirSync('./public/logs/');

  files.forEach(function(file) {
    fs.lstat('./logs/' + file, function(err, stats) {
      if(!err && stats.isDirectory()) {
        $('#folderTree').append(<li class="folder">+file+'</li>');
      } else {
        $('#folderTree').append('<li class="file"><a href="http://'+window.location.hostname+'/logs/'+file+'">'+file+'</a></li>');
      }
    }
  });
//}, 30000);




