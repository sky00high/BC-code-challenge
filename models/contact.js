var Joi = require('joi');
var dynogels = require('dynogels');
dynogels.AWS.config.update({region: "us-east-1"});
var Contact = dynogels.define('Contact', {
  hashKey : 'UUID',
  schema : {
    UUID : dynogels.types.uuid(),
    password : Joi.string().min(3).max(50),
    emails: [Joi.string().email()],
    name:{
    	first: Joi.string().regex(/^[a-zA-Z]+$/, {name: 'firstname'}).min(1).max(50),
    	last: Joi.string().regex(/^[a-zA-Z]+$/, {name: 'firstname'}).min(1).max(50)
    },
    title: Joi.string().min(1).max(100)

  }
});


dynogels.createTables(function(err) {
  if (err) {
    console.log('Error creating tables: ', err);
  } else {
    console.log('Tables has been created');
  }
});


module.exports = Contact;