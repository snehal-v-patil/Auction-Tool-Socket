$(function() {
    var iosocket = io.connect('192.168.100.105:8082');
    iosocket.on('connect', function() {

    });
    
    iosocket.on('disconnect', function() {

    });

    iosocket.on('dataSent', function(data) {
        if(data && data != ''){
            console.log(data);
        }
        else{
            return;
        }

    });

/*(function(){
    var f = '5';
  
})();*/
test = 6;
console.log(test);


});