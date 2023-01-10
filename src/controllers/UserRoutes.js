const querystring = require('node:querystring');
const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const {
    generateJwtLongLived, generateJwtShortLived,
    refreshJwtLongLived, refreshJwtShortLived,
    decodeJwtLongLived, decodeJwtShortLived,
    routeRequiresLongLivedJwtHeader, routeRequiresShortLivedJwtHeader,
    routeRequiresLongLivedJwtParam, routeRequiresShortLivedJwtParam, generateJwtsForUser, 
    createTvLoginToken, verifyTvLoginToken
} = require('./functions/AuthFunctions');
const { verifyUserEmail, findOrAssignUserViaOauthProviderId } = require('./functions/UserFunctions');

router.post('/signup',
    body('email').isEmail().withMessage("Must be a valid email address."),
    body('password').isLength({ min: 8 }).withMessage("Must be a strong password."),
    passport.authenticate('signup', {session: false}),
    async (request, response, next) => {
        console.log("Signing up")
        response.json({
            message: request.message,
            user: request.user,
            tokens: generateJwtsForUser(request.user)
        })
    }
);

router.post('/login',
    async (request, response, next) => {
        passport.authenticate(
            'login',
            async (error, user, info) => {
                try {
                    if (error || !user) {
                        let newError = new Error(error?.message || "An issue occured logging you in. Please try again later.");
                        newError.status = 400;
                        return next(newError);
                    }
                    request.login(
                        user,
                        {session: false},
                        async (error) => {
                            if (error) return next (error);

                            return response.json({
                                tokens: generateJwtsForUser(user)
                            });
                        }
                    );

                } catch (error) {
                    return next(error);
                }
            }
        // what is this syntax??
        )(request, response, next)
    }
);

router.get(
    '/getUserFromJwtLong',
    routeRequiresLongLivedJwtHeader,
    (request, response, next) => {
        console.log(`Getting user details of user with ID ${request.user._id}`);
        response.json({
            user: request.user,
            tokens: request.tokens
        });
    }
);

router.get(
    '/getUserFromJwtShort',
    routeRequiresShortLivedJwtHeader,
    (request, response, next) => {
        console.log(`Getting user details of user with ID ${request.user._id}`);
        response.json({
            user: request.user,
            tokens: request.tokens
        });
    }
);

router.get(
    '/longlivedsecure',
    routeRequiresLongLivedJwtHeader,
    (request, response, next) => {
        console.log("Responding on private route now...")
        response.json({
            message:"You made it!",
            user: request.user,
            oldToken: request.headers["authorization"].replace('Bearer ', ''),
            newTokens: request.tokens
        });
    }
);

router.get(
    '/shortlivedsecure',
    routeRequiresShortLivedJwtHeader,
    (request, response, next) => {
        console.log("Responding on private route now...")
        response.json({
            message:"You made it!",
            user: request.user,
            oldToken: request.headers["authorization"].replace('Bearer ', ''),
            newTokens: request.tokens
        });
    }
);

// Email verification route
router.get(
    '/emailVerification',
    async (request, response, next) => {
        let userVerificationToken = request.query.token;
        try {
            let holdForVerification = await verifyUserEmail(userVerificationToken);
        } catch (error){
            // Something went wrong in verifyUserEmail, 
            // jump to the error-handling responder.
            next(error);
        }

        // Redirect to the front end web client.
        response.redirect("https://bigfootds.com/")
    }
);


// Create a TV token for a quick TV-based login
// eg. game consoles, TV apps
router.get(
    '/tv/getcode',
    routeRequiresShortLivedJwtHeader,
    createTvLoginToken,
    async (request, response, next) => {

        response.json({
            user: request.user,
            tokens: request.tokens,
            tvCode: request.newTvCode
        });
    }
);

// Exchange a TV token for JWTs
router.get(
    '/tv/checkcode/:code',
    verifyTvLoginToken, 
    async (request, response, next) => {

        response.json({
            user: request.user,
            tokens: request.tokens
        });
    }
);

