var express = require('express');

var router = express.Router();
var Contact = require('../../models/contact.js');
var Email = require('../../models/email.js');

function prepareContactsForReturn(contacts, username){
	var ownContacts = [];
	var createdByOthers = [];

	for(var i = 0; i < contacts.length; i++){
		var contact = contacts[i];
		contact.id = contact.UUID;
		delete contact.UUID;
		if(contact.owner == username)ownContacts.push(contact);
		else createdByOthers.push(contact);
	}

	return {
		contacts: ownContacts,
		created_by_others: createdByOthers
	}
}

router.put('/:id1/merge/:id2', function(req,res,next){
	var username = req.user.username;
	var getContactPromise = function(id){
		return new Promise((resolve, reject)=>{
			Contact.get(id, (err, contact)=>{
				if(err) reject({code:500, message:err});
				else if(contact == null) reject({code:404, message:'Contact do not exist'});
				else resolve(contact);
			});
		});
	}

	Promise.all([getContactPromise(req.params.id1), getContactPromise(req.params.id2)])
	.then(contacts =>{
		var mainContact = contacts[0].get('UUID') == req.params.id1? contacts[0] : contacts[1];
		var secondaryContact = contacts[0].get('UUID') == req.params.id1? contacts[1] : contacts[0];

		if(mainContact.get('name').first != secondaryContact.get('name').first || mainContact.get('name').second != secondaryContact.get('name').second){
			throw({code:400, message:'can not merge two contact with different names'});
		}else if (mainContact.get('owner') != username){
			throw({code:400, message:'can not merge because you do not own the main profile'});
		}else{
			var mainEmails = mainContact.get('emails');
			for(var i = 0; i < secondaryContact.get('emails').length; i++){
				var email = secondaryContact.get('emails')[i];
				if(!mainEmails.includes(email)){
					mainEmails.push(email);
				}
			}

			mainContact.set({emails: mainEmails});

			return new Promise((resolve, reject)=>{
				mainContact.update(err =>{
					if(err) reject({code:500, message:err.toString()});
					else resolve(mainContact);
				});

			});

		}
	}).then(mainContact=>{
		mainContact = mainContact.get();
		delete mainContact.UUID;
		delete mainContact.owner;
		res.status(200).send({merged_contact: mainContact});
	}).catch(err =>{
		if(!err.code) {
			console.log(err);
			err = {code:500, message:err.toString()};
		}
		res.status(err.code).send({"message": err.message});
	});



});

router.get('/', function(req, res, next){
	var username = req.user.username;
	if(req.query.q){
		Contact.scan().filterExpression('contains(#name.#first, :q) OR contains(#name.#last, :q) OR contains(#title, :q)')
		.expressionAttributeValues({ ':q' : req.query.q})
		.expressionAttributeNames({'#name': 'name', '#first':'first', '#last':'last',  '#title' : 'title'})
		.loadAll().exec((err, resp) =>{
			if(err) res.status(400).send(err);
			else {
				res.status(200).send(resp.Items);
			}
		});
	} else {
		Contact.scan().loadAll().exec((err, resp) =>{

			if(err) res.status(400).send(err);
			else {
				var contacts = resp.Items.map(item => item.get());
				contacts = prepareContactsForReturn(contacts, username);
				res.status(200).send(contacts);
			}
		});
	}
});

router.delete('/:id', function(req,res,next){
	var username = req.user.username;
	var getPromise = new Promise((resolve, reject) =>{
		Contact.get(req.params.id, (err, contact)=>{
			if(err)reject(err);
			else {
				if(!contact){
					reject({code: 404, message:'contact do not exist'});
					
				}else{
					resolve(contact.get());
				}
			}
		});
	});

	getPromise.then(contact=>{
		if(contact.owner != username){
			throw({code:400, message:"You do not own this contact"});
		}
		var promises = [];
		var deleteContactPromise = new Promise((resolve, reject)=>{
			Contact.destroy(req.params.id, err=>{
				//Really shouldn't happen. Only possibility it happens is 
				//somebody deleted this contact with same login credential
				//after we did the previous get.
				if(err)reject({"code":500, "message" : "Delesion Failed"});
				else {
					resolve();
				}
			});
		});

		promises.push(deleteContactPromise);
		var emails = contact.emails;
		for(var i = 0; i < emails.length; i++){
			promises.push(
				new Promise((resolve, reject)=>{
					var email = emails[i];
					Email.destroy({'email': email, 'owner': username}, err=>{
						if(err) reject(err);
						else {
							resolve();
						}
					})
				})
			);
		}
	

		Promise.all(promises).then( _ =>{
			res.status(202).send();
		}).catch(err => {
			throw({code:500, message:'deletion failed'});
		} );

	}).catch(err=>{
		res.status(err.code).send({"message" : err.message});
	});



});
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