//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var input; 							//MediaStreamAudioSourceNode we'll be recording
var imgButton = document.getElementById("mic_image");
var isRec = false;
var notificationStrings = ["Dog", "Police car (siren)", "Siren", "Ambulance (siren)", "Emergency vehicle", "Fire alarm", "Alarm", "Car alarm", "Bicycle bell"];

function onLoad() {
    imgButton.addEventListener('click', function () {
        if (isRec) {
            imgButton.src = "img/mic_off.png";
            isRec = false;
        }
        else {
            imgButton.src = "img/mic_on.png";
            isRec = true;
        }
    });
    recordAudio();
}

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext //audio context to help us record


//add events to those 2 buttons

var soundLevel
var lock;
var lock2;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function recordAudio() {
    lock = false
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function (stream) {
            audioContext = new AudioContext();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;

            microphone.connect(analyser);
            analyser.connect(javascriptNode);
            javascriptNode.connect(audioContext.destination);
            javascriptNode.onaudioprocess = async function () {
                var array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                var values = 0;

                var length = array.length;
                for (var i = 0; i < length; i++) {
                    values += (array[i]);
                }

                soundLevel = values / length;

                if (soundLevel > 70) {
                    console.log(Math.round(soundLevel));
                }
                if (soundLevel > 10 && !lock && isRec) {
                    lock = true
                    startRecording()
                    await sleep(2500)
                    if (!isRec) {
                        rec.stop();

                        //stop microphone access
                        gumStream.getAudioTracks()[0].stop();
                        lock = false;
                        return;
                    }
                    stopRecording();
                    lock = false
                }
                // colorPids(average);
            }
        })
        .catch(function (err) {
            /* handle the error */
            console.log(err)
        });
}
async function notify(notificationStr) {
    if (!lock2) {
        lock2 = true;
        console.log("I HAVE THE LOCK!!!!!!");
        navigator.vibrate(500);
        await sleep(500)
        alert("Be careful, I think I hear a " + notificationStr + ".")
        // Notification.requestPermission().then(function (permission) {
            // If the user accepts, let's create a notification
            // if (permission === "granted") {
                // var notification = new Notification("Be careful, I think I hear a " + notificationStr + ".");
                // setTimeout(notification.close.bind(notification), 3000);
            // }
        // });
        await sleep(10000);
        lock2 = false;
    }
}

function startRecording() {
    console.log("recordButton clicked");

    /*
        Simple constraints object, for more advanced audio features see
        https://addpipe.com/blog/audio-constraints-getusermedia/
    */

    var constraints = { audio: true, video: false }

    /*
       Disable the record button until we get a success or fail from getUserMedia() 
   */


    /*
        We're using the standard promise based getUserMedia() 
        https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
    */

    navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        console.log("getUserMedia() success, stream created, initializing Recorder.js ...");

        /*
            create an audio context after getUserMedia is called
            sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
            the sampleRate defaults to the one set in your OS for your playback device

        */
        audioContext = new AudioContext();

        //update the format 

        /*  assign to gumStream for later use  */
        gumStream = stream;

        /* use the stream */
        input = audioContext.createMediaStreamSource(stream);

        /* 
            Create the Recorder object and configure to record mono sound (1 channel)
            Recording 2 channels  will double the file size
        */
        rec = new Recorder(input, { numChannels: 1 })

        //start the recording process
        rec.record()

        console.log("Recording started");

    }).catch(function (err) {
        //enable the record button if getUserMedia() fails
    });
}


function stopRecording() {
    console.log("stopButton clicked");

    //disable the stop button, enable the record too allow for new recordings

    //reset button just in case the recording is stopped while paused

    //tell the recorder to stop the recording
    rec.stop();

    //stop microphone access
    gumStream.getAudioTracks()[0].stop();

    //create the wav blob and pass it on to sendToWatson
    rec.exportWAV(sendToWatson);
}

function sendToWatson(blob) {

    // create a new form data to send the audio
    const formData = new FormData()
    formData.append('audio', blob, 'audio.wav')

    endpoint = "https://max-audio-classifier.max.us-south.containers.appdomain.cloud/model/predict?start_time=0"

    // make the POST call to the model endpoint and send the form data containing the audio
    fetch((endpoint), {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    }).then(function (response) {
        // yay! we got a response. convert it to JSON
        return response.json()
    }).then(function (prediction) {
        // display the prediction response
        displayPrediction(prediction)
    }).catch(function (err) {
        // alert('We couldn\'t catch that, please try again.')
        console.log(err)
    })
}

function displayPrediction(prediction) {
    const c = document.createElement('div')
    prediction.predictions.slice(0, 3).forEach(element => {
        var li = document.createElement('li');
        li.innerText = element.label
        li.classList.add("list-group-item")
        c.appendChild(li);
        if (notificationStrings.includes(element.label)) {
            notify(element.label);
        }
    });
    const p = document.createElement('div')
    p.appendChild(c)

    const predictions = document.getElementById("prediction");
    while (predictions.firstChild) {
        predictions.removeChild(predictions.firstChild);
    }
    predictions.appendChild(p);
}
