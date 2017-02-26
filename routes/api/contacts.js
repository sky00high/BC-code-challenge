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

			if(err){
				reject(err);
			}else{
				resolve(emails);
			}
			
		});
	});

	emailPromise.then(function(emailsInDatabase){


		var promise = new Promise(function(resolve, reject){
			if(emailsInDatabase.length != 0){
				reject({error: "some email already existed in database", existed_emails: emailsInDatabase});
			} else{
				Contact.create(req.body.contacts, function (err, contacts){
					if(err){
						reject({
							error: "contacts creation",
							detail: err.details,
							created: err._object
						});
					} else{
						var emails = [];
						for(var i = 0; i < contacts.length; i++){
							for(var j = 0; j < contacts[i].attrs.emails.length; j++){
								emails.push({
									email: contacts[i].attrs.emails[j],
									owner: req.user.username,
								});
							}
						}
						resolve({emails: emails, err: err});
					}

				});
			}
		});

		return promise;

	}).then(function(resolveData){
		print("lalala");
		Email.create(resolveData.emails,function(err, emails){
			if(err){
				//Since we did all the check, this really shouldn't happen
				res.status(500).send("email creating error, this shouldn't happen " + err);
			} else{
				if(resolveData.err){
					res.status(400).send("err: " + resolveData.err);
				} else{
					res.status(200).send("contacts created");
				}
			}



		});
	}).catch(function(err){
		res.status(400).send(err);
	});

	



});


module.exports = router;