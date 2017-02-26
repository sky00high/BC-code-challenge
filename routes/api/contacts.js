var express = require('express');

var router = express.Router();
var Contact = require('../../models/contact.js');
var Email = require('../../models/email.js');


router.post('/', function(req,res,next){
	if(!req.body.contacts) res.status(400).send("no contacts provided");
	var emails = [];
	var emailDic = {};
	for(var i = 0; i < req.body.contacts.length; i++){
		contact = req.body.contacts[i];
		contact['owner'] = req.user.username;

		for(var j = 0; j < contact.emails.length; j++){
			email = contact.emails[j];
			if(email in emailDic){
				res.status(400).send("Email: " + email + " duplicated");
			}
			emails.push({email: email, owner:req.user.username});
		}
	}
	var emailPromise = new Promise(function(resolve, reject){
		Email.getItems(emails, function(err, emails){
			if(err)reject(err);
			else resolve(emails);
		});
	}).then( function(emails){


		if(emails.length != 0){
			res.status(400).send({reason: "Concats with following emails are already created. Please delete them before import.", emails: emails});
			return;
		}
		// Because the promises all and dynogels's fail fast batch async behavior, I need
		// to construct my manual promise all list in order to get the list of items that
		// was succesfully created. 
		var promises = [];
		for(var i  = 0; i < req.body.contacts.length; i++){
			promises.push(new Promise(function(resolve, reject){
				Contact.create(req.body.contacts[i], function(err, contact){
					if(err) resolve({status: "errored",reason: err,contact: err._object});
					else resolve({ status: "passed", contact: contact.get()});
				});
			}));
		}

		Promise.all(promises).then(values =>{
			
			var emails = [];
			var errMessage = [];
			for(var i = 0; i < values.length; i++){
				if(values[i].status == 'passed'){
					emails = emails.concat(values[i].contact.emails.map(elem => { return {owner: req.user.username, email:elem}}));
				}else{
					errMessage.push({
						contact: values[i].contact,
						reason: values[i].reason.details
					});
				}
			}
			Email.create(emails,function(err, emails){
				if(err){
					//Since we did all the check, and the contacts with those emails passed validation in the previous phase,
					// this really shouldn't happen 
					res.status(500).send("email creating error, " + err);
				} else{
					if(errMessage.length != 0){
						res.status(400).send(errMessage);
					} else{
						res.status(200).send("contacts created");
					}
				}
			});


		});
	}).catch(err =>{
		res.status(400).send(err);
	});



});


module.exports = router;