router.get(
    '/oauth/discord',
    routeRequiresShortLivedJwtParam,
    (request, response, next) => {
        const queryObj = {
            response_type:"code",
            scope: 'identify email',
            client_id: process.env.DISCORD_CLIENT_ID,
            state: request.freshJwt,
            redirect_uri: 
                process.env.NODE_ENV == "production" ? 
                process.env.OAUTH_REDIRECT_DISCORD 
                : 
                process.env.OAUTH_REDIRECT_DISCORD_DEV
        }
        response.redirect(`https://discord.com/oauth2/authorize?${querystring.stringify(queryObj)}`)
    }
)


router.get(
    '/discord/redirect',
    async (request, response, next) => {
        console.log("Discord Oauth redirect received these params:\n"+ JSON.stringify(request.query))

        let data = new URLSearchParams({
            'client_id': process.env.DISCORD_CLIENT_ID,
            'client_secret': process.env.DISCORD_CLIENT_SECRET,
            'grant_type': 'authorization_code',
            'code': request.query.code,
            'redirect_uri': 
                process.env.NODE_ENV == "production" ? 
                process.env.OAUTH_REDIRECT_DISCORD 
                : 
                process.env.OAUTH_REDIRECT_DISCORD_DEV
        });
        let headers = {
            'Content-Type':'application/x-www-form-urlencoded'
        }
        let discordTokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: headers,
            body: data
        }).then((response) => {return response.json()});
        let discordUser = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization':`Bearer ${discordTokenResponse.access_token}`,
                'Client-Id':process.env.DISCORD_CLIENT_ID
            }
        }).then((response) => {return response.json()});

        console.log("Obj from Discord is:\n"+ JSON.stringify(discordUser));
        let freshUserJwt = await findOrAssignUserViaOauthProviderId(
            request.query.state, 
            "discord", 
            discordUser.id
        );

        response.json({
            message:"You made it!",
            jwt: freshUserJwt, 
            discordTokenResponse: discordTokenResponse,
            discordUserObj: discordUser
        });
    }
);

router.get(
    '/oauth/twitch',
    routeRequiresShortLivedJwtParam,
    (request, response, next) => {
        const queryObj = {
            response_type:"code",
            scope: 'user_read',
            client_id: process.env.TWITCH_CLIENT_ID,
            state: request.freshJwt,
            redirect_uri: 
                process.env.NODE_ENV == "production" ? 
                process.env.OAUTH_REDIRECT_TWITCH 
                : 
                process.env.OAUTH_REDIRECT_TWITCH_DEV
        }
        response.redirect(`https://id.twitch.tv/oauth2/authorize?${querystring.stringify(queryObj)}`)
    }
);

router.get(
    '/twitch/redirect',
    async (request, response, next) => {
        console.log("Twitch Oauth redirect received these params:\n"+ JSON.stringify(request.query))

        let data = new URLSearchParams({
            'client_id': process.env.TWITCH_CLIENT_ID,
            'client_secret': process.env.TWITCH_CLIENT_SECRET,
            'grant_type': 'authorization_code',
            'code': request.query.code,
            'redirect_uri': 
                process.env.NODE_ENV == "production" ? 
                process.env.OAUTH_REDIRECT_TWITCH 
                : 
                process.env.OAUTH_REDIRECT_TWITCH_DEV
        });
        let headers = {
            'Content-Type':'application/x-www-form-urlencoded'
        }
        let twitchTokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: headers,
            body: data
        }).then((response) => {return response.json()});
        let twitchUser = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization':`Bearer ${twitchTokenResponse.access_token}`,
                'Client-Id':process.env.TWITCH_CLIENT_ID
            }
        }).then((response) => {return response.json()});

        console.log("Obj from Twitch is:\n"+ JSON.stringify(twitchUser));
        let freshUserJwt = await findOrAssignUserViaOauthProviderId(
            request.query.state, 
            "twitch", 
            twitchUser.data[0].id
        );


        response.json({
            message:"You made it!",
            jwt: freshUserJwt, 
            twitchTokenResponse: twitchTokenResponse,
            twitchUserObj: twitchUser
        });
    }
);





module.exports = router;