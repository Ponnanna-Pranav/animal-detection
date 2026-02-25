import { useState, useEffect, useRef } from "react";

const BACKEND_URL = "https://animal-detection-lx9k.onrender.com";

export default function App() {

  //////////////////////////////////////////////////////
  // STATE
  //////////////////////////////////////////////////////

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");

  const [history, setHistory] = useState([]);

  const [historyLoading, setHistoryLoading] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);

  const [liveMode, setLiveMode] = useState(false);


  //////////////////////////////////////////////////////
  // REFS
  //////////////////////////////////////////////////////

  const videoRef = useRef(null);

  const canvasRef = useRef(null);

  const streamRef = useRef(null);

  const intervalRef = useRef(null);



  //////////////////////////////////////////////////////
  // IMAGE PREVIEW
  //////////////////////////////////////////////////////

  useEffect(() => {

    if (!file) {

      setPreviewUrl(null);

      return;

    }

    const url = URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);

  }, [file]);



  //////////////////////////////////////////////////////
  // FILE SELECT
  //////////////////////////////////////////////////////

  const handleFileChange = (e) => {

    const selected = e.target.files[0];

    if (!selected) return;

    setFile(selected);

    setResult(null);

    setErrorMsg("");

  };



  //////////////////////////////////////////////////////
  // START CAMERA
  //////////////////////////////////////////////////////

  const startCamera = async () => {

    try {

      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({

        video: true,

        audio: false

      });

      streamRef.current = stream;

      if (videoRef.current) {

        videoRef.current.srcObject = stream;

        await videoRef.current.play();

      }

      setCameraOn(true);

      console.log("Camera started");

    }

    catch (error) {

      console.error(error);

      alert("Camera failed: " + error.message);

    }

  };



  //////////////////////////////////////////////////////
  // STOP CAMERA
  //////////////////////////////////////////////////////

  const stopCamera = () => {

    if (streamRef.current) {

      streamRef.current.getTracks().forEach(track => track.stop());

      streamRef.current = null;

    }

    if (videoRef.current)

      videoRef.current.srcObject = null;

    stopLiveMode();

    setCameraOn(false);

    console.log("Camera stopped");

  };



  //////////////////////////////////////////////////////
  // CAPTURE FRAME
  //////////////////////////////////////////////////////

  const captureFrame = () => {

    const video = videoRef.current;

    const canvas = canvasRef.current;

    if (!video || video.videoWidth === 0) return null;

    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL("image/jpeg");

  };



  //////////////////////////////////////////////////////
  // SEND BASE64 TO BACKEND
  //////////////////////////////////////////////////////

  const detectBase64 = async (base64) => {

    try {

      const response = await fetch(

        `${BACKEND_URL}/predict-base64`,

        {

          method: "POST",

          headers: {

            "Content-Type": "application/json"

          },

          body: JSON.stringify({ image: base64 })

        }

      );

      if (!response.ok)

        throw new Error("Backend error");

      const data = await response.json();

      setResult(data);

    }

    catch (error) {

      console.error(error);

      setErrorMsg("Detection failed");

    }

  };



  //////////////////////////////////////////////////////
  // CAPTURE & DETECT
  //////////////////////////////////////////////////////

  const captureFromCamera = async () => {

    const base64 = captureFrame();

    if (!base64) return;

    setLoading(true);

    await detectBase64(base64);

    await fetchHistory();

    setLoading(false);

  };



  //////////////////////////////////////////////////////
  // LIVE DETECTION LOOP
  //////////////////////////////////////////////////////

  const runLiveDetection = async () => {

    const base64 = captureFrame();

    if (!base64) return;

    await detectBase64(base64);

  };



  //////////////////////////////////////////////////////
  // START LIVE MODE
  //////////////////////////////////////////////////////

  const startLiveMode = async () => {

    if (liveMode) return;

    await startCamera();

    intervalRef.current = setInterval(

      runLiveDetection,

      2000

    );

    setLiveMode(true);

    console.log("Live CCTV started");

  };



  //////////////////////////////////////////////////////
  // STOP LIVE MODE
  //////////////////////////////////////////////////////

  const stopLiveMode = () => {

    if (intervalRef.current) {

      clearInterval(intervalRef.current);

      intervalRef.current = null;

    }

    setLiveMode(false);

    console.log("Live CCTV stopped");

  };



  //////////////////////////////////////////////////////
  // FILE DETECT
  //////////////////////////////////////////////////////

  const handleDetect = async () => {

    if (!file) return;

    setLoading(true);

    const formData = new FormData();

    formData.append("file", file);

    try {

      const response = await fetch(

        `${BACKEND_URL}/predict`,

        {

          method: "POST",

          body: formData

        }

      );

      const data = await response.json();

      setResult(data);

      await fetchHistory();

    }

    catch {

      setErrorMsg("Detection failed");

    }

    setLoading(false);

  };



  //////////////////////////////////////////////////////
  // FETCH HISTORY
  //////////////////////////////////////////////////////

  const fetchHistory = async () => {

    try {

      setHistoryLoading(true);

      const res = await fetch(

        `${BACKEND_URL}/detections`

      );

      const data = await res.json();

      setHistory(data);

    }

    catch {}

    setHistoryLoading(false);

  };



  useEffect(() => {

    fetchHistory();

  }, []);



  //////////////////////////////////////////////////////
  // CLEANUP
  //////////////////////////////////////////////////////

  useEffect(() => {

    return () => {

      stopCamera();

      stopLiveMode();

    };

  }, []);



  //////////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////////

  return (

    <div style={{

      minHeight: "100vh",

      background: "#111827",

      color: "white",

      padding: "40px",

      fontFamily: "Arial"

    }}>



      <h1>Animal Intrusion Detection System</h1>



      {/* FILE INPUT */}

      <input

        type="file"

        accept="image/*"

        onChange={handleFileChange}

      />



      <br/><br/>



      <button onClick={handleDetect}>

        Detect from File

      </button>



      <br/><br/>



      {/* CAMERA CONTROLS */}

      <button

        onClick={startCamera}

        disabled={cameraOn}

      >

        Start Camera

      </button>



      <button

        onClick={stopCamera}

        disabled={!cameraOn}

      >

        Stop Camera

      </button>



      <button

        onClick={captureFromCamera}

        disabled={!cameraOn}

      >

        Capture & Detect

      </button>



      <br/><br/>



      {/* LIVE MODE */}

      <button

        onClick={startLiveMode}

        disabled={liveMode}

      >

        Start Live CCTV

      </button>



      <button

        onClick={stopLiveMode}

        disabled={!liveMode}

      >

        Stop Live CCTV

      </button>



      <br/><br/>



      {/* VIDEO */}

      <video

        ref={videoRef}

        autoPlay

        playsInline

        muted

        width="400"

        style={{

          border: "2px solid white",

          borderRadius: "8px"

        }}

      />



      <canvas

        ref={canvasRef}

        style={{ display: "none" }}

      />



      {/* IMAGE PREVIEW */}

      {previewUrl && (

        <>

          <h3>Uploaded Image</h3>

          <img

            src={previewUrl}

            width="400"

            style={{ borderRadius: "8px" }}

          />

        </>

      )}



      {/* LOADING */}

      {loading && <p>Detecting...</p>}



      {/* ERROR */}

      {errorMsg && (

        <p style={{ color: "red" }}>

          {errorMsg}

        </p>

      )}



      {/* RESULT */}

      {result && (

        <>

          <h3>Result</h3>

          <pre>

            {JSON.stringify(result, null, 2)}

          </pre>

        </>

      )}



      {/* HISTORY */}

      <h3>History</h3>



      {historyLoading

        ? "Loading..."

        : history.map(h => (

            <div key={h.id}>

              {h.animal} — {(h.confidence * 100).toFixed(1)}%

            </div>

          ))

      }



    </div>

  );

}
