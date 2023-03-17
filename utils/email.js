const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');
const postmark = require('postmark');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.from = `Duc Minh <${process.env.EMAIL_FROM}>`;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
  }

  createTransport() {
    // In DEVELOPMENT
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // send the actual email
  async send(template, subject) {
    // 1) Render HTML base on a pug template
    const html = pug.renderFile(
      `${__dirname}/../views/emails/${template}.pug`,
      {
        firstName: this.firstName,
        url: this.url,
        subject: this.subject,
      }
    );

    // 2) Define mail options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      // text: for user who prefer simple text email
      text: htmlToText.convert(html),
    };

    // 3) Create transport and send email
    if (process.env.NODE_ENV === 'development') {
      const transport = this.createTransport();
      await transport.sendMail(mailOptions);
    } else if (process.env.NODE_ENV === 'production') {
      // Use Postmark
      const client = new postmark.ServerClient(process.env.POSTMARK_APIKEY);

      await client.sendEmail({
        From: this.from,
        To: this.to,
        Subject: this.subject,
        HtmlBody: html,
        TextBody: htmlToText.convert(html),
      });
    }
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)'
    );
  }

  async sendEmailConfirm() {
    await this.send(
      'emailConfirm',
      'Your email confirm token (valid for 10 days)'
    );
  }
};
