const validator = require('validator');

const {User} = require('../../models/User');
const {Token} = require('../../models/Token');
const { decodeJwtShortLived, generateJwtLongLived, generateJwtShortLived } = require('../Authentication/AuthFunctions');
const { sendUserVerificationEmail } = require('../Emails/EmailFunctions');

/**
 * Retrieve all users in the database.
 * Why would you do this to our poor lil database?
 * @returns Array of user document objects.
 */
async function getAllUsers(){
    return await User.find().exec();
}

/**
 * 
 * @param {string} UserId The document ID of the user you are searching for.
 * @returns A user document object.
 */
async function getUserById(UserId){
    return await User.findById(UserId).exec();
}

/**
 * Find a single user by searching for a user with a specific email address.
 * @param {string} targetEmail The email address you want to filter users by.
 * @returns A user document object.
 */
async function getUserByEmail(targetEmail){
    return await User.findOne({email: targetEmail}).exec();
}

/**
 * Validates the given inputs and creates the data if the inputs are valid.
 * @param {string} email String representing the plaintext user email address.
 * @param {string} password String representing the plaintext user password.
 * @returns A user document object.
 */
async function createUser(email, password){
    // Check if email is valid
    if (!validator.isEmail(email)) {
        throw new Error("Invalid email address detected.");
    }

    // Check if password meets requirements
    //      Minimum 8 characters
    //      Includes at least one (1) capital letter
    //      Includes at least one (1) number
    let passwordStrengthRules = { 
        minLength: 8, 
        minLowercase: 1, 
        minUppercase: 1, 
        minNumbers: 1, 
        minSymbols: 0, 
        returnScore: false, 
        pointsPerUnique: 1, 
        pointsPerRepeat: 0.5, 
        pointsForContainingLower: 10, 
        pointsForContainingUpper: 10, 
        pointsForContainingNumber: 10, 
        pointsForContainingSymbol: 10 
    };
    if (!validator.isStrongPassword(password, passwordStrengthRules)){
        throw new Error("Password too weak to be allowed.");
    }

    // Any validation that can be done before we do something 
    // expensive/slow such as a database call
    // should be done first, so we can throw errors cheaply/quickly.

    // Validation involving database calls happen last...
    // Check if email is in use
    let preExistingUser = await User.findOne({email: email}).exec();
    // Returns false/falsey value if user with this email does not exist.
    if (preExistingUser){
        throw new Error("Email already in use.");
    }

    // Create user record
    let newUser = await User.create({
        password: password,
        email: email
    });
    // Model.create() triggers the pre-save hook, so passwords are hashed automatically.

    // User created, email not yet verified.

    // Create token record for email validation
    let newToken = await Token.create({
        userId: newUser.id,
        tokenType: "email-verification"
    });

    // Send email verification out to user
    let emailResult = await sendUserVerificationEmail(newUser.email, newToken.randomToken);
    if (emailResult.error){
        // Should only reach here if:
        // - Postmark goes down
        // - Postmark changed its API
        // - user email is invalid but snuck past the validation

        // Throwing an error will mean that the user document (which was successfully created)
        // does not get returned. Keep that in  mind when calling this function!
        throw new Error("Email verification sending failed.\n"+JSON.stringify(emailResult.error));
    }
    // Return user
    return newUser;
}


/**
 * Applies the data provided in updateObj to the user record found matching the ID provided in the validJwt.
 * Calls various validation middleware before saving to the database.
 * Will return the modified user record on success, or an error on failure.
 * @param {string} validJwt A valid JWT to authenticate the user's action to modify data. Should be short-lived for safety purposes.
 * @param {object} updateObj Key-value pair where the key is the property to update, and the value is the new value.
 * @returns {object} The user record that now has the updateObj data applied to it.
 */
async function updateUser(validJwt, updateObj){
    let modifiedUser = {};

    return modifiedUser;
}

/**
 * Given a valid JWT, the user specified in the validJwt must match the user specified in userId.
 * If that condition is met, the user will be deleted.
 * @param {string} validJwt A valid JWT to authenticate the user's action to modify data. Should be short-lived for safety purposes.
 * @param {string} userId A sanity check - this ID must match the ID given in the validJwt.
 * @returns Boolean. True on successful delete, false on an error.
 */
async function deleteUser(validJwt, userId){
    let deletedUser = {};

    return deletedUser;
}

/**
 * Give this a valid JWT, an OAuth provider name and an OAuth user ID, read and/or modify user data and then return a newer JWT.
 * @param {string} userJwt A valid JWT to authenticate the user's action to modify data. Should be short-lived for safety purposes.
 * @param {string} providerName A simple name to represent an OAuth provider, such as "twitch" for Twitch.
 * @param {string} profileId The user's ID in the OAuth provider's platform.
 * @returns {string} A valid JWT created after the user's data has been checked or modified appropriately with regards to the OAuth provider data.
 */
async function findOrAssignUserViaOauthProviderId(userJwt, providerName, profileId) {
    let userJwtDecoded = decodeJwtShortLived(userJwt);
    let existingUser = await User.findOne({id: userJwtDecoded.id}).exec();
    // Find OAuthUser in existingUser.OAuthUsers where providerName == the argument providerName
    let connectedAccounts = existingUser.OAuthUsers;
    let oauthConnection = connectedAccounts.find(conAccount => {
        if (conAccount.providerName == providerName) {
            return true;
        } 
        return false;
    });
    if (oauthConnection){
        // BigfootDS account has a Twitch profile integration
        // Check if it's the same Twitch account just used to log in...
        if (oauthConnection.profileId != profileId) {
            throw new Error("Account already connected to a different profile from this OAuth provider. Please double-check account settings in both that OAuth provider and BigfootDS!");
        } else {
            // Do nothing, JWT is made outside of this if-else nested chain.
        }
    
    } else {
        // The BigfootDS account does NOT have an 
        // OAuth profile integration for this OAuth provider,
        // so let's create one!
        existingUser.OAuthUsers.push({
            profileId: profileId,
            providerName: providerName
        });
        let updatedUser = await existingUser.save();
        existingUser = updatedUser;
    }
    

    let freshJwt = {
        longLived: generateJwtLongLived(existingUser),
        shortLived: generateJwtShortLived(existingUser)
    }
    return freshJwt;
}




module.exports = {
    getAllUsers, getUserById, getUserByEmail,
    createUser,
    findOrAssignUserViaOauthProviderId,
}