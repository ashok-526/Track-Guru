import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import {
  areFaceRecognitionModelsReady,
  getFaceDetectorOptions,
  loadFaceRecognitionModels
} from "../lib/faceRecognition";

const AUTO_RETRY_DELAY_MS = 120;
const CAMERA_START_RETRY_COUNT = 4;
const CAMERA_START_RETRY_DELAY_MS = 250;
const VIDEO_READY_TIMEOUT_MS = 2000;

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function roundTo(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function normalizeDescriptor(descriptor) {
  const magnitude = Math.hypot(...descriptor) || 1;
  return new Float32Array(descriptor.map((value) => value / magnitude));
}

function shouldRetryCameraError(error) {
  return error?.name === "AbortError" || error?.name === "NotReadableError";
}

function drawVideoFrameToCanvas(video, { maxWidth = 640 } = {}) {
  const canvas = document.createElement("canvas");
  const sourceWidth = video?.videoWidth || 640;
  const sourceHeight = video?.videoHeight || 480;
  const scale = Math.min(1, maxWidth / Math.max(sourceWidth, 1));

  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return { canvas, context };
}

function analyzeFrameQuality(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height).data;
  const step = Math.max(4, Math.floor(Math.min(width, height) / 40));
  let brightnessSum = 0;
  let brightnessSquaredSum = 0;
  let sampleCount = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const red = imageData[index];
      const green = imageData[index + 1];
      const blue = imageData[index + 2];
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;

      brightnessSum += luminance;
      brightnessSquaredSum += luminance * luminance;
      sampleCount += 1;
    }
  }

  const brightness = brightnessSum / Math.max(sampleCount, 1);
  const variance =
    brightnessSquaredSum / Math.max(sampleCount, 1) - brightness * brightness;
  const contrast = Math.sqrt(Math.max(variance, 0));

  return {
    brightness: roundTo(brightness),
    contrast: roundTo(contrast),
    width,
    height
  };
}

function isFrameQualityUsable(quality, { minBrightness = 28, minContrast = 18 } = {}) {
  return quality.brightness >= minBrightness && quality.contrast >= minContrast;
}

function describeCameraError(error) {
  if (error?.message === "INSECURE_CAMERA_CONTEXT") {
    return "Camera access requires HTTPS or localhost.";
  }

  if (error?.message === "UNSUPPORTED_CAMERA_API") {
    return "This browser does not expose camera access. Use HTTPS or a supported browser.";
  }

  if (error?.name === "NotAllowedError") {
    return "Camera access was blocked. Allow camera permission and try again.";
  }

  if (error?.name === "NotFoundError") {
    return "No camera was found on this device.";
  }

  if (error?.name === "NotReadableError") {
    return "The camera is already in use by another application.";
  }

  return "Camera access is required for face verification and live monitoring.";
}

