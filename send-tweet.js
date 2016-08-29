var async = require('async');

module.exports = (id, obj) => {
	return new Promise((resolve, reject) => {
		async.each(obj.media, (file, cb) => {
			if(debug) console.log('Sending to telegram..');
			api.sendPhoto({
				chat_id: id,
				photo: file
			}).then(() => {
				cb();
			});
		}, () => {
			api.sendMessage({
				chat_id: id,
				text: "원문 : " + obj.text + "\n" +
					  "\n" +
					  "번역문 (구글번역): " + obj.text_translation
			}).then(() => {
				resolve();
			});
		});
	});
};
