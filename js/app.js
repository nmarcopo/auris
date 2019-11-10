//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; 						//stream from getUserMedia()
var rec; 							//Recorder.js object
var input; 							//MediaStreamAudioSourceNode we'll be recording

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext //audio context to help us record

var recordButton = document.getElementById("recordButton");
var stopButton = document.getElementById("stopButton");
var pauseButton = document.getElementById("pauseButton");

//add events to those 2 buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
pauseButton.addEventListener("click", pauseRecording);

function startRecording() {
    console.log("recordButton clicked");

    Notification.requestPermission().then(function (permission) {
        // If the user accepts, let's create a notification
        if (permission === "granted") {
            var notification = new Notification("Notifications are enabled!");
            setTimeout(notification.close.bind(notification), 3000);
        }
    });

    /*
        Simple constraints object, for more advanced audio features see
        https://addpipe.com/blog/audio-constraints-getusermedia/
    */

    var constraints = { audio: true, video: false }

    /*
       Disable the record button until we get a success or fail from getUserMedia() 
   */

    recordButton.disabled = true;
    stopButton.disabled = false;
    pauseButton.disabled = false

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
        document.getElementById("formats").innerHTML = "Format: 1 channel pcm @ " + audioContext.sampleRate / 1000 + "kHz"

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
        recordButton.disabled = false;
        stopButton.disabled = true;
        pauseButton.disabled = true
    });
}

function pauseRecording() {
    console.log("pauseButton clicked rec.recording=", rec.recording);
    if (rec.recording) {
        //pause
        rec.stop();
        pauseButton.innerHTML = "Resume";
    } else {
        //resume
        rec.record()
        pauseButton.innerHTML = "Pause";

    }
}

function stopRecording() {
    console.log("stopButton clicked");

    //disable the stop button, enable the record too allow for new recordings
    stopButton.disabled = true;
    recordButton.disabled = false;
    pauseButton.disabled = true;

    //reset button just in case the recording is stopped while paused
    pauseButton.innerHTML = "Pause";

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

    endpoint = "http://max-audio-classifier.max.us-south.containers.appdomain.cloud/model/predict?start_time=0"

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
        alert('We couldn\'t catch that, please try again.')
        console.log(err)
    })
}

function displayPrediction(prediction) {
    const c = document.createElement('div')
    prediction.predictions.slice(0, 3).forEach(element => {
        console.log(element)
        var li = document.createElement('li');
        li.innerText = element.label
        li.classList.add("list-group-item")
        c.appendChild(li)
    });
    navigator.vibrate([500]);
    const p = document.createElement('div')
    p.appendChild(c)

    const predictions = document.getElementById("prediction");
    while (predictions.firstChild) {
        predictions.removeChild(predictions.firstChild);
    }
    predictions.appendChild(p)
}