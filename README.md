# Express Auth Microservice Example
Example project of an Express server used as a microservice to authenticate users.

This app is built as if it were deployed to Google Cloud Run as a Docker-contained application, but it isn't deployed anywhere. 

It shows you the exact code and settings needed to create a production-ready server.

## Pages

- [The CI/CD Pipeline](./_docs/TheCicdPipeline.md)
- [The Server Functionality Explained](./_docs/TheServer.md)



## TODO

- `src/controllers/middleware/AuthMiddleware.js` 
	- parseUserSignup function - needs to actually get email & password from the request body as per the original BigfootDS API code
	- parseUserLogin function - needs to be written to read body data and return JWTs
	- routeRequiresLongLivedJwtParam - needs to be rewritten to not use PassportJS
	- routeRequiresLongLivedJwtParam - needs to be rewritten to not use PassportJS
- `src/controllers/functions/AuthFunctions.js`
	- createTvLoginToken function should send the token to the user via email, not return the token as part of of the request/response flow.
- `/README.md`
	- include info about Postmark / the email functionality
	- explain the server testing
	- maybe add some info about the "everything is middleware" structure of the routes
