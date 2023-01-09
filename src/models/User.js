// Use bcrypt for password hashing
const bcrypt = require('bcrypt');

// Use validator for value validation with rule configuration
const validator = require('validator');

// Import needed Mongoose things to make Schemas
var mongoose = require("mongoose");
var Schema = mongoose.Schema;

// Gonna use OAuthUserSchema as subdocuments in a User
const { OAuthUserSchema } = require('./OAuthUser');


var UserSchema = new Schema({
  email: { 
    type: String, 
    required: true,
    unique: true,
    validate: {
      validator: function (newValue) {
        // Default email rules outlined here:
        // https://github.com/validatorjs/validator.js#:~:text=isEmail(str%20%5B%2C%20options%5D)
        // Return true/false. True if valid, false if invalid.
        return validator.isEmail(newValue);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  password: { 
    type: String, 
    required: true,
    minLength: 8, // Validate in as many places as possible!
    validate: {
      validator: function (newValue) {
        // Default passworld rules outlined here:
        // https://github.com/validatorjs/validator.js#:~:text=isStrongPassword(str%20%5B%2C%20options%5D)
        let passwordStrengthRules = { 
          minLength: 8, 
          minLowercase: 1, 
          minUppercase: 1, 
          minNumbers: 1, 
          minSymbols: 0, // Literally the only change to validator.isStrongPassword default settings.
          returnScore: false, 
          pointsPerUnique: 1, 
          pointsPerRepeat: 0.5, 
          pointsForContainingLower: 10, 
          pointsForContainingUpper: 10, 
          pointsForContainingNumber: 10, 
          pointsForContainingSymbol: 10 
        };
        // Return true/false. True if valid, false if invalid.
        return validator.isStrongPassword(newValue, passwordStrengthRules);
      }, 
      message: props => `${props.newValue} does not meet password requirements!`
    } 
  },
  isEmailVerified: {
    type: Boolean,
    default: false // Default _value_ is false.
  },
  OAuthUsers: [OAuthUserSchema] // Subdocuments! User can have multiple OAuth providers, so this is an array.
}, 
{
  timestamps: true // MongooseJS schema option that enables extra fields in the doc about when the User doc was created, useful for random frontend things like "Member since 2004".
});

// Use instance.save() when modifying a user's password
// to trigger this pre-hook
UserSchema.pre(
  'save',
  async function (next) {
    const user = this;
    // If password wasn't changed, skip to next function in the save process.
    if (!user.isModified('password')) return next();
    // If password was changed, assume it was changed to plaintext and hash it.
    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;
    next();
  }
);

// Create a helper function on the Schema for any Model instances to use.
UserSchema.methods.isMatchingPassword = async function (password) {
    const user = this;
    // Compare plaintext user-provided password to hashed already-saved password.
    const compare = await bcrypt.compare(password, user.password);
    // Return true/false. True if valid, false if invalid.
    return compare;
}


// After the Schema has been configured, use it to create a Model.
const User = mongoose.model('User', UserSchema);

// Export only the Model, as nothing is going to use this Schema other than this Model.
module.exports = {User}