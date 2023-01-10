// Make the .env data ready for use.
const dotenv = require('dotenv');
dotenv.config();

const postmark = require('postmark');
const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN)
const noreply_email = process.env.NOREPLY_EMAIL_ADDRESS;
/**
 * Send a given email to a given recipient. Verifies that the email service is working before sending.
 * @param {string} recipient Email address that the email will be sent to.
 * @param {string} eSubject Title subject of the email that will be sent.
 * @param {string} eText Text or HTML as string, the content of the email that will be sent.
 * @returns Object of information about the mail sending result on success, or an error object on a failure.
 */
async function sendEmail (recipient, eSubject, eText) {

    let mailOptions = {
        "From": noreply_email,
        "To": recipient,
        "Subject": eSubject,
        "TextBody": eText,
        "MessageStream":"broadcast"
    }

    let mailResult = await postmarkClient.sendEmail(mailOptions)

    return mailResult;
}

async function sendUserVerificationEmail(recipientEmail, verificationToken) {
    let mailOptions = {
        "From": noreply_email,
        "To": recipientEmail,
        "TemplateAlias": "signup-confirmation",
        "TemplateModel": {
            "user_token": verificationToken
        },
        "MessageStream":"outbound"
    }

    let mailResult = await postmarkClient.sendEmailWithTemplate(mailOptions)

    return mailResult;
}


module.exports = {
    sendEmail, sendUserVerificationEmail
}