const mongoose = require('mongoose');
const express = require('express');
const session = require('express-session');
const WebSocket=require('socket.io');
const bodyparser = require('body-parser');
const cookieParser = require('cookie-parser');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const multer = require('multer');

mongoose.Promise=global.Promise;
mongoose.connect('mongodb://localhost/social_newtwork',{useNewUrlParser:true});
mongoose.connection.once('open',function(){
	console.log("established connection with database");
	mongoose.set('useCreateIndex', true);	
	mongoose.set('useFindAndModify', true);
	//mongoose.set('debug', true);
	//User.createIndex({first_name: 1});
}).on('error',function(err){
	console.log("Error connecting to database");
	throw err;
});

const app = express();
app.set('view engine','ejs');
app.use(express.static('public'));
app.use(bodyparser.urlencoded({extended:false}));
app.use(cookieParser());
app.use(session({
    key: 'user_sid',
    secret: 'askjhsdkajfbajbldasjbsaf',
    resave: false,
    saveUninitialized: true
}));

const port = process.env.PORT || 3000;

const server = app.listen(port,function(err) {
	if(err)
		console.log("error setting up server");
	else
		console.log("setup server at port",port);
});

app.get('/', function(req,res){
	if(req.session.user){
		res.render('home', {session: req.session.user});
	}
	else{
		res.sendFile(__dirname+'/public/login.html');
	}
})

app.post('/signup', function(req,res){
	User.findOne({username: req.body.username}).then(function(result){
		if(result){
			console.log("user already exists");
			res.redirect('/');
		}
		else{
			let username = req.body.username, plain_password = req.body.password;
			//console.log(`signup request from ${username} ${plain_password}`);
			bcrypt.hash(plain_password, saltRounds, function(err,hashed_password){
				if(err){
					console.log("error in hashing",err);
					res.redirect('/');
				}
				else{
					let user = new User({
						username: username,
						password: hashed_password
					});
					user.save().then(function(result){
						console.log("successful signup");
						req.session.user = {
							user_id: result.id
						};
						res.render("home", {session: req.session.user});
					}).catch(function(err){
						console.log("cant save new user to database");
						throw err;
					});
				}
			});
		}
	})
});

app.post('/login', function(req,res){
	//console.log(req.body);
	let username = req.body.username;
	let plain_password = req.body.password;
	console.log(plain_password);
	User.findOne({username: username}).sort({"chats.last_chat_at": -1}).then(function(result){
		//console.log("query result",result.password);
		if(!result){
			res.redirect('/');
		}
		bcrypt.compare(plain_password, result.password).then(function(match){
			if(match == true){
				console.log("successful login");
				req.session.user = {
					user_id: result.id,
					first_name: result.first_name || "update_profile",
					last_name: result.last_name || "",
					chats: result.chats || [],
					friends: result.friends || []
				};
				res.render("home", {session: req.session.user});
			}
			else{
				console.log("wrong password");
				res.redirect('/');
			}
		}).catch(function(err){
			console.log("error in comparing hash");
			res.redirect('/');
			throw err;
		});
	});
});

app.get('/update',function(req,res){
	if(!req.session.user){
		res.end("Invalid session");
	}
	else{
		res.render('update', req.session.user);
	}
});

app.post('/update_profile', function(req,res){
	User.findByIdAndUpdate(req.session.user.user_id,
		{
			first_name: req.body.first_name,
			last_name: req.body.last_name
		}, function(err,result){
		if(err){
			console.log("cant update");
			throw err;
		}
		res.first_name = req.body.first_name;
		res.last_name = req.body.last_name;
	});
	req.session.user.first_name = req.body.first_name;
	req.session.user.last_name = req.body.last_name;
	res.render('home', {session: req.session.user});
});

app.get('/logout', function(req,res){
	if(req.session.user){
		req.session.destroy();
	}
	res.redirect('/');
});

const socket = WebSocket(server);
connections = {};

