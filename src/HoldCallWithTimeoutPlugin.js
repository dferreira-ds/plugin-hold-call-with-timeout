import React from 'react';
import { FlexPlugin } from '@twilio/flex-plugin';

const PLUGIN_NAME = 'HoldCallWithTimeoutPlugin';

export default class HoldCallWithTimeoutPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  /**
   * This code is run when your plugin is being started
   * Use this to modify any UI components or attach to the actions framework
   *
   * @param flex { typeof import('@twilio/flex-ui') }
   */
  async init(flex, manager) {

    const isTaskActive = (task) => {
      const reservationSid = task?.sid;
      const taskStatus = task?.status;
      if (taskStatus === 'canceled') {
        return false;
      } else {
        return manager.workerClient.reservations.has(reservationSid);
      }
    };

    const waitForConferenceParticipants = (task) =>
      new Promise((resolve) => {
        const waitTimeMs = 100;
        // For outbound calls, the customer participant doesn't join the conference
        // until the called party answers. Need to allow enough time for that to happen.
        const maxWaitTimeMs = 60000;
        let waitForConferenceInterval = setInterval(async () => {

          const conference = task?.task?.attributes?.conference?.sid;

          console.log("DEBUG CONFERENCE", conference);

          if (!isTaskActive(task)) {
            console.debug('Call canceled, clearing waitForConferenceInterval');
            waitForConferenceInterval = clearInterval(waitForConferenceInterval);
            return;
          }
          if (conference === undefined) {
            return;
          }

          const participants = task?.task?.attributes?.conference?.participants;

          if (participants.length < 2) {
            return;
          };

          const worker = participants?.worker;
          const customer = participants?.customer;

          if (!worker || !customer) {
            return;
          }

          console.log('Worker and customer participants joined conference');
          waitForConferenceInterval = clearInterval(waitForConferenceInterval);

          let confParticipants = {
            worker: worker,
            customer: customer
          }

          resolve(confParticipants);
        }, waitTimeMs);

        setTimeout(() => {
          if (waitForConferenceInterval) {
            console.debug(
              `Customer participant didn't show up within ${maxWaitTimeMs / 1000
              } seconds`
            );
            clearInterval(waitForConferenceInterval);

            resolve([]);
          }
        }, maxWaitTimeMs);
      });
    
      manager.workerClient.on("reservationCreated", (reservation) => {
        reservation.on("accepted", async () => {
          
          let participants = await waitForConferenceParticipants(reservation);

          const body = {
            customerCallSid: reservation?.task?.attributes?.conference?.participants?.customer,
            workerCallSid: reservation?.task?.attributes?.conference?.participants?.worker,
            confSid: reservation?.task?.attributes?.conference?.sid,
          };

          const options = {
            method: 'POST',
            body: new URLSearchParams(body),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
          };

          // Make the network request using the Fetch API
          try {
            console.log("DEBUG: hitting first function")
            await fetch('https://serverless-function/holdCall', options)
          } catch (e) {
            console.error(e)
          };

          // unhold agent
          setTimeout(async () => {
            try {
              console.log("DEBUG: hitting second function")
              await fetch('https://serverless-function/unholdCall', options)
            } catch (e) {
              console.error(e);
            };
          }, 10000);
        })
      })
  }
}