export function useFaceRecognition(enabled = true) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [modelsReady, setModelsReady] = useState(areFaceRecognitionModelsReady);
  const [loadingModels, setLoadingModels] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [error, setError] = useState("");

  async function bindStreamToVideo() {
    const video = videoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) {
      return false;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    try {
      await video.play();
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoReady(true);
      }
      return true;
    } catch {
      setVideoReady(false);
      return false;
    }
  }

  useEffect(() => {
    if (!enabled || modelsReady || loadingModels) {
      return;
    }

    let active = true;

    async function loadModels() {
      try {
        setLoadingModels(true);
        await loadFaceRecognitionModels();

        if (active) {
          setModelsReady(true);
          setError("");
        }
      } catch {
        if (active) {
          setError("Unable to load face recognition models.");
        }
      } finally {
        if (active) {
          setLoadingModels(false);
        }
      }
    }

    loadModels();

    return () => {
      active = false;
    };
  }, [enabled, loadingModels, modelsReady]);

  async function startCamera(options = {}) {
    const { preferredFacingMode = "user", includeAudio = false } = options;

    if (!window.isSecureContext) {
      setCameraActive(false);
      setError(describeCameraError({ message: "INSECURE_CAMERA_CONTEXT" }));
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraActive(false);
      setError(describeCameraError({ message: "UNSUPPORTED_CAMERA_API" }));
      return false;
    }

    if (streamRef.current) {
      try {
        await bindStreamToVideo();
        setMediaStream(streamRef.current);
        setCameraActive(true);
        setError("");
        return true;
      } catch {
        stopCamera();
      }
    }

    const baseVideoConstraints = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 24, max: 30 }
    };

    const videoConstraintOptions = [
      preferredFacingMode
        ? {
            ...baseVideoConstraints,
            facingMode: { ideal: preferredFacingMode }
          }
        : null,
      baseVideoConstraints,
      true
    ].filter(Boolean);

    const constraintOptions = videoConstraintOptions.map((video) => ({
      video,
      audio: includeAudio
    }));

    if (includeAudio) {
      constraintOptions.push(
        ...videoConstraintOptions.map((video) => ({
          video,
          audio: false
        }))
      );
    }

    let lastError = null;

    for (const constraints of constraintOptions) {
      for (let attempt = 0; attempt < CAMERA_START_RETRY_COUNT; attempt += 1) {
        let stream = null;

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
          await bindStreamToVideo();

          setMediaStream(stream);
          setCameraActive(true);
          setError("");
          return true;
        } catch (error) {
          lastError = error;

          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }

          if (streamRef.current === stream) {
            streamRef.current = null;
          }

          if (
            !shouldRetryCameraError(error) ||
            attempt === CAMERA_START_RETRY_COUNT - 1
          ) {
            break;
          }

          await wait(CAMERA_START_RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }

    setCameraActive(false);
    setError(describeCameraError(lastError));
    return false;
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setMediaStream(null);
    setCameraActive(false);
    setVideoReady(false);
  }

  function captureFramePreview(options = {}) {
    const { maxWidth = 640, quality = 0.85 } = options;
    const { canvas } = drawVideoFrameToCanvas(videoRef.current, { maxWidth });
    return canvas.toDataURL("image/jpeg", quality);
  }

  async function waitForVideoReady() {
    const video = videoRef.current;

    if (!video) {
      throw new Error("Video feed is not ready.");
    }

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      setVideoReady(true);
      return video;
    }

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Camera feed is taking too long to start."));
      }, VIDEO_READY_TIMEOUT_MS);

      function cleanup() {
        window.clearTimeout(timeout);
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("canplay", handleReady);
      }

      function handleReady() {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          cleanup();
          setVideoReady(true);
          resolve();
        }
      }

      video.addEventListener("loadeddata", handleReady);
      video.addEventListener("canplay", handleReady);
    });

    return video;
  }

  async function detectSingleFace({
    allowMultipleFaces = false,
    noFaceMessage = "No face detected. Please center your face in the frame."
  } = {}) {
    await waitForVideoReady();

    const detections = await faceapi
      .detectAllFaces(videoRef.current, getFaceDetectorOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptors();

    if (!detections.length) {
      throw new Error(noFaceMessage);
    }

    if (!allowMultipleFaces && detections.length > 1) {
      throw new Error("Only one face should be visible in the camera frame.");
    }

    return detections.sort((left, right) => {
      const leftArea = left.detection.box.width * left.detection.box.height;
      const rightArea = right.detection.box.width * right.detection.box.height;
      return rightArea - leftArea;
    })[0];
  }

  async function captureDescriptor(options = {}) {
    const {
      sampleCount = 1,
      sampleDelayMs = AUTO_RETRY_DELAY_MS,
      maxAttempts = 8,
      allowMultipleFaces = false,
      noFaceMessage
    } = options;

    if (!modelsReady) {
      throw new Error("Models are still loading.");
    }

    const descriptors = [];
    let previewUrl = "";

    while (descriptors.length < sampleCount) {
      let detection = null;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          detection = await detectSingleFace({
            allowMultipleFaces,
            noFaceMessage
          });
          break;
        } catch (captureError) {
          if (captureError.message === "Only one face should be visible in the camera frame.") {
            throw captureError;
          }

          if (attempt === maxAttempts - 1) {
            throw captureError;
          }

          await wait(AUTO_RETRY_DELAY_MS);
        }
      }

      descriptors.push(Array.from(detection.descriptor));
      previewUrl = captureFramePreview();

      if (descriptors.length < sampleCount) {
        await wait(sampleDelayMs);
      }
    }

    const averagedDescriptor = descriptors[0].map((_, index) => {
      const total = descriptors.reduce((sum, descriptor) => sum + descriptor[index], 0);
      return total / descriptors.length;
    });

    return {
      descriptor: normalizeDescriptor(averagedDescriptor),
      previewUrl,
      sampleCount: descriptors.length
    };
  }

  async function captureMultipleDescriptors() {
    if (!modelsReady) {
      throw new Error("Models are still loading.");
    }

    await waitForVideoReady();

    const detections = await faceapi
      .detectAllFaces(videoRef.current, getFaceDetectorOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptors();

    if (!detections.length) {
      throw new Error("No face detected in the classroom frame.");
    }

    return {
      faces: detections.map((detection, index) => ({
        id: `${Date.now()}-${index}`,
        descriptor: normalizeDescriptor(Array.from(detection.descriptor)),
        box: detection.detection.box
      })),
      previewUrl: captureFramePreview()
    };
  }

  async function captureFrameDetections({ includeDescriptors = true } = {}) {
    if (!modelsReady) {
      throw new Error("Models are still loading.");
    }

    const video = await waitForVideoReady();
    let query = faceapi
      .detectAllFaces(video, getFaceDetectorOptions())
      .withFaceLandmarks(true);

    const detections = includeDescriptors
      ? await query.withFaceDescriptors()
      : await query;

    return {
      detections,
      frameWidth: video.videoWidth || 640,
      frameHeight: video.videoHeight || 480,
      previewUrl: captureFramePreview()
    };
  }

  async function captureFrameSnapshot(options = {}) {
    await waitForVideoReady();
    return captureFramePreview(options);
  }

  async function captureValidatedFrameSnapshot(options = {}) {
    const {
      maxWidth = 320,
      quality = 0.72,
      maxAttempts = 4,
      retryDelayMs = 180,
      minBrightness = 28,
      minContrast = 18
    } = options;

    await waitForVideoReady();

    let lastQuality = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const { canvas, context } = drawVideoFrameToCanvas(videoRef.current, { maxWidth });
      const frameQuality = analyzeFrameQuality(context, canvas.width, canvas.height);
      lastQuality = frameQuality;

      if (
        isFrameQualityUsable(frameQuality, {
          minBrightness,
          minContrast
        })
      ) {
        return {
          imageUrl: canvas.toDataURL("image/jpeg", quality),
          quality: frameQuality
        };
      }

      if (attempt < maxAttempts - 1) {
        await wait(retryDelayMs);
      }
    }

    const qualityError = new Error(
      "Frame capture skipped because the live video is too dark or too flat."
    );
    qualityError.quality = lastQuality;
    throw qualityError;
  }

  useEffect(() => {
    if (!streamRef.current) {
      return;
    }

    void bindStreamToVideo();
  });

  useEffect(() => stopCamera, []);

  return {
    videoRef,
    modelsReady,
    loadingModels,
    cameraActive,
    videoReady,
    mediaStream,
    error,
    startCamera,
    stopCamera,
    captureDescriptor,
    captureMultipleDescriptors,
    captureFrameDetections,
    captureFrameSnapshot,
    captureValidatedFrameSnapshot
  };
}
