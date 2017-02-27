This is the submission from Tianyu Yang (ty2345@columbia.edu). I am the one who wants the internship position. 

This implementation on express framework and uses AWS dynamoDB. It is prepared and tested to be deployed on AWS ElasticBeanstalk. Use http://brightcrowd-tianyu.us-east-1.elasticbeanstalk.com/ as base url if you want to have a try. Just please don't abuse the database because I am broke. 

This application authenticates users using jsonwebtoken(JWT). Users need to be authenticated by posting their username and password ({'username': 'jacky', 'password':'ps1'}) to /login and get the token. All the requests to /api/contacts require authentication requires a Authorization header whose value should be "Bearer YOURTOKENHERE".   The authentication implementation is naive and I understand i need SSL and hashed/salted password for that.

I think the one of the difficulties of this challenge is the definition of "conflict contacts". People can have same name or same title. So when we saw two profiles with same names, we can not just assume it is conflict and merge the contacts because it might very well be two different person.  The one thing will remain unique is the email address. That is why my implementation require email address for POST and won't allow a user to create contacts with overlapped email addresses under the same owner.  In order to achieve this without scanning the whole database for each import, I have a seperate table which only have email address and owner username. (DynanoDB allows duplicated hashkey as long as there is also a rangekey and those two together is unique). Import will fail if the data contains duplicated email under the same username. This decision might made my codebase unnessesarily complex but in the name of performance I think it is worth it. 

For get, user can have a query string following ?q=  . This will scan the whole database looking for contacts which names and titles contains the query string.  I think the current implementation of AWS dynamoDB do not support filtering list attibute, that is why emails are not check in the query. The resulted contacts are seperated two lists, one contains the user's own contact list and the other contains those created by other users in case the user "need additional information".  

For merge, it will only proceed if the two contacts' names are same. Then the emails will be concated to the main profile and upload to the database. Since the post requires name, the only attribute will be merged into the main contact if it does not already have one is "title".

Note: My previous full stack experience contains mainly Django and some AWS lambda. So I pratically learned node.js and every middleware I used in the past day. I tried to do things properly by using packages like dynogels to create models and express-jwt to authenticate users. But still you would notice different coding pattern and behavior on different part of my program since I was on learning phase.  



