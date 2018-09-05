var request = require('request');
var async = require('async');
var config = require('./config');
var _ = require('lodash');
var emoji = require('node-emoji');
var fs = require("fs");

var lastUpdateID=0;
var first=true;
var pollData={};

function getMessage(){
	var now=Date.now();
	var options = {
		url:  'https://api.telegram.org/bot'+config.botToken+'/getUpdates?offset='+lastUpdateID+'&timeout='+(first?0:10000),
		timeout: 10001*1000
	}
	request(options, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var data=JSON.parse(body);
			_.forEach(data.result, function(row) {
				if (!first){
					//console.log(row);
					if(row.message && row.message.photo){
						sendPhotoPoll(row.message.message_id,row.message.chat.id);
					}
					else if(row.callback_query && row.callback_query.data){
						var arr=row.callback_query.data.split(";");
						if (arr.length==2){
							vote(row.callback_query.from.id,arr[0],parseInt(arr[1]))
						}
					}
				}
				lastUpdateID=row.update_id+1;
			});
			first=false;
		}
		getMessage();
	})
}

function sendPhotoPoll(message_id,chat_id){
	sendMessage({
		chat_id: chat_id,
		text:"Vote the image",
		reply_to_message_id:message_id,
		reply_markup:{inline_keyboard:[[{text:":+1: : 0",callback_data:chat_id+"@"+message_id+";1"},{text:":-1: : 0",callback_data:chat_id+"@"+message_id+";0"}]]},
	},"sendMessage",function(res){
		if (res.ok){
			pollData[chat_id+"@"+message_id]={
				pollChat_id:chat_id,
				pollMessageID:res.result.message_id,
				vote1:[],
				vote0:[]
			}
			savePollData();
		}
	});
}

function vote(uesrID,chat_message_id,vote){
	if (!pollData[chat_message_id]) return;
	var i=pollData[chat_message_id].vote1.indexOf(uesrID);
	if(i != -1) pollData[chat_message_id].vote1.splice(i, 1);
	i=pollData[chat_message_id].vote0.indexOf(uesrID);
	if(i != -1) pollData[chat_message_id].vote0.splice(i, 1);
	if (vote==1) pollData[chat_message_id].vote1.push(uesrID);
	if (vote==0) pollData[chat_message_id].vote0.push(uesrID);
	sendMessage({
		chat_id: pollData[chat_message_id].pollChat_id,
		message_id: pollData[chat_message_id].pollMessageID,
		reply_markup:{inline_keyboard:[[{text:":+1: : "+pollData[chat_message_id].vote1.length,callback_data:chat_message_id+";1"},{text:":-1: : "+pollData[chat_message_id].vote0.length,callback_data:chat_message_id+";0"}]]},
		text:"Rate this image"
	},"editMessageText");	
	savePollData();
}

function sendMessage(form,actionType,callback){
	if (!form.reply_to_message_id) delete form.reply_to_message_id;
	if (form.reply_markup && form.reply_markup.inline_keyboard){
		form.reply_markup.inline_keyboard.forEach(function(row) {
			row.forEach(function(button) {
				if (button.text) button.text=emoji.emojify(button.text,function (name) {return ":"+name+":";});
			})
		});
	}
	if (form.reply_markup) form.reply_markup = JSON.stringify(form.reply_markup);
	if (form.text) form.text=emoji.emojify(form.text,function (name) {return ":"+name+":";});
	request.post(
		'https://api.telegram.org/bot'+config.botToken+'/'+actionType,
		{ formData: form, json: true},
		function (error, response, body) {
			if (callback){
				callback(body);
			}
		}
	);
}

function savePollData(){
	fs.writeFile("pollData.json", JSON.stringify(pollData), function(err) {}); 
}

function getPolllData(){
	fs.readFile("pollData.json", 'utf8', function (err,data) {
		if (!err) {
			try{
				pollData=JSON.parse(data);
			}
			catch (e){}
		} 	
	});	
}

getPolllData();
getMessage();
console.log("start");