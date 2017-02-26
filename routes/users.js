var express = require('express');
var router = express.Router();
var User = require('../models/user.js');
/* GET users listing. */
/*
router.get('/', function(req, res, next) {
  User.scan().exec(function(err, resp){
  	if(err){
  		console.log('error running scan', err);
  	}else{

  		res.send(JSON.stringify(resp.Items));
  	}


  });
});
*/
router.post('/', function(req,res,next){
	console.log(req.body);
	User.create({
		username : req.body.username,
		password : req.body.password
	}, {
		overwrite:false
	}, function (err, user){

		if(!err){
			console.log("user " + user.username + " created");
			res.status(200).send();

		} else{ 
			console.log("user  erred " + err);
			res.status(400).send({"error":err});
		}

	});

});

module.exports = router;
