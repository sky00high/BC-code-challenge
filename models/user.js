var Joi = require('joi');
var dynogels = require('dynogels');
dynogels.AWS.config.update({region: "us-east-1"});
var User = dynogels.define('User', {
  hashKey : 'username',
  schema : {
    username : Joi.string().min(3).max(50),
    password : Joi.string().min(3).max(50).required(),
  }
});


dynogels.createTables(function(err) {
  if (err) {
    console.log('Error creating tables: ', err);
  } else {
    console.log('Tables has been created');
  }
});
console.log('user.js in module executed');

module.exports = User;