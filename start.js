var async = require('async');
var bodyParser = require('body-parser');
var chalk = require('chalk');
var dfs = require('fs');
var download = require('download');
var express = require('express');
var fixchar = require('fixchar');
var fs = require('fs-promise');
var http = require('http');
var logger = require('morgan');
var rq = require('request-promise');
var telegram = require('telegram-bot-api');

var config = require('./config/');

var useCert = (process.env.CERT === 'true');
global.debug = (process.env.NODE_ENV || 'development') === 'development';
var subscribers = [];

try{
	dfs.accessSync('./last.json', dfs.F_OK);
}catch(e){
	console.log(chalk.cyan('Created last.json'));
	dfs.writeFileSync('./last.json', JSON.stringify({
		last: Date.now()
	}));
}

var lastUpdate = require('./last.json').last;
var targets = [];
var hook = config.hookSecret + config.token + Math.random().toString(16).substr(3);

var searchUrl = 'https://api.twitter.com/1.1/search/tweets.json';
var userAgent = 'TawawaBot 1.0';

var saveSubscriptions = () => {
	return fs.writeFile('subscribers.json', JSON.stringify(subscribers));
};

var handleHook = (message) => {
	var id = message.chat.id;
	if(typeof message.text !== 'string') return;

	if(message.text.startsWith('/subscribe')){
		if(subscribers.indexOf(id) !== -1){
			api.sendMessage({
				chat_id: id,
				text: "이미 구독중입니다!"
			});
		}else{
			subscribers.push(id);
			saveSubscriptions().then(() => {
				api.sendMessage({
					chat_id: id,
					parse_mode: 'Markdown',
					text: '구독했습니다! 앞으로 월요일마다 새로 올라오는 월요일의 타와와를 보내드리겠습니다!'
				});
			}, (err) => {
				api.sendMessage({
					chat_id: id,
					parse_mode: 'Markdown',
					text: '구독 과정 중에 오류가 발생했습니다 :(\n이 사실을 @Khinenw 에게 알려주세요!'
				});

				console.error(err);
			});
		}
	}else if(message.text.startsWith('/unsubscribe')){
		if(subscribers.indexOf(id) === -1){
			api.sendMessage({
				chat_id: id,
				text: "현재 월요일의 타와와를 구독중이지 않습니다!"
			});
		}else{
			subscribers = subscribers.filter((v) => {
				v !== id
			});

			saveSubscriptions().then(() => {
				api.sendMessage({
					chat_id: id,
					parse_mode: 'Markdown',
					text: '구독을 해지했습니다!'
				});
			}, (err) => {
				api.sendMessage({
					chat_id: id,
					parse_mode: 'Markdown',
					text: '구독을 해지하던 과정 중에 오류가 발생했습니다 :(\n이 사실을 @Khinenw 에게 알려주세요!'
				});

				console.error(err);
			});
		}
	}else if(message.text.startsWith('/help')){
		api.sendSticker({
			chat_id: id,
			sticker: './sticker.jpg'
		});

		api.sendMessage({
			chat_id: id,
			parse_mode: 'Markdown',
			text: "이 봇은 매주 월요일 [히무라 키세키](https://twitter.com/Strangestone)의 트위터에 올라오는 `월요일의 타와와`를 구독중인 채팅방에 보내주는 역할을 하고 있습니다.\n" +
				  "\n" +
				  "구독하시려면 `/subscribe@TawawaBot` 명령어를, 구독을 해지하시려면 `/unsubscribe@TawawaBot` 명령어를 입력해주세요!\n" +
				  "지난 화를 보시려면 `/tawawa@TawawaBot [화 수]` 를 입력해주세요!\n" +
				  "예시) `/tawawa@TawawaBot 79`\n" +
				  "\n" +
				  "문의사항이 있으면 @Khinenw 에게 연락주세요!\n" +
				  "이 봇이 보내주는 이미지의 저작권은 모두 원작자(히무라 키세키)에게 있습니다.\n" +
				  "[깃허브](https://github.com/HelloWorld017/TawawaBot) 에서 소스를 확인하실 수 있습니다."
		});
	}else if(message.text.startsWith('/tawawa')){
		var number = fixchar(message.text.replace(/^\/tawawa(?:@[a-zA-Z0-9]*)?[ ]*/i, ''));
		number = number.replace(/[^a-zA-Z0-9]/g, (match) => {
			return "p" + match.codePointAt(0);
		}).slice(0, 20);

		fs.access(`./assets/${number}/tweet.json`).then(() => {
			var tweet = require(`./assets/${number}/tweet.json`);
			return sendTweet(id, tweet);
		}, (err) => {
			api.sendMessage({
				chat_id: id,
				parse_mode: 'Markdown',
				text: '존재하지 않는 번호입니다!'
			});
		});
	}
};

var app = express();
if(debug) app.use(logger('dev'));
app.use(bodyParser.text({
	type: 'application/json'
}));

