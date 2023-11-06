const mqtt = require('mqtt');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// home
// const mqttBrokerUrl = 'mqtt://192.168.0.101'; // Update with your MQTT broker URL
// office
const mqttBrokerUrl = 'mqtt://192.168.0.101'; // Update with your MQTT broker URL
const mqttTopic = 'frigate/events'; // Update with the MQTT topic you want to subscribe to
const username = 'test'; // Update with your MQTT username
const password = 'admin123'; // Update with your MQTT password

const client = mqtt.connect(mqttBrokerUrl, {
  username: username,
  password: password
});

const apiConfig = {
  apiUrl: "https://webhook.site/05415457-fa9e-4274-a458-213aa04ab1be"
};

// create a event queue
let eventQueue = [];

// Connect to the MQTT broker
client.on('connect', () => {
  console.log('Connected to MQTT broker');
  // Subscribe to the specified topic
  client.subscribe(mqttTopic, (err) => {
    if (!err) {
      console.log(`Subscribed to MQTT topic: ${mqttTopic}`);
    }
  });
});

// Handle incoming MQTT messages
client.on('message', (topic, message) => {
  if (topic === mqttTopic) {
    const eventData = JSON.parse(message.toString());
    const payload = eventData;

    // Check the condition before taking any action
    // console.log(payload);
    if (payload.type === 'new' && (payload.after.has_snapshot || payload.after.has_clip)) {
      // Handle the event since it meets your condition
      const id = payload.after.id;
      const message = payload.after.label + ' detected on ' + payload.after.camera;
      const response = payload.after;

      console.log('Received valid Frigate event:');
      console.log('ID:', id);
      console.log('Message:', message);
      console.log('Response:', response);

      eventQueue.push(payload.after);
      // sendEventToApi(payload.after);

      // You can process the eventData or send it to another API as needed.
    }
  }
});

// Send events to the API at a 1-minute interval
setInterval(() => {
  if (eventQueue.length > 0) {
    const event = eventQueue.shift();

    if (event.has_snapshot) {
      console.log("Having snapshot");
      // Fetch the snapshot image and include it in the POST request
      const snapshotUrl = `http://localhost:5000/api/events/${event.id}/snapshot.jpg`;
      const snapshotFileName = path.join(__dirname, `/images/snapshot_${event.id}.jpg`);
      
      axios.get(snapshotUrl, { responseType: 'stream' })
        .then(response => {
          const snapshotStream = response.data.pipe(fs.createWriteStream(snapshotFileName));

          snapshotStream.on('finish', async()  => {
            console.log('image saved',snapshotFileName);
            event.snapshotImage = fs.createReadStream(snapshotFileName);
            const formData = new FormData();
            formData.append('snapshotImage', fs.createReadStream(snapshotFileName));

            // Append other event data to the FormData
            formData.append('id', event.id);
            formData.append('camera', event.camera);
            formData.append('response', JSON.stringify(event));
            // Append other event fields as needed
            // await sendEventToApi(event);
            await sendEventToApiFormData(formData)
            // fs.unlinkSync(snapshotFileName); // Delete the temporary image file
          });
        })
        .catch(error => {
          console.error('Error fetching snapshot image:', error);
        });
    } else {
      sendEventToApi(event);
    }
  }
}, 60000); // 1 minute in milliseconds

function sendEventToApi(eventData) {
  axios.post(apiConfig.apiUrl, eventData)
    .then((response) => {
      console.log('Data sent to API:', eventData);
    })
    .catch((error) => {
      console.error('Error sending data to API:', error);
    });
}

function sendEventToApiFormData(eventData) {
  axios.post(apiConfig.apiUrl, eventData, {
    headers: {
      ...eventData.getHeaders(),
    },
  })
    .then(response => {
      console.log('Data sent to API:', eventData);
    })
    .catch(error => {
      console.error('Error sending data to API:', error);
    });
}



// Handle MQTT connection errors
client.on('error', (error) => {
  console.error('MQTT error:', error);
});

// Handle MQTT connection close
client.on('close', () => {
  console.log('Disconnected from MQTT broker');
});
