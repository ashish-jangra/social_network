document.addEventListener('DOMContentLoaded', function() {
    var elems = document.querySelectorAll('.sidenav');
    var instances = M.Sidenav.init(elems);
});

var socket = io.connect('http://localhost:3000');
const post_container = document.getElementById('post_container');
posts = post_container.innerHTML;
globalSearch = document.getElementById('autocomplete-input');
globalSearch.addEventListener('keyup', function(event){
	if(event.keyCode == 13){
		if(globalSearch.value){
			console.log("search for", globalSearch.value);
			socket.emit('globalSearch', {
				query: globalSearch.value
			});
			globalSearch.value = "";
		}
	}
});

socket.on('globalSearchResult', function(data){
	resultHTML = "<div class = 'collection'>";
	for(let i=0;i<data.users.length;i++){
		resultHTML += `
		<div class = "collection-item avatar" href = "${data.users[i]._id}">
			<a href="#"><img src = "img_avatar.png" class = "circle">
			<span class = "title"> ${data.users[i].first_name} ${data.users[i].last_name}</span></a>
			<span class = "secondary-content">
				<i class = "material-icons" onclick="sendFriendRequest(event)" id="${data.users[i]._id}">person_add</i>
			</span>
		</div>
		`;
	}
	resultHTML += "</div>";
	post_container.innerHTML = resultHTML;
});

function sendFriendRequest(event){
	socket.emit('sendFriendRequest', {
		to: event.target.id,
		from: session.user_id,
		first_name: session.first_name,
		last_name: session.last_name
	});
}

socket.on('sentFriendRequest', function(){
	console.log("sentFriendRequest");
	M.toast({html: 'Friend Request Sent!'});
})

function handleSideNav(event) {
	let id = event.target.id;
	console.log(id);
	id = "show"+id;
	sideProps = document.getElementById("sideProps");
	for(let i=0;i<sideProps.children.length;i++){
		child = sideProps.children[i];
		if(child.id != id)
			child.hidden = true;
	}
	element = document.getElementById(id);
	if(!element){
		intialHTML = sideProps.innerHTML;
		resultHTML = `
			<ul class="messenger_list" id = "${id}">
				<li>
					Loading List.. Please wait
				</li>
			</ul>
		`;
		sideProps.innerHTML += resultHTML;
		socket.emit(id,{
			user_id: session.user_id
		});
		socket.on('friend_list_response', function(data){
			resultHTML = `<ul class="messenger_list" id = "${id}">`;
			data.friend_requests.forEach((item, index)=>{
				if(item.sent){
					resultHTML += `<li class="w3-chip">
					<img src="img_avatar.png" class="circle" />
					${item.first_name} ${item.last_name} <i>sent</i>`;
				}
			});
			data.friend_requests.forEach((item, index)=>{
				if(item.pending){
					resultHTML += `<li class="w3-chip">
					<img src="img_avatar.png" class="circle" />
					${item.first_name} ${item.last_name} <i>
					<button class="btn" id="${item.friend_id}" onclick="handleAccept(event)">Accept</button><button class="btn" id="${item.friend_id}" onclick="handleDelete(event)">Delete</button>
					</i> </li>`;
				}
			});
			data.friends.forEach((item, index)=>{
				resultHTML += `<li class="w3-chip">
				<img src="img_avatar.png" /> ${item.first_name} ${item.last_name}
				</li>`;
			});
			resultHTML += '</ul>';
			sideProps.innerHTML = intialHTML+resultHTML;
		});
	}
	else{
		element.hidden = false;
	}
}

function handleAccept(event){
	li = event.target.parentElement.parentElement;
	li.style.display = "none";
	console.log(li.innerText);
	socket.emit('confirmRequest', {
		user_id: session.user_id,
		friend_id: event.target.id
	});
}
function handleDelete(event){
	li = event.target.parentElement.parentElement;
	li.style.display = "none";
	console.log("deleteFriendRequest");
	socket.emit('deleteFriendRequest', {
		user_id: session.user_id,
		friend_id: event.target.id
	});
}