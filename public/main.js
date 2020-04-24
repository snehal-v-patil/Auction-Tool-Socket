$(function() {
    var iosocket = io.connect('http://192.168.100.105:8082');
    iosocket.on('connect', function() {

    });
    
    iosocket.on('disconnect', function() {

    });

    iosocket.on('timerstart', function(data) {
        if(data && data != ''){
            $('.si-minute').text(data.minutes);
            $('.si-second').text(data.seconds);
        }
        else{
            return;
        }

    });


    iosocket.on('timerpause', function(data) {
        if(data && data != ''){
          $('.si-minute').text(data.minutes);
          $('.si-second').text(data.seconds);
      }
      else{
        return;
    }

});

(function(){
    var a = f = 5;
})();
console.log(f);
});