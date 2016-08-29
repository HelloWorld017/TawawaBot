var async = require('async');

var sendTweet = (id, obj) => {
	return new Promise((resolve, reject) => {
		async.each(obj.media, (file, cb) => {
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
