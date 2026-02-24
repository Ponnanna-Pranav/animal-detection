import React, { useRef, useState } from "react";

export default function CameraCapture() {

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);


  // start camera
  const startCamera = async () => {

    const stream = await navigator.mediaDevices.getUserMedia({

      video: true

    });

    videoRef.current.srcObject = stream;

  };


  // capture image and send to backend
  const captureImage = async () => {

    setLoading(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    const imageBase64 = canvas.toDataURL("image/jpeg");


    const response = await fetch(

      "https://animal-intrusion-backend.onrender.com/predict-base64",

      {
        method: "POST",

        headers: {

          "Content-Type": "application/json"

        },

        body: JSON.stringify({

          image: imageBase64

        })

      }

    );

    const data = await response.json();

    setResult(data);

    setLoading(false);

  };


  return (

    <div>

      <h2>Camera Detection</h2>

      <video

        ref={videoRef}

        autoPlay

        width="400"

        style={{ border: "2px solid black" }}

      />

      <br/><br/>

      <button onClick={startCamera}>
        Start Camera
      </button>

      <button onClick={captureImage}>
        Capture & Detect
      </button>

      <br/><br/>

      {loading && <p>Detecting...</p>}

      {result && (

        <div>

          <h3>Result:</h3>

          <pre>

            {JSON.stringify(result, null, 2)}

          </pre>

        </div>

      )}

      <canvas

        ref={canvasRef}

        style={{ display: "none" }}

      />

    </div>

  );

}