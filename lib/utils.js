

exports.sleep = function(msec){
	return new Promise((resolve) => {
		setTimeout(resolve, msec);
	});
}
