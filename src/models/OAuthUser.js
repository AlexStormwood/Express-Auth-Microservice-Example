var mongoose = require('mongoose');

// Get into the habit of using Schemas instead of directly making Models
// It's easier to configure special behaviour on Schemas than on Models!
var Schema = mongoose.Schema;

var OAuthUserSchema = new Schema({
  providerName: {
    type: String,
    required: true
  },
  profileId: {
    type: String,
    required: true
  }
});

// So an OAuthUser document could look like:
/*
{
    providerName: "twitch",
    profileId: "someRealTwitchProfileId"
}
*/

// Export the schema, as we don't want this to be an
// actual model
// OAuthUser is a subdocument in User!
module.exports = {OAuthUserSchema};