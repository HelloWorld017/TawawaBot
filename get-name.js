var fixchar = require('fixchar');

module.exports = (v) => {
	var match = v.match(/月曜日のたわわ　その([^　]*)　/);
	if(match === null){
		match = v.match(/社畜諸兄にたわわをお届けします　その([^　]*)　/);
	}

	if(match === null){
		return false;
	}

	var name = fixchar(match[1]); //Fullwidth -> Halfwidth
	name.replace(/[^a-zA-Z0-9]/g, (match) => {
		return "p" + match.codePointAt(0);
	});
	return name.slice(0, 20);
};
