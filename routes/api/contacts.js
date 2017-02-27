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
	};

	Promise.all([getContactPromise(req.params.id1), getContactPromise(req.params.id2)])
	.then(contacts =>{
		//Getting the two contacts, construct the new emails that need to be added into this user's contact list
		var mainContact = contacts[0].get('UUID') == req.params.id1? contacts[0] : contacts[1];
		var secondaryContact = contacts[0].get('UUID') == req.params.id1? contacts[1] : contacts[0];

		if(mainContact.get('name').first != secondaryContact.get('name').first || mainContact.get('name').last != secondaryContact.get('name').last)
			throw({code:400, message:'can not merge two contact with different names'});
		if (mainContact.get('owner') != username)
			throw({code:400, message:'can not merge because you do not own the main profile'});
		
		var mainEmails = mainContact.get('emails');
		var newEmails = [];
		for(var i = 0; i < secondaryContact.get('emails').length; i++){
			var email = secondaryContact.get('emails')[i];
			if(!mainEmails.includes(email)){
				mainEmails.push(email);
				if(secondaryContact.get("owner") != username) newEmails.push(email);
			}
		}

		mainContact.set({emails: mainEmails});
		if(!mainContact.get('title')) mainContact.set({'title': secondaryContact.get('title')});


		return new Promise((resolve, reject)=>{
			//This promise check if the emails need to be added into this user's contact list 
			//already exists. If so that means if we merge those emails onto this contact
			//there will be multiple users have same email address on this user's contact list. 
			if(newEmails.length == 0){
				resolve({newEmails: newEmails, mainContact:mainContact});
			} else{
				newEmails = newEmails.map(elem=>{return {email:elem, owner:username};});
				Email.getItems(newEmails, (err, emails)=>{
					if(emails.length == 0) resolve({newEmails: newEmails, mainContact, mainContact});
					else reject({code:400, message: "the contact you want to merge from belongs to other owner and its email address already exist in your contact list."});
				});
			}

		});
	}).then(result =>{
		var newEmails = result.newEmails;
		var mainContact = result.mainContact;
		return new Promise((resolve, reject)=>{
			//This promise simply adding those emails onto this user's contact list
			if(newEmails.length == 0) resolve(mainContact);
			Email.create(newEmails, (err, emails)=>{
				if(err) reject({code:500, message:"Email creation failure"});
				else resolve(mainContact);
			});
		});
	}).then(mainContact =>{
		return new Promise((resolve, reject) =>{	
			//Since we have taken care of those emails. Finally update the contact entry	
			mainContact.update(err =>{
				if(err) reject({code:500, message:err.toString()});
				else resolve(mainContact);
			});
		});
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

	function contactGetCallback(err, resp){
		if(err) res.status(400).send(err);
		else {
			var contacts = resp.Items.map(item => item.get());
			contacts = prepareContactsForReturn(contacts, username);
			res.status(200).send(contacts);
		}

	}
	if(req.query.q){
		Contact.scan().filterExpression('contains(#name.#first, :q) OR contains(#name.#last, :q) OR contains(#title, :q)')
		.expressionAttributeValues({ ':q' : req.query.q})
		.expressionAttributeNames({'#name': 'name', '#first':'first', '#last':'last',  '#title' : 'title'})
		.loadAll().exec(contactGetCallback);
	} else {
		Contact.scan().loadAll().exec(contactGetCallback);
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
	}).then(contact=>{
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
	
		//had to nest promise. I know this is not a goodthing to do but 
		//I really don't know how to chain multiple promises after this one
		Promise.all(promises).then( _ =>{
			res.status(202).send();
		}).catch(err => {
			if(!err.code) err = {code:500, message: err.toString()};
			res.status(err.code).send(err);
		} );

	}).catch(err=>{
		if(!err.code) err = {code:500, message: err.toString()};
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
				res.status(400).send({message: "Email: " + email + " duplicated. Please remove contacts with duplicated emails before importing"});
				return;
			} else{
				emailDic[email] = 1;
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
			throw({code:400, message: "Concats with following emails are already created. Please delete them before import.", emails: emails});
		}
		// Because the promises all and dynogels's fail fast batch async behavior, I need
		// to construct my manual promise all list in order to get the list of items that
		// was succesfully created. 
		var promises = [];
		for(var i  = 0; i < req.body.contacts.length; i++){
			promises.push(new Promise(function(resolve, reject){
				Contact.create(req.body.contacts[i], function(err, contact){
					if(err) resolve({status: "errored",reason: err.message,contact: err._object});
					else resolve({ status: "passed", contact: contact.get()});
				});
			}));
		}

		Promise.all(promises).then(values =>{

			//go past all the result, find out the created contacts and those who failed.
			//For created contacts, add them into the email database as well
			var emails = [];
			var errMessage = [];
			for(var i = 0; i < values.length; i++){
				if(values[i].status == 'passed'){
					emails = emails.concat(values[i].contact.emails.map(elem => { return {owner: req.user.username, email:elem}}));
				}else{
					errMessage.push({
						contact: values[i].contact,
						reason: values[i].reason
					});
				}
			}
			Email.create(emails,function(err, emails){
				if(err){
					//Since we did all the check, and the contacts with those emails passed validation in the previous phase,
					// this really shouldn't happen 
					throw({code:500, message: "email creating error, " + err.toString()});
				} else{
					if(errMessage.length != 0){
						res.status(400).send(errMessage);
					} else{
						res.status(200).send("contacts created");
					}
				}
			});


		}).catch(err=>{

			if(!err.code) err = {code:500, message:err.toString()};
			res.status(err.code).send(err);

		});
	}).catch(err =>{
		if(!err.code) err = {code:500, message:err.toString()};
		res.status(err.code).send(err);
	});
});


module.exports = router;