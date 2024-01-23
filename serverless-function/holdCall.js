exports.handler = async function (context, event, callback) {
    const response = new Twilio.Response()
      response.appendHeader('Access-Control-Allow-Origin', '*');
      response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST GET');
      response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    const client = context.getTwilioClient()

    const { customerCallSid, workerCallSid, confSid } = event

    console.log("DEBUG: ", customerCallSid, workerCallSid, confSid)

    if (!confSid || !customerCallSid) {
        response.statusCode = 400;
        response.body = 'Conference, participant or hold param(s) not set';
        return callback(null, response);
    }

    try {
        // update conference exit flag
        await client.conferences(confSid)
            .participants(customerCallSid)
            .update({ endConferenceOnExit: false })

        // hold agent
        await client.conferences(confSid)
            .participants(customerCallSid)
            .update({ hold: true, holdUrl: 'http://demo.twilio.com/docs/voice.xml' })
        
        // update flag again
        await client.conferences(confSid)
            .participants(customerCallSid)
            .update({ endConferenceOnExit: true })

    } catch (e) {
        console.error(e)
        response.setBody(e)
        response.setStatusCode(500)
    }

    return callback(null, response);
};