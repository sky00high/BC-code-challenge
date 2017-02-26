var Joi = require('joi');
var dynogels = require('dynogels');
dynogels.AWS.config.update({region: "us-east-1"});
var Email = dynogels.define('Email', {
  hashKey : 'email',
  rangeKey: 'owner',
  schema : {
    email : Joi.string().email(),
    owner : Joi.string().min(3).max(50).required(),
  }
});


dynogels.createTables(function(err) {
  if (err) {
    console.log('Error creating tables: ', err);
  } else {
    console.log('Tables has been created');
  }
});


module.exports = Email;