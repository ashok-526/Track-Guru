import * as faceapi from "face-api.js";

const LOCAL_MODEL_URL = "/models";
const REMOTE_MODEL_URL =
  "https://justadudewhohacks.github.io/face-api.js/models";

const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 224,
  scoreThreshold: 0.45
});

let modelsLoaded = false;
let modelsPromise = null;

async function loadModelSet(baseUrl) {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl)
  ]);
}

export function getFaceDetectorOptions() {
  return detectorOptions;
}

export function areFaceRecognitionModelsReady() {
  return modelsLoaded;
}

export async function loadFaceRecognitionModels() {
  if (modelsLoaded) {
    return;
  }

  if (!modelsPromise) {
    modelsPromise = (async () => {
      try {
        await loadModelSet(LOCAL_MODEL_URL);
      } catch {
        await loadModelSet(REMOTE_MODEL_URL);
      }

      modelsLoaded = true;
    })().catch((error) => {
      modelsPromise = null;
      throw error;
    });
  }

  await modelsPromise;
}

export function primeFaceRecognitionModels() {
  return loadFaceRecognitionModels();
}
