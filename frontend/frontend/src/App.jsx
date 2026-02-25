import { useState, useEffect, useRef } from "react";

const BACKEND_URL = "https://animal-detection-lx9k.onrender.com";

function App() {

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Live CCTV state
  const [liveMode, setLiveMode] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);


  // =====================================================
  // IMAGE PREVIEW
  // =====================================================

  useEffect(() => {

    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);

  }, [file]);


  const handleFileChange = (e) => {

    const selected = e.target.files[0];

    setFile(selected || null);
    setResult(null);
    setErrorMsg("");

  };


  // =====================================================
  // START CAMERA
  // =====================================================

  const startCamera = async () => {

    try {

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      streamRef.current = stream;

      videoRef.current.srcObject = stream;

      await videoRef.current.play();

      console.log("Camera started");

    } catch (error) {

      console.error(error);
      alert("Camera failed: " + error.message);

    }

  };


  // =====================================================
  // CAPTURE FRAME AND SEND TO BACKEND
  // =====================================================

  const captureFrame = async () => {

    if (!videoRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL("image/jpeg");

  };


  // =====================================================
  // DETECT FROM CAMERA (MANUAL)
  // =====================================================

  const captureFromCamera = async () => {

    setLoading(true);
    setErrorMsg("");

    try {

      const base64 = await captureFrame();

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

      const data = await response.json();

      setResult(data);

      fetchHistory();

    } catch {

      setErrorMsg("Camera detection failed");

    }

    setLoading(false);

  };


  // =====================================================
  // LIVE CCTV DETECTION LOOP
  // =====================================================

  const runLiveDetection = async () => {

    try {

      const base64 = await captureFrame();

      if (!base64) return;

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

      if (!response.ok) return;

      const data = await response.json();

      setResult(data);

      fetchHistory();

    } catch (err) {

      console.error("Live detection error:", err);

    }

  };


  // =====================================================
  // START LIVE MODE
  // =====================================================

  const startLiveMode = async () => {

    await startCamera();

    setLiveMode(true);

    intervalRef.current = setInterval(runLiveDetection, 2000);

    console.log("Live CCTV started");

  };


  // =====================================================
  // STOP LIVE MODE
  // =====================================================

  const stopLiveMode = () => {

    setLiveMode(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    console.log("Live CCTV stopped");

  };


  // =====================================================
  // FILE DETECT
  // =====================================================

  const handleDetect = async () => {

    if (!file) {
      alert("Select image first");
      return;
    }

    setLoading(true);
    setErrorMsg("");

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

      fetchHistory();

    } catch {

      setErrorMsg("Detection failed");

    }

    setLoading(false);

  };


  // =====================================================
  // FETCH HISTORY
  // =====================================================

  const fetchHistory = async () => {

    setHistoryLoading(true);

    try {

      const res = await fetch(`${BACKEND_URL}/detections`);
      const data = await res.json();
      setHistory(data);

    } catch {}

    setHistoryLoading(false);

  };


  useEffect(() => {

    fetchHistory();

  }, []);


  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {

    return () => {

      if (intervalRef.current)
        clearInterval(intervalRef.current);

      if (streamRef.current)
        streamRef.current.getTracks().forEach(track => track.stop());

    };

  }, []);


  // =====================================================
  // UI
  // =====================================================

  return (

    <div style={{
      minHeight: "100vh",
      background: "#111827",
      color: "white",
      padding: "40px"
    }}>

      <h1>Animal Intrusion Detection System</h1>


      {/* FILE DETECTION */}

      <input type="file" accept="image/*" onChange={handleFileChange} />

      <br/><br/>

      <button onClick={handleDetect}>
        Detect from File
      </button>


      {/* CAMERA CONTROLS */}

      <br/><br/>

      <button onClick={startCamera}>
        Start Camera
      </button>

      <button onClick={captureFromCamera}>
        Capture & Detect
      </button>

      <br/><br/>

      <button onClick={startLiveMode} disabled={liveMode}>
        Start Live CCTV
      </button>

      <button onClick={stopLiveMode} disabled={!liveMode}>
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
        style={{ border: "2px solid white" }}
      />

      <canvas ref={canvasRef} style={{ display: "none" }} />


      {/* RESULT */}

      {loading && <p>Detecting...</p>}

      {errorMsg && <p>{errorMsg}</p>}

      {result && (
        <pre>{JSON.stringify(result, null, 2)}</pre>
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

export default App;
