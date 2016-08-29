var config = require('./config/');
var dfs = require('fs');
var rq = require('request-promise');
var saveTweet = require('./save-tweet');

var findUrl = (string) => {
	return `https://api.twitter.com/1.1/statuses/show/${string}.json`;
};
var from_id = process.env.FROM;
var token = undefined;
var bearer = new Buffer(`${config.key}:${config.secret}`).toString('base64');

try{
	dfs.mkdirSync('./assets/');
}catch(e){}

global.debug = true;
global.translate_dictionary = config.dictionary;

var count = 0;
var findAndDownload = (id, cb) => {
	count++;
	rq({
		uri: findUrl(id),
		method: 'GET',
		headers: {
			Authorization: token
		}
	}).then((body) => {
		body = JSON.parse(body);

		var match = body.text.match(/月曜日のたわわ　その([^　]*)　/);
		if(match === null){
			match = body.text.match(/社畜諸兄にたわわをお届けします　その([^　]*)　/);
		}

		var handle = (body) => {
			if(!body.in_reply_to_status_id_str){
				cb();
				return;
			}

			findAndDownload(body.in_reply_to_status_id_str, cb);
		};

		if(match !== null){
			saveTweet(body).then((obj) => {
				handle(body);
			}).catch((err) => {
				console.error(err);
			});
		}else{
			handle(body);
		}
	});
};

var start = (id) => {
	return new Promise((resolve, reject) => {
		findAndDownload(id, resolve);
	});
};

rq({
	method: 'POST',
	uri: 'https://api.twitter.com/oauth2/token',
	form: {
		grant_type: 'client_credentials'
	},
	headers:{
		Authorization: 'Basic ' + bearer
	}
}).then((body) => {
	token = 'Bearer ' + JSON.parse(body).access_token;
	return start(from_id);
}).then(() => {
	console.log(`Downloaded ${count} images.`)
});
