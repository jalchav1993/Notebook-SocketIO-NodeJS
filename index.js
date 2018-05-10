// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var cassandra = require('cassandra-driver');
var async = require('async');
var session = require('express-session');
var store = require('session-file-store')(session);
 //Connect to the cluster
var db = new cassandra.Client({contactPoints: ['127.0.0.1'], keyspace: 'dev'}); 
console.log(' new server!'); 
server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', function (client) { 
  console.log(' connected!'); 
	client.on('get-note-request', function(data){
		db.execute("SELECT paragraph FROM notes WHERE note_id = 1 ALLOW FILTERING", function (err, result) {
			if (!err){
	  		if (  result.rows.length > 0) {
	      	client.emit('get-note-request-accepted',{
						paragraph:result.rows
	      	});
				} else{
					client.emit('get-note-request-denied');
				}
			} else{
				console.log('error');
			}
		});
	});
  // when the client emits 'typing', we broadcast it to others
  client.on('typing', function(data) {
		console.log("UPDATE notes SET paragraph = "+"'"+data+"'"+" WHERE note_id = 1");
		db.execute("UPDATE notes SET paragraph = '"+data+"' WHERE note_id = 1", function (err, result) {
			client.broadcast.emit('typing', {
	      email: client.email,
				paragraph:data
	    });
		});
  });

  // when the client emits 'stop typing', we broadcast it to others
  client.on('stop typing', () => {
    client.broadcast.emit('stop typing', {
      email: client.email
    });
  });
	client.on('sign-in-request', function (data) {
		var jsonContent = JSON.parse(data);
		console.log('sign-in-request ' +" " +jsonContent.email+" " +jsonContent.password);
		db.execute("SELECT password, user_id FROM users WHERE email = '"+jsonContent.email+"' ALLOW FILTERING", function (err, result) {
			if (!err){
	  		if (  result.rows.length > 0 && jsonContent.password === result.rows[0]['password']) {
					client.email = jsonContent.email+"";
					client.user_id = result.rows[0]['user_id'];
					console.log("success");
	      	client.emit('sign-in-request-accepted');
				} else{
					client.emit('sign-in-request-denied');
				}
			} else{
				console.log('error');
			}
		});
	});
});
//db.shutdown();