socket.on('connection', function(clientSocket){
	handshakeData = clientSocket.request._query;
	if(!handshakeData){
		console.log('Invalid socket connection');
		clientSocket.disconnect();
	}
	connections[handshakeData.user_id] = clientSocket.id;
	console.log("made connection");
	clientSocket.on('globalSearch', function(data){
		console.log("search from", clientSocket.user_id);
		User.find({
			first_name: {$regex: data.query, $options: "$i"}
		},
		{
			"first_name" : 1,
			"last_name" : 1
		},
		function(err, result){
			if(err){
				console.log("error in query");
				throw err;
			}
			console.log("result",result);
			socket.to(clientSocket.id).emit('globalSearchResult',{users: result});
		});
	});
	clientSocket.on('sendFriendRequest', function(data){
		console.log("event sendFriendRequest");
		let first_name="", last_name="";
		User.findById(data.to, function(err,result){
			if(err){
				console.log("could not send friend request");
				throw err;
			}
			else{
				console.log("found correct user");
				let friend_requests = result.friend_requests;
				let i=0;
				for(i=0;i<friend_requests.length;i++){
					let friend_request = friend_requests[i];
					if(friend_request.friend_id == data.from){
						break;
					}
				}
				if(i == friend_requests.length){
					first_name = result.first_name;
					last_name = result.last_name;
					console.log("request to", first_name, last_name);
					result.friend_requests = [{friend_id: data.from, first_name: data.first_name, last_name: data.last_name, pending: true} , ...result.friend_requests];
					socket.to(clientSocket.id).emit('newFriendRequest', {
						from: data.from,
						first_name: data.first_name,
						last_name: data.last_name
					});
					result.save().then(function(data){
						console.log("sent friend_request successfully");
						socket.to(clientSocket.id).emit('sentFriendRequest');
					}).catch(function(err){
						first_name = "";
						console.log("can't add sendFriendRequest");
						throw err;
					});
					console.log("adding request to own");
					User.findById(data.from, {"friend_requests": 1}, function(err,result){
						if(err){
							console.log("cant add request to own list");
							throw err;
						}
						newFriendRequest = {
							friend_id: data.to,
							first_name: first_name,
							last_name: last_name,
							sent: true
						};
						result.friend_requests = [...result.friend_requests, newFriendRequest];
						result.save().then(function(){
							console.log("saved request to own list: ",result);
						}).catch(function(){
							console.log("cant save request to own list");
						});
					});
				}
				else{
					console.log("friend request already sent");
				}
			}
		});
	});
	clientSocket.on('shownotifications', function(data){
		User.findById(data.user_id,{"notifications": 1},function(err,result){
			if(err){
				console.log('cant find user for fetching notifications');
				throw err;
			}
			console.log(result);
		});
		//console.log("notifications request");
	});
	clientSocket.on('showfriends', function(data){
		User.findById(data.user_id, {"friend_requests": 1, "friends": 1} ,function(err,result){
			if(err){
				console.log('cant find user for fetching friends list');
				throw err;
			}
			//console.log(result);
			socket.to(clientSocket.id).emit('friend_list_response',result);
		});
	});
	clientSocket.on('deleteFriendRequest', function(data){
		User.findById(data.user_id, {"friend_requests": 1}, function(err, result){
			if(err){
				console.log("cant find user for deleteing friend_request");
				throw err;
			}
			let del_index = -1;
			result.friend_requests.forEach((item, index)=>{
				if(item.friend_id == data.friend_id){
					del_index = index;
				}
			});
			if(del_index > -1)
				result.friend_requests.splice(del_index,1);
			result.save();
		});
	});
	clientSocket.on('confirmRequest', function(data){
		console.log("try to accept request");
		User.findById(data.user_id, {"friends": 1, "friend_requests": 1}, function(err,result){
			if(err){
				console.log("cant find user for confirmRequest");
				throw err;
			}
			//console.log("user for request acceptance", result);
			let del_index = -1, first_name="", last_name="";
			result.friend_requests.forEach((item, index)=>{
				if(item.friend_id == data.friend_id){
					del_index = index;
					first_name = item.first_name;
					last_name = item.last_name;
				}
			});
			if(del_index > -1){

				result.friend_requests.splice(del_index,1);
				let new_friend = {
					friend_id: data.friend_id,
					first_name: first_name,
					last_name: last_name
				}
				result.friends = [...result.friends, new_friend];
				console.log(result.friends);
				result.save().then(function(res){
					console.log("accepted request query result:");
				}).catch(function(){
					console.log("error accepting request");
				});
			}
		});
		User.findById(data.friend_id, {"friends": 1, "friend_requests": 1}, function(err,result){
			if(err){
				console.log("cant update the firend");
				throw err;
			}
			console.log("found friend",result);
			let del_index = -1, first_name="", last_name="";
			result.friend_requests.forEach((item, index)=>{
				if(item.friend_id == data.user_id){
					del_index = index;
					first_name = item.first_name;
					last_name = item.last_name;
				}
			});
			if(del_index > -1){
				result.friend_requests.splice(del_index,1);
				let new_friend = {
					friend_id: data.user_id,
					first_name: first_name,
					last_name: last_name
				}
				result.friends = [...result.friends, new_friend];
				console.log(result.friends);
				result.save().then(function(res){
					console.log("updated friend request query result:", res);
				}).catch(function(){
					console.log("error accepting request");
				});
			}
		});
	});
	clientSocket.on('getMessages', function(data){
		console.log("fetch messages");
		User.findById(data.user_id, {"chats": 1}, function(err,result){
			if(err){
				console.log('error finding user for fetching messages');
				throw err;
			}
			let messages = [];
			result.chats.forEach((item, index)=>{
				if(item.user_id == data.friend_id){
					messages = item.messages;
				}
			});
			socket.to(clientSocket.id).emit('displayMessages',{friend_id: data.friend_id ,messages: messages});
		});
	});
	clientSocket.on('sendMessage', function(data){
		if(connections[data.to]){
			socket.to(`${connections[data.to]}`).emit('receiveMessage',data);
		}
		User.findById(data.to, function(err,result){
			if(err){
				console.log("error adding msg to db");
				throw err;
			}
			let new_msg = {
				me: false,
				message: data.message
				// when: Date()
			}
			let i=0;
			for(i=0;i<result.chats.length;i++){
				let chat = result.chats[i];
				if(chat.user_id == data.from){
					chat.last_msg = data.message;
					chat.messages = [...chat.messages, new_msg];
					result.chats[i] = chat;
					break;
				}
			}
			if(i == result.chats.length){
				let new_chat = {
					user_id: data.from,
					last_msg: data.message,
					messages: [new_msg],
					first_name: handshakeData.first_name,
					last_name: handshakeData.last_name
					//last_chat_at: Date()
				}
				result.chats = new_chat;
			}
			result.save().then(function(friend){
				User.findById(data.from, function(err,result){
					if(err){
						console.log("error adding msg to db");
						throw err;
					}
					let new_msg = {
						me: true,
						message: data.message
						// when: Date()
					}
					let i=0;
					for(i=0;i<result.chats.length;i++){
						let chat = result.chats[i];
						if(chat.user_id == data.to){
							chat.last_msg = data.message;
							chat.messages = [...chat.messages, new_msg];
							result.chats[i] = chat;
							break;
						}
					}
					if(i == result.chats.length){
						let new_chat = {
							user_id: data.to,
							last_msg: data.message,
							messages: [new_msg],
							first_name: friend.first_name,
							last_name: friend.last_name
							//last_chat_at: Date()
						}
						result.chats = new_chat;
					}
					result.save();
				});		
			}).catch(function(err){
				console.log("cant save msg to database");
			});
		});
		
		
	});
});