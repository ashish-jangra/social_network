const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const PostSchema = new Schema({
	post_id: ObjectId
});

const FriendSchema = new Schema({
	user_id: ObjectId,
	first_name: { type: String},
	last_name: { type: String},
	follow_status: String
});

const FriendRequestSchema = new Schema({
	sent: {type: Boolean, default: false},
	pending: {type: Boolean, default: false},
	first_name: {type: String},
	last_name: {type: String},
	friend_id: {type: ObjectId}
});

const NotificationSchema = new Schema({
	from: ObjectId,
	first_name: String,
	last_name: String
},{timestamps: true});

const UserSchema = new Schema({
	username: { type: String},
	password: String,
	first_name: { type: String, default: "UpdateProfile",index: true, text: true },
	last_name: { type: String},
	friends: [FriendSchema],
	posts: [PostSchema],
	friend_requests: [FriendRequestSchema],
	notifications: [NotificationSchema]
});

const User = mongoose.model('user', UserSchema);

module.exports = User;