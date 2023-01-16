# Express Auth Microservice Example
Example project of an Express server used as a microservice to authenticate users.

This app is built as if it were deployed to Google Cloud Run as a Docker-contained application, but it isn't deployed anywhere. 

It shows you the exact code and settings needed to create a production-ready server.

## Intended usage

This backend microservice is intended to be used by a variety of frontends. This could be a ReactJS app in a browser, it could be a Unity game running on a Nintendo Switch - anything.

- Users are created when a frontend client makes a HTTP POST request containing JSON body data to `/users/signup`
	- The JSON body data object must have an  `email` property and a `password` property.

- Users are logged in when a frontend client makes a HTTP POST request containing JSON body data to `/users/login`
	- The JSON body data object must have an  `email` property and a `password` property.
	- This route returns the user data as an object, as well as two JWTs.
		- Long-lived JWTs should only be used to keep users logged in and allow for "read" access to various other parts of the system.
		- Short-lived JWTs should be used when a user is trying to create, update or delete data within the system, or perform an action that really requires a real human to definitely be involved (such as adding a Discord account to their email/pass account, or changing their password).

- The different types of JWTs can be refreshed by sending a valid JWT to various routes.
	- JWTs should be set as the Authorization header of any relevant requests, 
	- Most user routes will return refreshed JWTs alongside any other expected response data.
	- `/users/getUserFromJwtLong` and `/users/getUserFromJwtShort` both return the respectively-lived JWT (new ones) alongside the user data object
	- `/users/longlivedsecure` and `/users/shortlivedsecure` both return the respectively-lived JWT (old and new) alongside the user data object

- When a user is created, they have an `isEmailVerified` property set to false and an email sent to their provided email account.
	- The email provides a link to `/users/emailVerification`, which also includes a user-specific token. Once successfully verified from this route, the user is redirected to the frontend web client.

- When a user is using the system on a TV device or other limited-input device, the frontend client on that device should make a request to `/users/tv/getcode`.
	- (Not yet implemented) A token code is created and then emailed to the user.
	- The user can manually input into the limited-input frontend client.
	- The user-inputted `tvCode` token is then sent from the limited-input device to `/users/tv/checkcode/:code`, where a successful token verification returns JWTs to represent a logged-in user.

- OAuth integrations with Discord and Twitch are implemented
	- Frontends make requests to `/users/oauth/discord` or `/users/oauth/twitch` with a short-lived JWT included as a query parameter
	- Those routes redirect to the respective platform's login page with the short-lived JWT included as OAuth state (which is not intended OAuth usage, pretty sure), which then redirects back to either a localhost or production route depending on the server environment
	- `/users/discord/redirect` and `/users/twitch/redirect` handle the redirect from the platform login page back to the server
		- these routes use the OAuth state (those short-lived JWTs) to authenticate the user within the server
		- these routes use the returned OAuth access token to fetch platform-specific user data
		- these routes use the JWT/local user data combined with the fetched platform-specific data to set up a record in the local user data
		- eg. Server User A has a Mongoose subdoc created about OAuthProvider 1 which includes the OAuthProvider 1 user ID and username
		- This basically means the server only knows a user's user ID and username from other platforms, but that is plenty of data for things like Twitch Drops and other webhook-based services (all not implemented/shown in this lil example project because those features require additional products to have been published).
	- So, users can't "log in" via Discord or Twitch - but their data is recorded for additional, out-of-scope features.


For additional data like a user profile or blog post, additional servers should be written. Those other servers can then make their own requests to this authentication server.


## TODO

- `src/controllers/middleware/AuthMiddleware.js` 
	- parseUserLogin function - needs to be written to read body data and return JWTs
	- routeRequiresLongLivedJwtParam - needs to be rewritten to not use PassportJS
	- routeRequiresLongLivedJwtParam - needs to be rewritten to not use PassportJS
- `src/controllers/functions/AuthFunctions.js`
	- createTvLoginToken function should send the token to the user via email, not return the token as part of of the request/response flow.
	- move createTvLoginToken and verifyTvLoginToken to `src/controllers/middleware/AuthMiddleware.js`
- `/README.md`
	- include info about Postmark / the email functionality
	- explain the server testing
	- maybe add some info about the "everything is middleware" structure of the routes