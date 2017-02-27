This is the submission from Tianyu Yang (ty2345@columbia.edu)

This implementation on express framework and uses AWS dynamoDB. It is prepared and tested to be deployed on AWS ElasticBeanstalk. 

This application is authenticated jusing jsonwebtoken(JWT). Users need to be authenticated by posting their username and password ({'username': 'jacky', 'password':'ps1'}) to /login and get the tokenAll the requests to /api/contacts require authentication requires a Authorization header whose value should be "Bearer YOURTOKENHERE".

I think the one of the difficulties of this challenge is the definition of "conflict contacts". People can have same name or same title. So when we saw two profiles with same names, we can not just assume it is conflict and merge the contacts because it might very well be two different person.  The one thing will remain unique is the email address. That is why my implementation require email address for POST and won't allow a user to create contacts with overlapped email addresses.  In order to achieve this without scanning the whole database for each import, I have a seperate table which only have email address and owner username. (DynanoDB allows duplicated hashkey as long as there is also a rangekey and those two together is unique). Import will fail if the data contains duplicated email under the same username.

For get, user can have a query string following ?q=  . This will scan the whole database looking for contacts which names and titles contains the query string.  I think the current implementation of AWS dynamoDB do not support filtering attibute which is list, that is why emails are not check in the query. The resulted contacts are seperated two lists, one contains the user's own contact list and the other contains those created by other users.

For merge, it will only proceed if the two contacts' names are same. Then the emails will be concated to the main profile and upload to the database.