app.post('/' + hook, (req, res, next) => {
	var item = JSON.parse(req.body);

	if(item.message) handleHook(item.message);
	res.end(':D');
});

app.use((req, res, next) => {
	res.redirect('https://telegram.me/TawawaBot');
});

global.api = new telegram({
	token: config.token
});

var query = {
	method: 'GET',
	uri: searchUrl,
	qs: {
		q: '"月曜日のたわわ　その" from:Strangestone filter:twimg',
		result_type: 'recent',
		count: 10
	},
	headers: {
		'User-Agent': userAgent
	}
};

var oldQuery = {
	method: 'GET',
	uri: searchUrl,
	qs: {
		q: '"社畜諸兄にたわわをお届けします　その" from:Strangestone filter:twimg',
		result_type: 'recent',
		count: 10
	},
	headers: {
		'User-Agent': userAgent
	}
};

global.translate_dictionary = config.dictionary;

var bearer = new Buffer(`${config.key}:${config.secret}`).toString('base64');
var token = undefined;

var getName = require('./get-name');
var saveTweet = require('./save-tweet');
var sendTweet = require('./send-tweet');

rq({
	method: 'POST',
	uri: 'https://api.twitter.com/oauth2/token',
	form: {
		grant_type: 'client_credentials'
	},
	headers:{
		Authorization: 'Basic ' + bearer
	}
}).catch((err) => {
	if(err){
		console.error(chalk.red('Error while authenticating application!'));
		console.error(err.message);
		console.error(err.stack);
	}
}).then((body) => {
	body = JSON.parse(body);
	token = 'Bearer ' + body.access_token;
	if(token === undefined){
		console.error(chalk.red('Error while authenticating application!'));
		return;
	}

	return fs.access('./subscribers.json', fs.F_OK);
}).catch((err) => {
	console.log(chalk.cyan('Creating subscribers file...'));
	return fs.writeFile('subscribers.json', JSON.stringify(config.defaultSubscribers));
}).then(() => {
	return fs.readFile('subscribers.json', 'utf8');
}).then((data) => {
	subscribers = JSON.parse(data);
}).catch((err) => {
	console.error(chalk.red('Error while reading subscribers file!'));
	subscribers = config.defaultSubscribers;
}).then(() => {
	return fs.access('./assets/', fs.F_OK);
}).catch((err) => {
	console.log(chalk.cyan('Creating assets folder'));
	return fs.mkdir('./assets');
}).then(() => {
	oldQuery.headers.Authorization = query.headers.Authorization = token;

	var handle = (body) => {
		body = JSON.parse(body);

		async.each(body.statuses, (v, callback) => {
			saveTweet(v).then((obj) => {
				if(obj.date < lastUpdate){
					if(debug) console.log('Ignoring...');
					callback();
					return;
				}

				async.each(subscribers, (v, cb) => {
					sendTweet(v, obj).then(() => {
						cb();
					});
				}, () => {
					callback();
				});
			});
		}, () => {
			if(debug) console.log('Waiting for next fetch...');
			lastUpdate = Date.now();
			fs.writeFile('./last.json', JSON.stringify({last: lastUpdate})).then(() => {
				setTimeout(fetch, 3600000);
			});
		});
	};

	var fetch = () => {
		if(debug) console.log('Fetching...');
		rq(query).then(handle, (err) => {
			console.error(chalk.red('Error while fetching update!'));
			setTimeout(fetch, 1800000);
		});
	};

	fetch();
});

var httpServer;
var options;

if(useCert){
	options = {
		key: fs.readFileSync('/cert/key.pem'),
		crt: fs.readFileSync('/cert/crt.pem')
	};
}

var port = ((val) => {
	var portNumber = parseInt(val, 10);

	if(isNaN(portNumber)){
		return val;
	}

	if(portNumber >= 0){
		return portNumber;
	}

	return false;
})(process.env.PORT || '443');

app.set('port', port);

if(useCert) httpServer = http.createServer(options, app);
else httpServer = http.createServer(app);

httpServer.listen(port);
httpServer.on('error', (err) => {
	if(err.syscall !== 'listen') throw err;
	var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

	switch(err.code){
		case 'EACCES':
			console.error('Permission Denied!');
			process.exit(1);
			return;

		case 'EADDRINUSE':
			console.error('Address in use!');
			process.exit(1);
			return;
	}

	throw error;
});

httpServer.on('listening', () => {
	var addr = httpServer.address();
	console.log((typeof addr === 'string') ? 'Pipe ' + addr : 'Listening on port ' + addr.port);
});

if(!useCert){
	var _baseurl = 'https://api.telegram.org/bot' + config.token + '/';

	rq({
		method: 'POST',
		json: true,
		formData: {
			url: config.hookUrl + hook
		},
		url: _baseurl + 'setWebhook'
	});
}else api.setWebhook(config.hookUrl + hook, options.crt);
