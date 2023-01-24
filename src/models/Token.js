// Crypto is a NodeJS native module, not an NPM module.
const crypto = require('crypto');


const mongoose = require("mongoose");

// Get into the habit of using Schemas instead of directly making Models
// It's easier to configure special behaviour on Schemas than on Models!
const Schema = mongoose.Schema;

const tokenSchema = new Schema({
	userId: {
		type: Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	randomToken: {
		type: String,
		// unique: true, // Uniqueness in MongooseJS is quirky, handle this via a pre-hook instead.
	},
	tokenType: {
		type: String,
		required: true,
		enum: ['email-verification', 'tv-login'] // Only allow tokenType to be a string found in this array.
	}
});

// Logically, this assigning a default value to the token document. 
// However, default values that come from functions must use synchronous functions.
// MongooseJS pre-hooks allow you to do asynchronous stuff, 
// such as checking the database to make sure the new token value isn't already in use.
tokenSchema.pre('save', async function(next){

	// randomToken temporary variable declared before we start doing any looping stuff:
	let tokenResult = '';

	// Some loops don't handle async very well as per:
	// https://zellwk.com/blog/async-await-in-loops/
	// so we should use a while loop with a flag value in this function.
	let tokenIsUnused = false;
	while (!tokenIsUnused){

		// Different code logic for different token types:
		// Email verification codes aren't meant to be entered by humans in this API,
		// so they can contain any alphanumeric character.
		// TV login codes ARE meant to be entered by humans, 
		// so we should use only alphanumberic characters that don't get easily
		// mistaken for different alphanumeric characters if the frontend uses a dumb font.
		// eg. 0, O. 1, I, l.

		if (this.tokenType == 'tv-login'){
			// Should obey convention for download codes eg.
			// Nintendo only allows these characters: 
			let allowedCharacters = "0123456789ABCDEFGHJKLMNPQRSTUVWXY";
			// Read length outside of loop to minimize CPU time in this function:
			let allowedCharsLength = allowedCharacters.length;
			// Arbitrary length of the code to make:
			let tvCodeLength = 8;
			// Build up the code by iterating until the code is a certain number of characters in length.
			for (let index = 0; index < tvCodeLength; index++) {
				tokenResult += allowedCharacters.charAt(Math.floor(Math.random() * allowedCharsLength));
			}
		} else {
			// Otherwise just generate a decently hard-to-guess string.
			// 4 bytes = 8 characters in hex format.
			tokenResult = crypto.randomBytes(4).toString('hex');
		}
		// If token value is available, break the while loop.
		let existingToken = await Token.findOne({randomToken: tokenResult}).exec();
		if (!existingToken){
			tokenIsUnused = true;
		}
	}

	// If we reached this point in the pre-save hook, the token value is safe to assign to the document.
	this.randomToken = tokenResult;
	next();
});

// After the Schema has been configured, use it to create a Model.
const Token = mongoose.model("Token", tokenSchema);

// Export only the Model, as nothing is going to use this Schema other than this Model.
module.exports = {Token};