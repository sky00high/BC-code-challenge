var express = require('express');
var router = express.Router();
var User = require('../models/user.js');
/* GET users listing. */
router.get('/', function(req, res, next) {
  User.scan().exec(function(err, resp){
  	if(err){
  		console.log('error running scan', err);
  	}else{

  		res.send(JSON.stringify(resp.Items));
  	}


  });
});

router.post('/', function(req,res,next){

	User.create({
		username : req.body.username,
		password : req.body.password
	}, function (err, user){

		if(!err)console.log("user " + user.username + " created");
	});

});

module.exports = router;
