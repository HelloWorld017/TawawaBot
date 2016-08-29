var async = require('async');
var chalk = require('chalk');
var dfs = require('fs');
var download = require('download');
var fs = require('fs-promise');
var getName = require('./get-name');
var translate = require('google-translate-api');
var getExt = (url) => {
	return '.' + url.split('.').pop();
};

module.exports = (v) => {
	return new Promise((resolve, reject) => {
		if(!v.text){
			reject(new Error('Wrong Text!'));
			return;
		}

		var name = getName(v.text);
		console.log("Started downloading / loading from filesystem " + name);
		if(debug) console.log('Debug mode, started logging');
		if(name === false){
			reject(new Error('Wrong Name!'));
			return;
		}

		if(v.entities.media === undefined){
			reject(new Error('No Media!'));
			return;
		}

		var media = [];
		var baseFolder = './assets/' + name + '/';
		fs.access(baseFolder + 'tweet.json', fs.F_OK).then(() => {
			resolve(require(baseFolder + 'tweet.json'));
		}, () => {
			if(debug) console.log('No tweet.json found. Fetching tweet...');
			fs.access(baseFolder, fs.F_OK).catch((err) => {
				if(debug) console.log('Creating tweet folder....');
				return fs.mkdir(baseFolder);
			}).then(() => {
				if(debug) console.log('Started fetching media...');
				var links = v.entities.media.map(v => v['media_url_https']);
				console.log('Found ' + links.length + ' media.');
				async.eachOf(links, (v, k, cb) => {
					if(debug) console.log('Iterating media');
					var target = baseFolder + k + getExt(v);
					media.push(target);
					if(debug) console.log('Downloading media...');
					fs.access(target, fs.F_OK).catch((err) => {
						return download(v).pipe(dfs.createWriteStream(target));
					}).catch((err) => {
						console.error(chalk.red('Error while downloading image!'));
						console.error(err);
					}).then(() => {
						if(debug) console.log('Done downloading media');
						cb();
					});
				}, () => {
					if(debug) console.log('Done iterating media links');

					var text = v.text;
					Object.keys(translate_dictionary).forEach((k) => {
						if(debug) console.log('Replacing...');
						text = text.split(k).join(translate_dictionary[k]);
					});

					if(debug) console.log('Done replacing');

					var obj;

					translate(text, {from: 'ja', to: 'ko'}).then((translation) => {
						if(debug) console.log('Done traslating');
						obj = {
							name: name,
							text: v.text,
							text_translation: translation.text,
							media: media,
							date: new Date(v.created_at).getTime(),
							link: 'https://twitter.com/Strangestone/status/' + v.id_str
						};

						console.log(chalk.cyan('Downloaded ' + name));
						return fs.writeFile(baseFolder + 'tweet.json', JSON.stringify(obj));
					}).then(() => {
						resolve(obj);
					}).catch((err) => console.error(err));
				});
			});
		});
	});
};
