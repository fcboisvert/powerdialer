exports.handler = function (context, event, callback) {
  const identity = event.identity || "anonymous";

  const ALLOWED_IDENTITIES = ["frederic", "simon"];
  if (!ALLOWED_IDENTITIES.includes(identity)) {
    return callback("Unauthorized identity");
  }

  // Create capability token
  const capability = new Twilio.jwt.ClientCapability({
    accountSid: context.ACCOUNT_SID,
    authToken: context.AUTH_TOKEN,
  });

  capability.addScope(
    new Twilio.jwt.ClientCapability.OutgoingClientScope({
      applicationSid: context.TWIML_APP_SID,
      clientName: identity, // must match the identity param passed from frontend
    })
  );

  const token = capability.toJwt();

  return callback(null, { token });
};
