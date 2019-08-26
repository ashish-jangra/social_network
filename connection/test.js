arr = new Array(1,2,3);
valueAtIndex = (i,arr) => new Promise(function(resolve,reject){
	if(i < 0 || i > arr.length){
		reject('index out of bounds');
	}
	else{
		resolve(arr[i]);
	}
});

valueAtIndex(1,arr).then(function(data){
	console.log(data);
}).catch(function(err){
	console.log(err);
});